# Frontend API Guide

Backend endpoints exposed by the Next.js App Router. All routes are Node runtime, dynamic, and return JSON. Errors use `{ "error": "message" }`. BigInt fields are serialized as strings. Use Axios/fetch from the frontend.

## Key Concepts
- Zones/Floors: spatial hierarchy. Zones have availability, schedules, reservations, devices, actuators.
- Devices/Sensors/Telemetry: devices belong to zones; sensors belong to devices; telemetry is time-series per sensor.
- Actuators/Commands: actuators belong to devices/zones. Commands are intent; actuator states are observed state.
- Automation: rules + logs per zone.
- Telegram: conversations/messages/context for chatbot flows.
- Auth: NextAuth credentials (email/password), JWT sessions.

## Quick Reference (URLs & payloads)
- Auth
  - POST `/api/auth/[...nextauth]` (NextAuth credentials sign-in)
  - POST `/api/auth/register` `{ fullName, email, password, phone?, roleId? }`
- IoT bridge
  - GET `/api/iot/state` → `{ telemetry, acks, pending }`
  - GET `/api/iot/stream` (SSE events `telemetry`, `ack`)
  - POST `/api/devices/:deviceId/lights` `{ value: "ON"|"OFF" }`
  - POST `/api/devices/:deviceId/fans` `{ value: "ON"|"OFF", speed?: number }`
- Roles/Users
  - GET `/api/roles`
  - POST `/api/roles` `{ roleName, description? }`
  - GET `/api/users?roleId=&active=`
  - POST `/api/users` `{ fullName, email, passwordHash, phone?, roleId?, isActive? }`
- Floors/Zones
  - GET `/api/floors`
  - POST `/api/floors` `{ floorNumber, floorName? }`
  - GET `/api/zones?floorId=`
  - POST `/api/zones` `{ floorId?, zoneName, zoneType?, description?, idealTemperature?, capacity? }`
  - GET/POST `/api/zones/:zoneId/availability` `{ dayOfWeek?, startTime:"HH:mm", endTime:"HH:mm" }`
  - GET/POST `/api/zones/:zoneId/schedule` `{ teacherName?, groupName?, startTime, endTime }`
  - GET/POST `/api/zones/:zoneId/reservations` `{ userId?, startDatetime, endDatetime, status?, reservationChannel? }`
- Reservations (global)
  - GET `/api/reservations?status=&zoneId=&userId=`
  - POST `/api/reservations` `{ zoneId, userId?, startDatetime, endDatetime, status?, reservationChannel? }`
  - GET `/api/reservations/:reservationId`
  - PATCH `/api/reservations/:reservationId` `{ status?, reservationChannel?, startDatetime?, endDatetime? }`
- Devices/Sensors/Telemetry
  - GET `/api/devices?zoneId=&floorId=`
  - POST `/api/devices` `{ deviceId?, zoneId?, deviceName, deviceType?, chipId?, macAddress?, firmwareVersion?, isOnline?, mqttTopic? }`
  - GET `/api/sensors?deviceId=`
  - POST `/api/sensors` `{ deviceId?, sensorType, unit?, description? }`
  - GET `/api/devices/:deviceId/telemetry?limit=`
  - GET `/api/telemetry?sensorId=&limit=`
  - GET `/api/telemetry/latest?deviceId=&zoneId=`
- Actuators/Commands
  - GET `/api/actuators?zoneId=&deviceId=`
  - POST `/api/actuators` `{ deviceId?, zoneId?, actuatorType, channel, supportsIntensity?, supportsSpeed?, supportsFanLight?, description? }`
  - GET/POST `/api/actuators/:actuatorId/state` (`POST` `{ state, speed?, intensity?, timestamp? }`)
  - GET `/api/commands?deviceId=&actuatorId=&success=`
  - POST `/api/commands` `{ deviceId?, actuatorId?, command, value?, sentTimestamp?, responseTimestamp?, success? }`
- Automation
  - GET/POST `/api/automation/rules` (`POST` `{ zoneId?, ruleType, condition, action, parameters?, isActive? }`)
  - GET/POST `/api/automation/rules/:ruleId/logs` (`POST` `{ message?, timestamp? }`)
- Telegram
  - GET/POST `/api/telegram/conversations` (`POST` `{ telegramChatId, telegramUsername?, telegramFirstName?, telegramLastName?, userId?, status? }`)
  - GET/POST `/api/telegram/messages` (`POST` `{ conversationId, telegramMessageId?, sender, content }`)
  - GET/POST `/api/telegram/context/:conversationId` (`POST` `{ activeFlow?, currentStep?, tempData? }`)

## Auth
- Sign in (credentials, NextAuth client):
  ```ts
  import { signIn } from "next-auth/react";
  await signIn("credentials", { email, password, redirect: false });
  ```
- Register (raw request):
  ```bash
  curl -X POST http://localhost:3000/api/auth/register \
    -H "Content-Type: application/json" \
    -d '{"fullName":"Jane Doe","email":"jane@example.com","password":"Passw0rd!"}'
  ```
- Session shape: `user.id`, `user.email`, `user.name`, `user.role`.

## IoT Bridge (MQTT-backed)
- Snapshot: GET `/api/iot/state` → latest telemetry/acks/pending commands (in-memory).
- SSE: GET `/api/iot/stream` → events `telemetry`, `ack`.
  ```ts
  const es = new EventSource("/api/iot/stream");
  es.addEventListener("telemetry", (ev) => console.log("telemetry", ev.data));
  es.addEventListener("ack", (ev) => console.log("ack", ev.data));
  ```
- Commands: POST lights/fans as above; response `{ requestId }`.

## Floors, Zones, Reservations
- Typical booking flow:
  1) List floors/zones: `GET /api/floors` or `GET /api/zones?floorId=`.
  2) Check availability/schedule: `GET /api/zones/:zoneId/availability`, `GET /api/zones/:zoneId/schedule`.
  3) Create reservation: `POST /api/zones/:zoneId/reservations` or global `POST /api/reservations`.
- Reservations status/channel defaults: status `pending`, channel `web`.

## Devices, Sensors, Telemetry
- Devices include zone/floor, sensors, actuators with last state.
- Telemetry latest helper: `GET /api/telemetry/latest?deviceId=&zoneId=` returns one entry per sensor with device/zone/floor info.
  ```json
  {
    "sensorId": 12,
    "sensorType": "temperature",
    "unit": "C",
    "device": { "id": "uuid...", "zoneId": 3, "zoneName": "Lab A", "floorNumber": 2 },
    "latest": { "id": 99, "value": 24.5, "timestamp": "2025-12-15T17:20:00Z" }
  }
  ```

## Actuators & Commands
- Actuator state = observed; Command = intent. Combine to render “current state” plus history.
- State POST accepts optional `timestamp`; defaults to now.

## Automation
- Rule example:
  ```json
  {
    "zoneId": 3,
    "ruleType": "fan",
    "condition": "temperature > 27",
    "action": "turn_on_fan",
    "parameters": { "speed": 2 },
    "isActive": true
  }
  ```
- Logs can store free-text messages per rule.

## Telegram
- Flow: create conversation → post messages → upsert context as chatbot advances.
- Context holds `activeFlow`, `currentStep`, `tempData`.

## Axios Examples
```ts
import axios from "axios";

// Zones by floor
const { data: zones } = await axios.get("/api/zones", { params: { floorId: 1 } });

// Create reservation
await axios.post(`/api/zones/${zoneId}/reservations`, {
  userId: 1,
  startDatetime: new Date().toISOString(),
  endDatetime: new Date(Date.now() + 3600000).toISOString(),
});

// Latest telemetry for a device
const { data: latest } = await axios.get("/api/telemetry/latest", {
  params: { deviceId: "uuid-or-chip" },
});
```

## Env Vars (auth/MQTT/DB)
- Auth: `NEXTAUTH_SECRET` (required), `NEXTAUTH_URL` (prod).
- MQTT: `MQTT_URL`, `MQTT_USERNAME`, `MQTT_PASSWORD`, `MQTT_CLIENT_ID`, `MQTT_QOS`, telemetry/ack/command topics, fan thresholds.
- DB: `DATABASE_URL` (PostgreSQL).
