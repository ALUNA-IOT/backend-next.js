export interface RawTelemetry {
  _id?: unknown;
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
  _id?: unknown;
  event: string;
  affectedZone?: string;
  details?: Record<string, unknown>;
  date: string | Date;
  status?: string;
}

export interface GeneratedReport {
  _id?: unknown;
  type: string;
  period?: string;
  zoneId?: number;
  summary?: Record<string, unknown>;
  dataPoints?: unknown[];
  createdAt?: string | Date;
}
