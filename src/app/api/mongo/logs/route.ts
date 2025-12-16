import { NextRequest } from "next/server";
import { getMongoDb } from "@/lib/mongo";
import { error, ok, parseIntParam } from "@/lib/http";
import type { AutomationLog } from "@/types/mongo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const collectionName = "automation_logs";

const parseDate = (value?: string | null): Date | null => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const event = url.searchParams.get("event") ?? undefined;
    const affectedZone = url.searchParams.get("affectedZone") ?? undefined;
    const status = url.searchParams.get("status") ?? undefined;
    const from = parseDate(url.searchParams.get("from"));
    const to = parseDate(url.searchParams.get("to"));
    const limit = parseIntParam(url.searchParams.get("limit")) ?? 200;
    const safeLimit = Math.max(1, Math.min(limit, 2000));

    const filter: Record<string, unknown> = {};
    if (event) filter.event = event;
    if (affectedZone) filter.affectedZone = affectedZone;
    if (status) filter.status = status;
    if (from || to) {
      const dateFilter: { $gte?: Date; $lte?: Date } = {};
      if (from) dateFilter.$gte = from;
      if (to) dateFilter.$lte = to;
      filter.date = dateFilter;
    }

    const db = await getMongoDb();
    const docs = await db
      .collection<AutomationLog>(collectionName)
      .find(filter)
      .sort({ date: -1 })
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
    const body = (await request.json()) as AutomationLog;
    if (!body?.event) {
      return error("event is required", 400);
    }
    const date = body.date ? new Date(body.date) : new Date();
    if (Number.isNaN(date.getTime())) {
      return error("date is invalid", 400);
    }

    const doc: AutomationLog = {
      ...body,
      date,
    };

    const db = await getMongoDb();
    const result = await db.collection<AutomationLog>(collectionName).insertOne(doc);
    return ok({ insertedId: result.insertedId }, { status: 201 });
  } catch (err) {
    console.error("POST /api/mongo/logs", err);
    return error("Failed to insert automation log", 500);
  }
}
