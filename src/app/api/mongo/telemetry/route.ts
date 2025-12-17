import { NextRequest } from "next/server";
import { getMongoDb } from "@/lib/mongo";
import { corsOptions, error, ok, parseIntParam, withCors } from "@/lib/http";
import type { TelemetryEntry } from "@/types/mongo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const collectionName = "telemetry";

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
    const from = parseDate(url.searchParams.get("from"));
    const to = parseDate(url.searchParams.get("to"));
    const limit = parseIntParam(url.searchParams.get("limit")) ?? 200;
    const safeLimit = Math.max(1, Math.min(limit, 2000));

    const db = await getMongoDb();
    const filter: Record<string, unknown> = {};
    if (deviceId) filter.deviceId = deviceId;
    if (from || to) {
      const tsFilter: { $gte?: Date; $lte?: Date } = {};
      if (from) tsFilter.$gte = from;
      if (to) tsFilter.$lte = to;
      filter.created = tsFilter;
    }

    const docs = await db
      .collection<TelemetryEntry>(collectionName)
      .find(filter)
      .sort({ created: -1 })
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
    const body = (await request.json()) as Partial<TelemetryEntry>;
    if (!body?.deviceId) {
      return withCors(error("deviceId is required", 400), request);
    }
    if (typeof body.relay !== "boolean") {
      return withCors(error("relay must be boolean", 400), request);
    }

    const timestamp = typeof body.timestamp === "number" ? body.timestamp : Date.now();
    const created =
      body.created && !Number.isNaN(new Date(body.created).getTime())
        ? new Date(body.created)
        : new Date();

    const doc: TelemetryEntry = {
      deviceId: body.deviceId,
      temperature: typeof body.temperature === "number" ? body.temperature : undefined,
      humidity: typeof body.humidity === "number" ? body.humidity : undefined,
      relay: body.relay,
      button: typeof body.button === "boolean" ? body.button : undefined,
      timestamp,
      created,
    };

    const db = await getMongoDb();
    const result = await db.collection<TelemetryEntry>(collectionName).insertOne(doc);
    return withCors(
      ok({ insertedId: result.insertedId }, { status: 201 }),
      request,
    );
  } catch (err) {
    console.error("POST /api/mongo/telemetry", err);
    return withCors(error("Failed to insert telemetry", 500), request);
  }
}
