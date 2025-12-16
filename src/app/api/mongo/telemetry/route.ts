import { NextRequest } from "next/server";
import { getMongoDb } from "@/lib/mongo";
import { error, ok, parseIntParam } from "@/lib/http";
import type { TelemetriaRaw } from "@/types/mongo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const collectionName = "telemetria_raw";

const parseDate = (value?: string | null): Date | null => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const dispositivo = url.searchParams.get("dispositivo_id") ?? undefined;
    const zona = url.searchParams.get("zona") ?? undefined;
    const tipo = url.searchParams.get("tipo_sensor") ?? undefined;
    const from = parseDate(url.searchParams.get("from"));
    const to = parseDate(url.searchParams.get("to"));
    const limit = parseIntParam(url.searchParams.get("limit")) ?? 200;
    const safeLimit = Math.max(1, Math.min(limit, 2000));

    const db = await getMongoDb();
    const filter: Record<string, unknown> = {};
    if (dispositivo) filter["metadata.dispositivo_id"] = dispositivo;
    if (zona) filter["metadata.zona"] = zona;
    if (tipo) filter["metadata.tipo_sensor"] = tipo;
    if (from || to) {
      filter.timestamp = {};
      if (from) filter.timestamp.$gte = from;
      if (to) filter.timestamp.$lte = to;
    }

    const docs = await db
      .collection<TelemetriaRaw>(collectionName)
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
    const body = (await request.json()) as TelemetriaRaw;
    if (!body?.metadata?.dispositivo_id) {
      return error("metadata.dispositivo_id is required", 400);
    }
    if (typeof body.valor !== "number") {
      return error("valor must be a number", 400);
    }
    const timestamp = body.timestamp ? new Date(body.timestamp) : new Date();
    if (Number.isNaN(timestamp.getTime())) {
      return error("timestamp is invalid", 400);
    }

    const doc: TelemetriaRaw = {
      ...body,
      timestamp,
    };

    const db = await getMongoDb();
    const result = await db.collection<TelemetriaRaw>(collectionName).insertOne(doc);
    return ok({ insertedId: result.insertedId }, { status: 201 });
  } catch (err) {
    console.error("POST /api/mongo/telemetry", err);
    return error("Failed to insert telemetry", 500);
  }
}
