import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { error, ok, parseIntParam, parseUUID } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const deviceId = parseUUID(url.searchParams.get("deviceId"));
    const zoneId = parseIntParam(url.searchParams.get("zoneId"));

    const sensors = await prisma.sensor.findMany({
      where: {
        ...(deviceId ? { deviceId } : {}),
        ...(zoneId !== null ? { device: { zoneId } } : {}),
      },
      include: {
        device: {
          include: {
            zone: { include: { floor: true } },
          },
        },
        telemetry: { orderBy: { timestamp: "desc" }, take: 1 },
      },
      orderBy: { id: "asc" },
      take: 500,
    });

    const payload = sensors.map((sensor) => ({
      sensorId: sensor.id,
      sensorType: sensor.sensorType,
      unit: sensor.unit,
      description: sensor.description,
      device: sensor.device
        ? {
            id: sensor.device.id,
            deviceName: sensor.device.deviceName,
            zoneId: sensor.device.zoneId,
            zoneName: sensor.device.zone?.zoneName ?? null,
            floorNumber: sensor.device.zone?.floor?.floorNumber ?? null,
          }
        : null,
      latest: sensor.telemetry[0] ?? null,
    }));

    return ok(payload);
  } catch (err) {
    console.error("GET /api/telemetry/latest", err);
    return error("Failed to fetch telemetry", 500);
  }
}
