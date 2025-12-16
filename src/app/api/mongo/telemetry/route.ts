import { NextRequest } from "next/server";
import { getMongoDb } from "@/lib/mongo";
import { corsOptions, error, ok, parseIntParam, withCors } from "@/lib/http";
import type { RawTelemetry } from "@/types/mongo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const collectionName = "telemetry_raw";

const parseDate = (value?: string | null): Date | null => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

export { corsOptions as OPTIONS };

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

    return withCors(ok(docs), request);
  } catch (err) {
    console.error("GET /api/mongo/telemetry", err);
    return withCors(error("Failed to fetch telemetry", 500), request);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RawTelemetry;
    if (!body?.metadata?.deviceId) {
      return withCors(error("metadata.deviceId is required", 400), request);
    }
    if (typeof body.value !== "number") {
      return withCors(error("value must be a number", 400), request);
    }
    const timestamp = body.timestamp ? new Date(body.timestamp) : new Date();
    if (Number.isNaN(timestamp.getTime())) {
      return withCors(error("timestamp is invalid", 400), request);
    }

    const doc: RawTelemetry = {
      ...body,
      timestamp,
    };

    const db = await getMongoDb();
    const result = await db.collection<RawTelemetry>(collectionName).insertOne(doc);
    return withCors(
      ok({ insertedId: result.insertedId }, { status: 201 }),
      request,
    );
  } catch (err) {
    console.error("POST /api/mongo/telemetry", err);
    return withCors(error("Failed to insert telemetry", 500), request);
  }
}
