import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  corsOptions,
  error,
  ok,
  parseIntParam,
  parseUUID,
  withCors,
} from "@/lib/http";
import { getMongoDb } from "@/lib/mongo";
import type { TelemetryEntry } from "@/types/mongo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export { corsOptions as OPTIONS };

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

    // Preload latest telemetry per device from Mongo as fallback when SQL has no rows
    const deviceIds = Array.from(
      new Set(sensors.map((s) => s.deviceId).filter(Boolean)),
    ) as string[];
    let mongoLatest: Record<string, TelemetryEntry> = {};

    if (deviceIds.length) {
      try {
        const db = await getMongoDb();
        const docs = await db
          .collection<TelemetryEntry>("telemetry")
          .aggregate([
            { $match: { deviceId: { $in: deviceIds } } },
            { $sort: { created: -1 } },
            { $group: { _id: "$deviceId", doc: { $first: "$$ROOT" } } },
          ])
          .toArray();
        mongoLatest = Object.fromEntries(
          docs
            .map((d) => d.doc)
            .filter((d): d is TelemetryEntry => Boolean(d?.deviceId))
            .map((d) => [d.deviceId, d]),
        );
      } catch (mongoErr) {
        console.warn(
          "[telemetry/latest] Mongo fallback unavailable",
          (mongoErr as Error)?.message ?? mongoErr,
        );
      }
    }

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
      latest:
        sensor.telemetry[0] ??
        (sensor.deviceId ? mongoLatest[sensor.deviceId] ?? null : null),
    }));

    return withCors(ok(payload), request);
  } catch (err) {
    console.error("GET /api/telemetry/latest", err);
    return withCors(error("Failed to fetch telemetry", 500), request);
  }
}
