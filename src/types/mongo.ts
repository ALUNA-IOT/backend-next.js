import type { ObjectId } from "mongodb";

// Telemetry document as stored in MongoDB
export interface TelemetryEntry {
  _id?: ObjectId;
  deviceId: string;
  temperature?: number;
  humidity?: number;
  relay: boolean;
  button?: boolean;
  timestamp: number; // device timestamp or sequence (every 5 minutes)
  created: string | Date; // server-side ISO timestamp
}

// Automation log (kept for compatibility with existing collection)
export interface AutomationLog {
  _id?: ObjectId;
  event: string;
  affectedZone?: string;
  details?: Record<string, unknown>;
  date: string | Date;
  status?: string;
}

// Energy report stored in collection "reportes"
export interface EnergyReport {
  _id?: ObjectId;
  reportId: string;
  createdAt: string | Date;
  deviceId?: string;
  from: string | Date;
  to: string | Date;
  totalReadings: number;
  relayOnCount: number;
  relayOffCount: number;
  assumedIntervalMinutes: number;
  kwRating: number;
  energyKwh: number;
  onMinutes: number;
  offMinutes: number;
  notes?: string;
}
