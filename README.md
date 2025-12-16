# Aluna IoT @ Riwi - Backend

Next.js (App Router, Node runtime) backend for the Riwi IoT automation platform. Handles MQTT ingestion and commands, relational data (PostgreSQL/Prisma), data lake (MongoDB), automation rules, and exposes REST APIs for the frontend and reporting.

## Architecture and flows
- MQTT bridge (`src/lib/mqtt.ts`): connects to `MQTT_URL`, keeps an in-memory snapshot for `/api/iot/state`, streams events via SSE `/api/iot/stream`, applies the fan rule (temperature/humidity thresholds), and publishes commands.
  - Lights: `POST /api/devices/:deviceId/lights` body `{ value: "ON" | "OFF" }`
  - Fans: `POST /api/devices/:deviceId/fans` body `{ value: "ON" | "OFF", speed?: number }`
  - Acks from `MQTT_ACK_TOPIC` mark pending commands as acknowledged.
- Relational (PostgreSQL, Prisma): roles, users, floors, zones (availability/schedule/reservations), devices, sensors, point-in-time telemetry, actuators/states, IoT commands, automation rules/logs, Telegram conversations/messages/context.
- Data lake (MongoDB): raw telemetry, automation logs, generated reports.
  - `/api/mongo/telemetry` GET/POST - filters `deviceId`, `zone`, `sensorType`, `from`, `to`, `limit`. Body expects `metadata.deviceId`, `value`, optional `unit`, `timestamp`, `n8nExecutionId`.
  - `/api/mongo/logs` GET/POST - filters `event`, `affectedZone`, `status`, `from`, `to`, `limit`. Body `{ event, affectedZone?, details?, date?, status? }`.
  - `/api/mongo/reports` GET/POST - filters `type`, `period`, `zoneId`, `limit`. Body `{ type, period?, zoneId?, summary?, dataPoints?, createdAt? }`.
- Auth: NextAuth credentials provider with JWT sessions. Register via `/api/auth/register`; sign-in via NextAuth client against `/api/auth/[...nextauth]`.
- n8n (expected): consumes MQTT, writes raw telemetry/logs/reports to MongoDB, can trigger automation and publish MQTT commands.

## API surface for the frontend
- Auth
  - POST `/api/auth/[...nextauth]` (NextAuth credentials sign-in)
  - POST `/api/auth/register` `{ fullName, email, password, phone?, roleId? }`
- IoT bridge
  - GET `/api/iot/state` -> `{ telemetry, acks, pending }`
  - GET `/api/iot/stream` (SSE events `telemetry`, `ack`)
  - POST `/api/devices/:deviceId/lights` `{ value: "ON"|"OFF" }`
  - POST `/api/devices/:deviceId/fans` `{ value: "ON"|"OFF", speed?: number }`
- Roles/Users
  - GET `/api/roles`; POST `/api/roles` `{ roleName, description? }`
  - GET `/api/users?roleId=&active=`; POST `/api/users` `{ fullName, email, passwordHash, phone?, roleId?, isActive? }`
- Floors/Zones/Reservations
  - GET `/api/floors`; POST `/api/floors` `{ floorNumber, floorName? }`
  - GET `/api/zones?floorId=`; POST `/api/zones` `{ floorId?, zoneName, zoneType?, description?, idealTemperature?, capacity? }`
  - GET/POST `/api/zones/:zoneId/availability` `{ dayOfWeek?, startTime:"HH:mm", endTime:"HH:mm" }`
  - GET/POST `/api/zones/:zoneId/schedule` `{ teacherName?, groupName?, startTime, endTime }`
  - GET/POST `/api/zones/:zoneId/reservations` `{ userId?, startDatetime, endDatetime, status?, reservationChannel? }`
  - Global reservations: GET `/api/reservations?status=&zoneId=&userId=`, POST `/api/reservations`, GET `/api/reservations/:reservationId`, PATCH `/api/reservations/:reservationId`
- Devices/Sensors/Telemetry
  - GET `/api/devices?zoneId=&floorId=`; POST `/api/devices` `{ deviceId?, zoneId?, deviceName, deviceType?, chipId?, macAddress?, firmwareVersion?, isOnline?, mqttTopic? }`
  - GET `/api/sensors?deviceId=`; POST `/api/sensors` `{ deviceId?, sensorType, unit?, description? }`
  - GET `/api/devices/:deviceId/telemetry?limit=`; GET `/api/telemetry?sensorId=&limit=`; GET `/api/telemetry/latest?deviceId=&zoneId=`
- Actuators/Commands
  - GET `/api/actuators?zoneId=&deviceId=`; POST `/api/actuators` `{ deviceId?, zoneId?, actuatorType, channel, supportsIntensity?, supportsSpeed?, supportsFanLight?, description? }`
  - GET/POST `/api/actuators/:actuatorId/state` (`POST` `{ state, speed?, intensity?, timestamp? }`)
  - GET `/api/commands?deviceId=&actuatorId=&success=`; POST `/api/commands` `{ deviceId?, actuatorId?, command, value?, sentTimestamp?, responseTimestamp?, success? }`
- Automation
  - GET/POST `/api/automation/rules` (`POST` `{ zoneId?, ruleType, condition, action, parameters?, isActive? }`)
  - GET/POST `/api/automation/rules/:ruleId/logs` (`POST` `{ message?, timestamp? }`)
- Telegram
  - GET/POST `/api/telegram/conversations`
  - GET/POST `/api/telegram/messages`
  - GET/POST `/api/telegram/context/:conversationId`
- Mongo (data lake)
  - Telemetry raw: `/api/mongo/telemetry`
  - Automation logs: `/api/mongo/logs`
  - Generated reports: `/api/mongo/reports`

## How to use it from the frontend
- NextAuth sign-in (credentials):
  ```ts
  import { signIn } from "next-auth/react";
  await signIn("credentials", { email, password, redirect: false });
  ```
- SSE telemetry/acks:
  ```ts
  const es = new EventSource("/api/iot/stream");
  es.addEventListener("telemetry", (ev) => console.log("telemetry", ev.data));
  es.addEventListener("ack", (ev) => console.log("ack", ev.data));
  ```
- Axios examples:
  ```ts
  import axios from "axios";

  const zones = await axios.get("/api/zones", { params: { floorId: 1 } });

  await axios.post(`/api/zones/${zoneId}/reservations`, {
    userId: 1,
    startDatetime: new Date().toISOString(),
    endDatetime: new Date(Date.now() + 60_000).toISOString(),
  });

  const latest = await axios.get("/api/telemetry/latest", {
    params: { deviceId: "uuid-or-chip" },
  });

  const raw = await axios.get("/api/mongo/telemetry", {
    params: { deviceId: "arduino_giga_01", limit: 100 },
  });
  ```

## Environment variables
- MQTT: `MQTT_URL`, `MQTT_USERNAME`, `MQTT_PASSWORD`, `MQTT_CLIENT_ID`, `MQTT_QOS`, `MQTT_TELEMETRY_TOPIC`, `MQTT_ACK_TOPIC`, `MQTT_COMMAND_TOPIC_TEMPLATE`, `MQTT_DEBUG`
- PostgreSQL: `DATABASE_URL`
- MongoDB: `MONGODB_URL` (or `MONGODB_URI`), optional `MONGODB_DB` (default `aluna_iot`)
- Auth: `NEXTAUTH_SECRET` (and `NEXTAUTH_URL` in prod)

Current endpoints in `.env.local` for reference (update for production):
- MQTT broker: `mqtt://100.67.166.33:1883` (user `aluna`, password `Aluna2025.`, clientId `aluna-backend`)
- Mongo public: `mongodb://mongo:cUiCECJFxoTQgzMbZHCoHElkEFEEcuIq@hopper.proxy.rlwy.net:52949` (db `aluna_iot`)

## Data considerations
- BigInt fields are serialized as strings in JSON responses.
- Mongo indexes recommended:
  - `telemetry_raw`: `{ "metadata.deviceId": 1, "timestamp": -1 }` (plus TTL on `timestamp` if needed)
  - `automation_logs`: `{ "event": 1, "date": -1 }`
  - `generated_reports`: `{ "type": 1, "period": 1, "createdAt": -1 }`
- Command vs actuator state: commands = intent; states = observed result. Use both to render device status.

## Run, build, deploy
- Install: `npm install`
- Lint: `npm run lint`
- Build: `npm run build` (use `npm ci --omit=dev` in CI to avoid npm production warning)
- Start: `npm run start` (connects to MQTT at runtime; build does not require broker up)

## Quick smoke tests
- IoT snapshot: `curl http://localhost:8080/api/iot/state`
- SSE stream: open `http://localhost:8080/api/iot/stream` and publish MQTT telemetry to see events
- Mongo raw telemetry: `curl "http://localhost:8080/api/mongo/telemetry?deviceId=arduino_giga_01&limit=50"`
- Latest telemetry per device/zone: `curl "http://localhost:8080/api/telemetry/latest?deviceId=<id>"` or `?zoneId=<id>`
