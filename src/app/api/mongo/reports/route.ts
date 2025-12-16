import { NextRequest } from "next/server";
import { getMongoDb } from "@/lib/mongo";
import { error, ok, parseIntParam } from "@/lib/http";
import type { ReporteGenerado } from "@/types/mongo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const collectionName = "reportes_generados";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const tipo = url.searchParams.get("tipo") ?? undefined;
    const periodo = url.searchParams.get("periodo") ?? undefined;
    const zonaId = parseIntParam(url.searchParams.get("zona_id"));
    const limit = parseIntParam(url.searchParams.get("limit")) ?? 100;
    const safeLimit = Math.max(1, Math.min(limit, 500));

    const filter: Record<string, unknown> = {};
    if (tipo) filter.tipo = tipo;
    if (periodo) filter.periodo = periodo;
    if (zonaId !== null) filter.zona_id = zonaId;

    const db = await getMongoDb();
    const docs = await db
      .collection<ReporteGenerado>(collectionName)
      .find(filter)
      .sort({ creado_en: -1 })
      .limit(safeLimit)
      .toArray();

    return ok(docs);
  } catch (err) {
    console.error("GET /api/mongo/reports", err);
    return error("Failed to fetch reports", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ReporteGenerado;
    if (!body?.tipo) return error("tipo is required", 400);

    const creado_en = body.creado_en ? new Date(body.creado_en) : new Date();
    if (Number.isNaN(creado_en.getTime())) {
      return error("creado_en is invalid", 400);
    }

    const doc: ReporteGenerado = {
      ...body,
      creado_en,
    };

    const db = await getMongoDb();
    const result = await db
      .collection<ReporteGenerado>(collectionName)
      .insertOne(doc);

    return ok({ insertedId: result.insertedId }, { status: 201 });
  } catch (err) {
    console.error("POST /api/mongo/reports", err);
    return error("Failed to insert report", 500);
  }
}
