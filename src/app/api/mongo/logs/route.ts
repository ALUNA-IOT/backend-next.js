import { NextRequest } from "next/server";
import { getMongoDb } from "@/lib/mongo";
import { error, ok, parseIntParam } from "@/lib/http";
import type { LogAutomatizacion } from "@/types/mongo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const collectionName = "logs_automatizacion";

const parseDate = (value?: string | null): Date | null => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const evento = url.searchParams.get("evento") ?? undefined;
    const zona = url.searchParams.get("zona_afectada") ?? undefined;
    const estado = url.searchParams.get("estado") ?? undefined;
    const from = parseDate(url.searchParams.get("from"));
    const to = parseDate(url.searchParams.get("to"));
    const limit = parseIntParam(url.searchParams.get("limit")) ?? 200;
    const safeLimit = Math.max(1, Math.min(limit, 2000));

    const filter: Record<string, unknown> = {};
    if (evento) filter.evento = evento;
    if (zona) filter.zona_afectada = zona;
    if (estado) filter.estado = estado;
    if (from || to) {
      filter.fecha = {};
      if (from) filter.fecha.$gte = from;
      if (to) filter.fecha.$lte = to;
    }

    const db = await getMongoDb();
    const docs = await db
      .collection<LogAutomatizacion>(collectionName)
      .find(filter)
      .sort({ fecha: -1 })
      .limit(safeLimit)
      .toArray();

    return ok(docs);
  } catch (err) {
    console.error("GET /api/mongo/logs", err);
    return error("Failed to fetch automation logs", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as LogAutomatizacion;
    if (!body?.evento) {
      return error("evento is required", 400);
    }
    const fecha = body.fecha ? new Date(body.fecha) : new Date();
    if (Number.isNaN(fecha.getTime())) {
      return error("fecha is invalid", 400);
    }

    const doc: LogAutomatizacion = {
      ...body,
      fecha,
    };

    const db = await getMongoDb();
    const result = await db.collection<LogAutomatizacion>(collectionName).insertOne(doc);
    return ok({ insertedId: result.insertedId }, { status: 201 });
  } catch (err) {
    console.error("POST /api/mongo/logs", err);
    return error("Failed to insert automation log", 500);
  }
}
