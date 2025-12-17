import { NextRequest } from "next/server";
import { getMongoDb } from "@/lib/mongo";
import { corsOptions, error, ok, withCors } from "@/lib/http";
import type { EnergyReport, TelemetryEntry } from "@/types/mongo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const reportCollection = "reportes";
const telemetryCollection = "telemetry";
const DEFAULT_INTERVAL_MINUTES = 5;
const DEFAULT_KW_RATING =
  Number(process.env.ENERGY_KW_WHEN_ON ?? "0.06") || 0.06;

export { corsOptions as OPTIONS };

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const deviceId = url.searchParams.get("deviceId") ?? undefined;
    const limit = parseIntParam(url.searchParams.get("limit")) ?? 100;
    const safeLimit = Math.max(1, Math.min(limit, 500));
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    const filter: Record<string, unknown> = {};
    if (deviceId) filter.deviceId = deviceId;
    if (from || to) {
      const range: { $gte?: Date; $lte?: Date } = {};
      if (from) {
        const parsed = new Date(from);
        if (!Number.isNaN(parsed.getTime())) range.$gte = parsed;
      }
      if (to) {
        const parsed = new Date(to);
        if (!Number.isNaN(parsed.getTime())) range.$lte = parsed;
      }
      if (range.$gte || range.$lte) filter.createdAt = range;
    }

    const db = await getMongoDb();
    const docs = await db
      .collection<EnergyReport>(reportCollection)
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
    const body = (await request.json()) as {
      deviceId?: string;
      from?: string;
      to?: string;
      intervalMinutes?: number;
      kwRating?: number;
      notes?: string;
    };

    const now = new Date();
    const toDate =
      body.to && !Number.isNaN(new Date(body.to).getTime())
        ? new Date(body.to)
        : now;
    const fromDate =
      body.from && !Number.isNaN(new Date(body.from).getTime())
        ? new Date(body.from)
        : new Date(toDate.getTime() - 24 * 60 * 60 * 1000); // last 24h by default

    const intervalMinutes =
      typeof body.intervalMinutes === "number" && body.intervalMinutes > 0
        ? body.intervalMinutes
        : DEFAULT_INTERVAL_MINUTES;
    const kwRating =
      typeof body.kwRating === "number" && body.kwRating > 0
        ? body.kwRating
        : DEFAULT_KW_RATING;

    const db = await getMongoDb();
    const telemetryFilter: Record<string, unknown> = {
      created: { $gte: fromDate, $lte: toDate },
    };
    if (body.deviceId) telemetryFilter.deviceId = body.deviceId;

    const readings = await db
      .collection<TelemetryEntry>(telemetryCollection)
      .find(telemetryFilter)
      .sort({ created: 1 })
      .toArray();

    if (!readings.length) {
      return withCors(error("No telemetry found for the requested period", 404), request);
    }

    const relayOnCount = readings.filter((r) => r.relay === true).length;
    const relayOffCount = readings.length - relayOnCount;

    const onMinutes = relayOnCount * intervalMinutes;
    const offMinutes = relayOffCount * intervalMinutes;
    const energyKwh = (onMinutes / 60) * kwRating;

    const report: EnergyReport = {
      reportId: `energy-${body.deviceId ?? "all"}-${now.toISOString()}`,
      createdAt: now,
      deviceId: body.deviceId,
      from: fromDate,
      to: toDate,
      totalReadings: readings.length,
      relayOnCount,
      relayOffCount,
      assumedIntervalMinutes: intervalMinutes,
      kwRating,
      energyKwh,
      onMinutes,
      offMinutes,
      notes:
        body.notes ??
        "Energy consumption based on relay ON readings at fixed interval minutes.",
    };

    const result = await db
      .collection<EnergyReport>(reportCollection)
      .insertOne(report);

    return withCors(
      ok({ insertedId: result.insertedId, report }, { status: 201 }),
      request,
    );
  } catch (err) {
    console.error("POST /api/mongo/reports", err);
    return withCors(error("Failed to insert report", 500), request);
  }
}
