import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { error, ok, parseIntParam, parseUUID, readJson } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const zoneId = parseIntParam(url.searchParams.get("zoneId"));
    const deviceId = parseUUID(url.searchParams.get("deviceId"));

    const actuators = await prisma.actuator.findMany({
      where: {
        ...(zoneId !== null ? { zoneId } : {}),
        ...(deviceId ? { deviceId } : {}),
      },
      include: {
        device: true,
        zone: true,
        states: { orderBy: { timestamp: "desc" }, take: 1 },
      },
      orderBy: { id: "asc" },
      take: 200,
    });

    return ok(actuators);
  } catch (err) {
    console.error("GET /api/actuators", err);
    return error("Failed to fetch actuators", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await readJson<{
      deviceId?: string;
      zoneId?: number;
      actuatorType?: string;
      channel?: number;
      supportsIntensity?: boolean;
      supportsSpeed?: boolean;
      supportsFanLight?: boolean;
      description?: string;
    }>(request);

    const actuatorType = body.actuatorType?.trim();
    if (!actuatorType) return error("actuatorType is required", 400);
    if (typeof body.channel !== "number") {
      return error("channel is required and must be a number", 400);
    }

    const deviceId = body.deviceId ? parseUUID(body.deviceId) : null;

    const actuator = await prisma.actuator.create({
      data: {
        deviceId: deviceId ?? null,
        zoneId: body.zoneId ?? null,
        actuatorType,
        channel: body.channel,
        supportsIntensity: body.supportsIntensity ?? false,
        supportsSpeed: body.supportsSpeed ?? false,
        supportsFanLight: body.supportsFanLight ?? false,
        description: body.description?.trim() || null,
      },
    });

    return ok(actuator, { status: 201 });
  } catch (err) {
    console.error("POST /api/actuators", err);
    return error("Failed to create actuator", 500);
  }
}
