import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  corsOptions,
  error,
  ok,
  parseIntParam,
  readJson,
  withCors,
} from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export { corsOptions as OPTIONS };

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const sensorId = parseIntParam(url.searchParams.get("sensorId"));
    const limit = parseIntParam(url.searchParams.get("limit")) ?? 100;
    const safeLimit = Math.max(1, Math.min(limit, 500));

    const telemetry = await prisma.telemetry.findMany({
      where: {
        ...(sensorId !== null ? { sensorId } : {}),
      },
      include: { sensor: true },
      orderBy: { timestamp: "desc" },
      take: safeLimit,
    });

    return withCors(ok(telemetry), request);
  } catch (err) {
    console.error("GET /api/telemetry", err);
    return withCors(error("Failed to fetch telemetry", 500), request);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await readJson<{
      sensorId?: number;
      value?: number;
      timestamp?: string;
    }>(request);

    if (typeof body.sensorId !== "number") {
      return withCors(error("sensorId is required", 400), request);
    }
    if (typeof body.value !== "number") {
      return withCors(
        error("value is required and must be a number", 400),
        request,
      );
    }

    const timestamp = body.timestamp ? new Date(body.timestamp) : new Date();
    if (Number.isNaN(timestamp.getTime())) {
      return withCors(error("timestamp is invalid", 400), request);
    }

    const telemetry = await prisma.telemetry.create({
      data: {
        sensorId: body.sensorId,
        value: body.value,
        timestamp,
      },
    });

    return withCors(ok(telemetry, { status: 201 }), request);
  } catch (err) {
    console.error("POST /api/telemetry", err);
    return withCors(error("Failed to create telemetry", 500), request);
  }
}
