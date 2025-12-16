# System Architecture (Aluna IoT @ Riwi)

## 1) Overview
Single-instance Next.js backend (App Router, Node runtime) for IoT monitoring and automation across Riwi floors (classrooms, coworking, offices). It orchestrates MQTT telemetry/commands, relational data in PostgreSQL, a MongoDB data lake for heavy telemetry/logging, automation rules, and REST APIs for the frontend/reporting.

## 2) Data stores
- **PostgreSQL (Prisma)**: critical relational data (users/roles, floors/zones, availability/schedule/reservations, devices/sensors/point telemetry, actuators/states, IoT commands, automation rules/logs, Telegram conversations/messages/context).
- **MongoDB (data lake)**: high-volume raw telemetry, automation logs, generated reports (optimized for writes and aggregations).

## 3) External services
- **MQTT broker**: `mqtt://100.67.166.33:1883` (user `aluna`, password `Aluna2025.`, clientId `aluna-backend`).
- **n8n (expected, outside this repo)**: consumes MQTT telemetry and inserts into MongoDB collections (`telemetry_raw`, `automation_logs`, `generated_reports`); can also publish MQTT commands.

## 4) Main flows
### Telemetry & commands (MQTT)
- Devices publish to `MQTT_TELEMETRY_TOPIC` (default `aluna/telemetry`).
- MQTT client (`src/lib/mqtt.ts`):
  - Maintains in-memory snapshot for `/api/iot/state` and SSE `/api/iot/stream` (events `telemetry`, `ack`).
  - Applies fan rule (temp/humidity thresholds).
  - Publishes commands via HTTP -> MQTT:
    - POST `/api/devices/:deviceId/lights` -> `LIGHT_SET`
    - POST `/api/devices/:deviceId/fans` -> `FAN_SET` (optional speed)
  - Acks on `MQTT_ACK_TOPIC` update pending/ack state in memory.

### Relational (PostgreSQL)
- CRUD/query via REST: roles, users, floors/zones (availability/schedule/reservations), devices, sensors, point telemetry, actuators/state, commands log, automation rules/logs, Telegram artifacts.

### Data lake (MongoDB)
- Collections exposed via API:
  - `telemetry_raw`: `/api/mongo/telemetry` (GET/POST). Filters: `deviceId`, `zone`, `sensorType`, `from`, `to`, `limit`. Body: `{ metadata:{deviceId, zone?, sensorType?}, value:number, unit?, timestamp?, n8nExecutionId? }`.
  - `automation_logs`: `/api/mongo/logs` (GET/POST). Filters: `event`, `affectedZone`, `status`, `from`, `to`, `limit`. Body: `{ event, affectedZone?, details?, date?, status? }`.
  - `generated_reports`: `/api/mongo/reports` (GET/POST). Filters: `type`, `period`, `zoneId`, `limit`. Body: `{ type, period?, zoneId?, summary?, dataPoints?, createdAt? }`.
- Frontend uses: historical charts (aggregations/downsampling), automation audit trails, precomputed reports for quick rendering.

## 5) Components
- Next.js backend (App Router, TypeScript).
- MQTT client: `src/lib/mqtt.ts`.
- Prisma client: `src/lib/prisma.ts` with schema `prisma/schema.prisma`.
- Mongo client: `src/lib/mongo.ts`, types in `src/types/mongo.ts`, routes under `/api/mongo/*`.
- HTTP helpers: `src/lib/http.ts` (safe JSON serialization, parsers).
- Auth: NextAuth (credentials, JWT sessions) via `/api/auth/[...nextauth]` and `/api/auth/register`.

## 6) Environment variables
- MQTT: `MQTT_URL`, `MQTT_USERNAME`, `MQTT_PASSWORD`, `MQTT_CLIENT_ID`, `MQTT_QOS`, `MQTT_TELEMETRY_TOPIC`, `MQTT_ACK_TOPIC`, `MQTT_COMMAND_TOPIC_TEMPLATE`, `MQTT_DEBUG`.
- PostgreSQL: `DATABASE_URL` (Railway).
- MongoDB: `MONGODB_URL` / `MONGODB_URI` (e.g., `mongodb://mongo:cUiCECJFxoTQgzMbZHCoHElkEFEEcuIq@hopper.proxy.rlwy.net:52949`), `MONGODB_DB` (default `aluna_iot`).
- Auth: `NEXTAUTH_SECRET` (and `NEXTAUTH_URL` in prod).

## 7) Operations & deploy
- Lint/build: `npm run lint`, `npm run build`.
- Start: `npm run start` (MQTT connects at runtime; build does not require broker up).
- Railway: set all env vars; prefer `npm ci --omit=dev` in build to avoid npm production warning.

## 8) Data considerations
- PostgreSQL: relational integrity via Prisma; tables already defined in schema.
- MongoDB indexes recommended:
  - `telemetry_raw`: `{ "metadata.deviceId": 1, "timestamp": -1 }` (+ TTL on `timestamp` if needed).
  - `automation_logs`: `{ "event": 1, "date": -1 }`.
  - `generated_reports`: `{ "type": 1, "period": 1, "createdAt": -1 }`.
- Aggregations for charts: `$match` by device/zone/sensorType + `$group` by time bucket (minute/hour) + `$sort`.
- Commands vs actuator state: commands = intent; states = observed. Use both for UI status.

## 9) n8n integration (expected)
1. MQTT Trigger consumes `aluna/telemetry`.
2. Transform payload to `{ metadata, value, unit, timestamp, n8nExecutionId }`.
3. Mongo Insert into `telemetry_raw`.
4. Optional automation decision -> insert into `automation_logs` and publish MQTT command.
5. Report generation -> insert JSON into `generated_reports` for quick frontend retrieval.

## 10) Quick checks
- IoT snapshot: `curl http://localhost:8080/api/iot/state`.
- SSE: open `http://localhost:8080/api/iot/stream` and publish MQTT telemetry to see events.
- Commands: `POST /api/devices/:deviceId/lights { "value":"ON" }`.
- Relational: `GET /api/devices`, `GET /api/telemetry/latest`, `GET /api/floors`, `GET /api/zones`.
- Mongo: `GET /api/mongo/telemetry?deviceId=...`, `POST /api/mongo/logs`, `POST /api/mongo/reports`.
