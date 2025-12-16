import { NextRequest } from "next/server";
import { getMongoDb } from "@/lib/mongo";
import { error, ok, parseIntParam } from "@/lib/http";
import type { RawTelemetry } from "@/types/mongo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const collectionName = "telemetry_raw";

const parseDate = (value?: string | null): Date | null => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const deviceId = url.searchParams.get("deviceId") ?? undefined;
    const zone = url.searchParams.get("zone") ?? undefined;
    const sensorType = url.searchParams.get("sensorType") ?? undefined;
    const from = parseDate(url.searchParams.get("from"));
    const to = parseDate(url.searchParams.get("to"));
    const limit = parseIntParam(url.searchParams.get("limit")) ?? 200;
    const safeLimit = Math.max(1, Math.min(limit, 2000));

    const db = await getMongoDb();
    const filter: Record<string, unknown> = {};
    if (deviceId) filter["metadata.deviceId"] = deviceId;
    if (zone) filter["metadata.zone"] = zone;
    if (sensorType) filter["metadata.sensorType"] = sensorType;
    if (from || to) {
      const tsFilter: { $gte?: Date; $lte?: Date } = {};
      if (from) tsFilter.$gte = from;
      if (to) tsFilter.$lte = to;
      filter.timestamp = tsFilter;
    }

    const docs = await db
      .collection<RawTelemetry>(collectionName)
      .find(filter)
      .sort({ timestamp: -1 })
      .limit(safeLimit)
      .toArray();

    return ok(docs);
  } catch (err) {
    console.error("GET /api/mongo/telemetry", err);
    return error("Failed to fetch telemetry", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RawTelemetry;
    if (!body?.metadata?.deviceId) {
      return error("metadata.deviceId is required", 400);
    }
    if (typeof body.value !== "number") {
      return error("value must be a number", 400);
    }
    const timestamp = body.timestamp ? new Date(body.timestamp) : new Date();
    if (Number.isNaN(timestamp.getTime())) {
      return error("timestamp is invalid", 400);
    }

    const doc: RawTelemetry = {
      ...body,
      timestamp,
    };

    const db = await getMongoDb();
    const result = await db.collection<RawTelemetry>(collectionName).insertOne(doc);
    return ok({ insertedId: result.insertedId }, { status: 201 });
  } catch (err) {
    console.error("POST /api/mongo/telemetry", err);
    return error("Failed to insert telemetry", 500);
  }
}
