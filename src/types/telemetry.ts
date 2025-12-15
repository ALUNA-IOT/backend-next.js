export type CommandType = "LIGHT_SET" | "FAN_SET";

export interface TelemetryMessage {
  deviceId: string;
  temperature: number;
  humidity: number;
  timestamp: number;
}

export interface AckMessage {
  requestId: string;
  deviceId: string;
  status: string;
  receivedAt: number;
  message?: string;
}

export interface PendingCommand {
  requestId: string;
  deviceId: string;
  type: CommandType;
  value: string;
  createdAt: number;
  status: "pending" | "ok" | "error";
}

export interface CommandPayload {
  requestId: string;
  deviceId: string;
  type: CommandType;
  value: string;
  speed?: number;
  timestamp: number;
}
