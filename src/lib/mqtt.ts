/**
 * IoT MQTT bridge for telemetry, ACKs, commands, and SSE.
 *
 * Required env vars:
 * - MQTT_URL, MQTT_USERNAME, MQTT_PASSWORD, MQTT_CLIENT_ID, MQTT_QOS
 * - MQTT_TELEMETRY_TOPIC (default: aluna/telemetry)
 * - MQTT_ACK_TOPIC (default: aluna/devices/+/ack)
 * - MQTT_COMMAND_TOPIC_TEMPLATE (default: aluna/commands/<deviceId>/<channel>)
 * - FAN_TEMP_ON (28), FAN_TEMP_OFF (26), FAN_HUM_ON (70), FAN_HUM_OFF (65)
 *
 * Quick test:
 * - npm run dev
 * - open /api/iot/stream to watch SSE events
 * - curl -X POST http://localhost:3000/api/devices/nano-esp32-01/lights \
 *   -H "Content-Type: application/json" -d '{"value":"ON"}'
 *
 * Frontend SSE:
 * const es = new EventSource("/api/iot/stream");
 * es.addEventListener("telemetry", (ev) => console.log("t", ev.data));
 * es.addEventListener("ack", (ev) => console.log("ack", ev.data));
 */

import { connect, type IClientOptions, type MqttClient } from "mqtt";
import { randomUUID } from "node:crypto";
import type {
  AckMessage,
  CommandPayload,
  CommandType,
  PendingCommand,
  TelemetryMessage,
} from "@/types/telemetry";

type TelemetryListener = (message: TelemetryMessage) => void;
type AckListener = (ack: AckMessage) => void;

const MQTT_DEBUG =
  process.env.MQTT_DEBUG === "1" || process.env.MQTT_DEBUG === "true";

const debugLog = (...args: unknown[]) => {
  if (MQTT_DEBUG) console.log("[mqtt:debug]", ...args);
};

const TELEMETRY_TOPIC = process.env.MQTT_TELEMETRY_TOPIC ?? "aluna/telemetry";
const ACK_TOPIC_PATTERN =
  process.env.MQTT_ACK_TOPIC ?? "aluna/devices/+/ack";
const COMMAND_TOPIC_TEMPLATE =
  process.env.MQTT_COMMAND_TOPIC_TEMPLATE ??
  "aluna/commands/<deviceId>/<channel>";
const MQTT_CLEAN_SESSION =
  process.env.MQTT_CLEAN_SESSION === "false" ? false : true;

const FAN_TEMP_ON = getNumberEnv("FAN_TEMP_ON", 28);
const FAN_TEMP_OFF = getNumberEnv("FAN_TEMP_OFF", 26);
const FAN_HUM_ON = getNumberEnv("FAN_HUM_ON", 70);
const FAN_HUM_OFF = getNumberEnv("FAN_HUM_OFF", 65);

type FanState = "ON" | "OFF";

type GlobalMqttState = {
  mqttClient?: MqttClient;
  telemetryStore?: Map<string, TelemetryMessage>;
  ackStore?: Map<string, AckMessage>;
  pendingCommands?: Map<string, PendingCommand>;
  telemetryListeners?: Set<TelemetryListener>;
  ackListeners?: Set<AckListener>;
  lastFanCommand?: Map<string, FanState>;
};

const globalMqtt = globalThis as unknown as GlobalMqttState;

const telemetryStore =
  globalMqtt.telemetryStore ??
  (globalMqtt.telemetryStore = new Map<string, TelemetryMessage>());

const ackStore =
  globalMqtt.ackStore ?? (globalMqtt.ackStore = new Map<string, AckMessage>());

const pendingCommands =
  globalMqtt.pendingCommands ??
  (globalMqtt.pendingCommands = new Map<string, PendingCommand>());

const telemetryListeners =
  globalMqtt.telemetryListeners ??
  (globalMqtt.telemetryListeners = new Set<TelemetryListener>());

const ackListeners =
  globalMqtt.ackListeners ?? (globalMqtt.ackListeners = new Set<AckListener>());

const lastFanCommand =
  globalMqtt.lastFanCommand ??
  (globalMqtt.lastFanCommand = new Map<string, FanState>());

function getNumberEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  const value = raw ? Number(raw) : Number.NaN;
  return Number.isFinite(value) ? value : fallback;
}

function buildTopicRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const withWildcards = escaped.replace(/\\\+/g, "[^/]+");
  return new RegExp(`^${withWildcards}$`);
}

const ackSubscribeTopic = ACK_TOPIC_PATTERN.replace("<deviceId>", "+");
const ackTopicRegex = buildTopicRegex(ackSubscribeTopic);

type QoS = 0 | 1 | 2;

const getQoS = (): QoS => {
  const raw = process.env.MQTT_QOS ?? "1";
  const qos = Number.parseInt(raw, 10);
  if (qos === 0 || qos === 1 || qos === 2) return qos;
  return 1;
};

const parseTelemetry = (payload: Buffer): TelemetryMessage | null => {
  const raw = payload.toString("utf-8");
  try {
    const parsed = JSON.parse(raw);
    const { deviceId, temperature, humidity, timestamp } = parsed ?? {};

    if (typeof deviceId !== "string" || !deviceId.length) {
      console.error("[mqtt] Ignoring telemetry without deviceId");
      return null;
    }

    const tempNum = Number(temperature);
    const humNum = Number(humidity);

    if (!Number.isFinite(tempNum) || !Number.isFinite(humNum)) {
      console.error("[mqtt] Ignoring telemetry with non-numeric readings");
      return null;
    }

    const tsNum = Number(timestamp);

    return {
      deviceId,
      temperature: tempNum,
      humidity: humNum,
      timestamp: Number.isFinite(tsNum) ? tsNum : Date.now(),
    };
  } catch (error) {
    console.error("[mqtt] Failed to parse telemetry payload", error);
    return null;
  }
};

const parseAck = (payload: Buffer): AckMessage | null => {
  const raw = payload.toString("utf-8");
  try {
    const parsed = JSON.parse(raw);
    const { requestId, deviceId, status, receivedAt, message } = parsed ?? {};

    if (typeof deviceId !== "string" || !deviceId.length) {
      console.error("[mqtt] Ignoring ack without deviceId");
      return null;
    }

    if (typeof requestId !== "string" || !requestId.length) {
      console.error("[mqtt] Ignoring ack without requestId");
      return null;
    }

    if (typeof status !== "string" || !status.length) {
      console.error("[mqtt] Ignoring ack without status");
      return null;
    }

    const tsNum = Number(receivedAt);

    return {
      requestId,
      deviceId,
      status,
      receivedAt: Number.isFinite(tsNum) ? tsNum : Date.now(),
      message: typeof message === "string" ? message : undefined,
    };
  } catch (error) {
    console.error("[mqtt] Failed to parse ack payload", error);
    return null;
  }
};

const notifyTelemetry = (message: TelemetryMessage) => {
  telemetryListeners.forEach((listener) => {
    try {
      listener(message);
    } catch (error) {
      console.error("[mqtt] Telemetry listener error", error);
    }
  });
};

const notifyAck = (ack: AckMessage) => {
  ackListeners.forEach((listener) => {
    try {
      listener(ack);
    } catch (error) {
      console.error("[mqtt] Ack listener error", error);
    }
  });
};

const applyFanRule = (telemetry: TelemetryMessage) => {
  const { deviceId, temperature, humidity } = telemetry;
  let desired: FanState | null = null;

  if (temperature >= FAN_TEMP_ON || humidity >= FAN_HUM_ON) {
    desired = "ON";
  } else if (temperature <= FAN_TEMP_OFF && humidity <= FAN_HUM_OFF) {
    desired = "OFF";
  }

  if (!desired) return;

  const last = lastFanCommand.get(deviceId);
  if (last === desired) return;

  lastFanCommand.set(deviceId, desired);

  publishCommand(deviceId, "FAN_SET", desired, desired === "ON" ? 1 : undefined)
    .then(({ requestId }) => {
      console.log(
        `[mqtt] Fan rule sent ${desired} for ${deviceId} (request ${requestId})`,
      );
    })
    .catch((error) => {
      lastFanCommand.delete(deviceId);
      console.error("[mqtt] Fan rule publish failed", error);
    });
};

const handleTelemetryMessage = (payload: Buffer) => {
  const message = parseTelemetry(payload);
  if (!message) return;
  debugLog("Telemetry parsed", message);
  telemetryStore.set(message.deviceId, message);
  notifyTelemetry(message);
  applyFanRule(message);
};

const handleAckMessage = (payload: Buffer) => {
  const ack = parseAck(payload);
  if (!ack) return;

  debugLog("Ack parsed", ack);
  ackStore.set(ack.deviceId, ack);

  const pending = pendingCommands.get(ack.requestId);
  if (pending) {
    pendingCommands.set(ack.requestId, {
      ...pending,
      status: ack.status === "ok" ? "ok" : "error",
    });
  }

  notifyAck(ack);
};

const createMqttClient = (): MqttClient => {
  const url = process.env.MQTT_URL;
  const username = process.env.MQTT_USERNAME;
  const password = process.env.MQTT_PASSWORD;

  if (!url) {
    throw new Error("MQTT_URL env var is required to start the MQTT client");
  }

  const qos = getQoS();
  const clientId =
    process.env.MQTT_CLIENT_ID ??
    `aluna-backend-${Math.random().toString(16).slice(2)}`;

  const options: IClientOptions = {
    clientId,
    username,
    password,
    reconnectPeriod: 5000,
    clean: MQTT_CLEAN_SESSION,
    protocolVersion: 5,
  };

  const client = connect(url, options);

  client.on("connect", () => {
    console.log(`[mqtt] Connected as ${clientId}`);
    debugLog("Subscribing to topics", TELEMETRY_TOPIC, ACK_TOPIC_PATTERN);

    client.subscribe(
      [TELEMETRY_TOPIC, ackSubscribeTopic],
      { qos },
      (error, granted) => {
        if (error) {
          console.error("[mqtt] Subscribe error", error);
          return;
        }
        const topics = granted?.map((g) => g.topic) ?? [];
        console.log("[mqtt] Subscribed", topics.join(", "));
      },
    );
  });

  client.on("reconnect", () => {
    console.log("[mqtt] Reconnecting...");
  });

  client.on("error", (error) => {
    console.error("[mqtt] Client error", error);
  });

  client.on("message", (topic, payload) => {
    debugLog("Message arrived", topic, payload.toString("utf-8"));
    if (topic === TELEMETRY_TOPIC) {
      handleTelemetryMessage(payload);
    } else if (ackTopicRegex.test(topic)) {
      handleAckMessage(payload);
    }
  });

  return client;
};

const getMqttClient = (): MqttClient | null => {
  if (!process.env.MQTT_URL) {
    return null;
  }
  if (!globalMqtt.mqttClient) {
    globalMqtt.mqttClient = createMqttClient();
  }
  return globalMqtt.mqttClient;
};

if (process.env.MQTT_URL) {
  try {
    getMqttClient();
  } catch (error) {
    console.warn("[mqtt] Failed to init client at startup", error);
  }
} else {
  console.warn("[mqtt] MQTT_URL not set; MQTT client will not start (build-safe)");
}

export const onTelemetry = (
  listener: TelemetryListener,
): (() => void) => {
  telemetryListeners.add(listener);
  return () => telemetryListeners.delete(listener);
};

export const onAck = (listener: AckListener): (() => void) => {
  ackListeners.add(listener);
  return () => ackListeners.delete(listener);
};

const channelFromType = (type: CommandType): string => {
  switch (type) {
    case "LIGHT_SET":
      return "light";
    case "FAN_SET":
      return "fan";
    default:
      return String(type).toLowerCase();
  }
};

export const publishCommand = async (
  deviceId: string,
  type: CommandType,
  value: string,
  speed?: number,
): Promise<{ requestId: string }> => {
  const client = getMqttClient();
  if (!client) {
    throw new Error("MQTT_URL env var is required to publish MQTT commands");
  }
  const qos = getQoS();
  const channel = channelFromType(type);
  const topic = COMMAND_TOPIC_TEMPLATE.replace("<deviceId>", deviceId).replace(
    "<channel>",
    channel,
  );

  const requestId = randomUUID();
  const payload: CommandPayload = {
    requestId,
    deviceId,
    type,
    value,
    timestamp: Date.now(),
    ...(typeof speed === "number" ? { speed } : {}),
  };

  const pending: PendingCommand = {
    requestId,
    deviceId,
    type,
    value,
    createdAt: Date.now(),
    status: "pending",
  };

  pendingCommands.set(requestId, pending);
  debugLog("Publishing command", { topic, payload, qos });

  await new Promise<void>((resolve, reject) => {
    client.publish(topic, JSON.stringify(payload), { qos }, (error) => {
      if (error) {
        console.error(`[mqtt] Failed to publish command to ${topic}`, error);
        pendingCommands.set(requestId, { ...pending, status: "error" });
        reject(error);
      } else {
        resolve();
      }
    });
  });

  return { requestId };
};

export const stateSnapshot = () => ({
  telemetry: mapToRecord(telemetryStore),
  acks: mapToRecord(ackStore),
  pending: mapToRecord(pendingCommands),
});

const mapToRecord = <T>(map: Map<string, T>): Record<string, T> => {
  const record: Record<string, T> = {};
  map.forEach((value, key) => {
    record[key] = value;
  });
  return record;
};
