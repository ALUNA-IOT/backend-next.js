import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  corsOptions,
  error,
  ok,
  parseUUID,
  readJson,
  withCors,
} from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export { corsOptions as OPTIONS };

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const deviceId = parseUUID(url.searchParams.get("deviceId"));

    const sensors = await prisma.sensor.findMany({
      where: {
        ...(deviceId ? { deviceId } : {}),
      },
      include: {
        device: true,
        telemetry: { orderBy: { timestamp: "desc" }, take: 1 },
      },
      orderBy: { id: "desc" },
      take: 200,
    });

    return withCors(ok(sensors), request);
  } catch (err) {
    console.error("GET /api/sensors", err);
    return withCors(error("Failed to fetch sensors", 500), request);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await readJson<{
      deviceId?: string;
      sensorType?: string;
      unit?: string;
      description?: string;
    }>(request);

    const deviceId = body.deviceId ? parseUUID(body.deviceId) : null;
    const sensorType = body.sensorType?.trim();
    if (!sensorType)
      return withCors(error("sensorType is required", 400), request);

    const sensor = await prisma.sensor.create({
      data: {
        deviceId: deviceId ?? null,
        sensorType,
        unit: body.unit?.trim() || null,
        description: body.description?.trim() || null,
      },
    });

    return withCors(ok(sensor, { status: 201 }), request);
  } catch (err) {
    console.error("POST /api/sensors", err);
    return withCors(error("Failed to create sensor", 500), request);
  }
}
