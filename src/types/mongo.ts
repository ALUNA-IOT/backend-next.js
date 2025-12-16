import type { ObjectId } from "mongodb";

export interface RawTelemetry {
  _id?: ObjectId;
  metadata: {
    deviceId: string;
    zone?: string;
    sensorType?: string;
  };
  value: number;
  unit?: string;
  timestamp: string | Date;
  n8nExecutionId?: string;
}

export interface AutomationLog {
  _id?: ObjectId;
  event: string;
  affectedZone?: string;
  details?: Record<string, unknown>;
  date: string | Date;
  status?: string;
}

export interface GeneratedReport {
  _id?: ObjectId;
  type: string;
  period?: string;
  zoneId?: number;
  summary?: Record<string, unknown>;
  dataPoints?: unknown[];
  createdAt?: string | Date;
}
