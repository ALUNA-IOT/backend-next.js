import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  corsOptions,
  error,
  ok,
  parseIntParam,
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
    const zoneId = parseIntParam(url.searchParams.get("zoneId"));
    const floorId = parseIntParam(url.searchParams.get("floorId"));

    const devices = await prisma.device.findMany({
      where: {
        ...(zoneId !== null ? { zoneId } : {}),
        ...(floorId !== null ? { zone: { floorId } } : {}),
      },
      include: {
        zone: { include: { floor: true } },
        sensors: true,
        actuators: {
          include: {
            states: { orderBy: { timestamp: "desc" }, take: 1 },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return withCors(ok(devices), request);
  } catch (err) {
    console.error("GET /api/devices", err);
    return withCors(error("Failed to fetch devices", 500), request);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await readJson<{
      deviceId?: string;
      zoneId?: number;
      deviceName?: string;
      deviceType?: string;
      chipId?: string;
      macAddress?: string;
      firmwareVersion?: string;
      isOnline?: boolean;
      mqttTopic?: string;
    }>(request);

    const deviceName = body.deviceName?.trim();
    if (!deviceName)
      return withCors(error("deviceName is required", 400), request);

    const deviceId = parseUUID(body.deviceId ?? null);

    const device = await prisma.device.create({
      data: {
        id: deviceId ?? undefined,
        zoneId: body.zoneId ?? null,
        deviceName,
        deviceType: body.deviceType?.trim() || null,
        chipId: body.chipId?.trim() || null,
        macAddress: body.macAddress?.trim() || null,
        firmwareVersion: body.firmwareVersion?.trim() || null,
        isOnline: body.isOnline ?? false,
        mqttTopic: body.mqttTopic?.trim() || null,
      },
    });

    return withCors(ok(device, { status: 201 }), request);
  } catch (err) {
    console.error("POST /api/devices", err);
    return withCors(error("Failed to create device", 500), request);
  }
}
