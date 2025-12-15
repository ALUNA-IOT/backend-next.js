This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## IoT MQTT bridge

Required environment variables (put in `.env.local`):

- `MQTT_URL`
- `MQTT_USERNAME`
- `MQTT_PASSWORD`
- `MQTT_CLIENT_ID`
- `MQTT_QOS` (default 1)
- `MQTT_TELEMETRY_TOPIC` (default: `aluna/telemetry`)
- `MQTT_ACK_TOPIC` (default: `aluna/devices/+/ack`)
- `MQTT_COMMAND_TOPIC_TEMPLATE` (default: `aluna/devices/<deviceId>/cmd`)
- `FAN_TEMP_ON` (default: 28), `FAN_TEMP_OFF` (26)
- `FAN_HUM_ON` (default: 70), `FAN_HUM_OFF` (65)

Local test flow:

1. `npm run dev`
2. Publish telemetry JSON to the telemetry topic.
3. Open `http://localhost:3000/api/iot/stream` to watch SSE (`telemetry` and `ack` events).
4. Snapshot endpoint: `http://localhost:3000/api/iot/state`
5. Send commands:
   - Lights: `curl -X POST http://localhost:3000/api/devices/nano-esp32-01/lights -H "Content-Type: application/json" -d '{"value":"ON"}'`
   - Fans: `curl -X POST http://localhost:3000/api/devices/nano-esp32-01/fans -H "Content-Type: application/json" -d '{"value":"ON","speed":1}'`

Frontend SSE example:

```ts
const es = new EventSource("/api/iot/stream");

es.addEventListener("telemetry", (ev) => {
  const data = JSON.parse(ev.data);
  console.log("Telemetry", data.deviceId, data.temperature, data.humidity);
});

es.addEventListener("ack", (ev) => {
  const data = JSON.parse(ev.data);
  console.log("Ack", data.requestId, data.status);
});

es.onerror = () => {
  console.warn("SSE disconnected, retrying...");
};
```
