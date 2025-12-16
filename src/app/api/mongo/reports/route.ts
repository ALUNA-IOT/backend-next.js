import { NextRequest } from "next/server";
import { getMongoDb } from "@/lib/mongo";
import { corsOptions, error, ok, parseIntParam, withCors } from "@/lib/http";
import type { GeneratedReport } from "@/types/mongo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const collectionName = "generated_reports";

export { corsOptions as OPTIONS };

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const type = url.searchParams.get("type") ?? undefined;
    const period = url.searchParams.get("period") ?? undefined;
    const zoneId = parseIntParam(url.searchParams.get("zoneId"));
    const limit = parseIntParam(url.searchParams.get("limit")) ?? 100;
    const safeLimit = Math.max(1, Math.min(limit, 500));

    const filter: Record<string, unknown> = {};
    if (type) filter.type = type;
    if (period) filter.period = period;
    if (zoneId !== null) filter.zoneId = zoneId;

    const db = await getMongoDb();
    const docs = await db
      .collection<GeneratedReport>(collectionName)
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(safeLimit)
      .toArray();

    return withCors(ok(docs), request);
  } catch (err) {
    console.error("GET /api/mongo/reports", err);
    return withCors(error("Failed to fetch reports", 500), request);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GeneratedReport;
    if (!body?.type) return withCors(error("type is required", 400), request);

    const createdAt = body.createdAt ? new Date(body.createdAt) : new Date();
    if (Number.isNaN(createdAt.getTime())) {
      return withCors(error("createdAt is invalid", 400), request);
    }

    const doc: GeneratedReport = {
      ...body,
      createdAt,
    };

    const db = await getMongoDb();
    const result = await db
      .collection<GeneratedReport>(collectionName)
      .insertOne(doc);

    return withCors(
      ok({ insertedId: result.insertedId }, { status: 201 }),
      request,
    );
  } catch (err) {
    console.error("POST /api/mongo/reports", err);
    return withCors(error("Failed to insert report", 500), request);
  }
}
