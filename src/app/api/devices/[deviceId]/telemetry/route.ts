import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { error, ok, parseIntParam, parseUUID } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DeviceParams = { deviceId: string };

export async function GET(
  request: NextRequest,
  context: { params: Promise<DeviceParams> },
) {
  const { deviceId: rawDeviceId } = await context.params;
  const deviceId = parseUUID(rawDeviceId);
  if (!deviceId) return error("Invalid deviceId", 400);

  try {
    const url = new URL(request.url);
    const limit = parseIntParam(url.searchParams.get("limit")) ?? 50;
    const safeLimit = Math.max(1, Math.min(limit, 500));

    const telemetry = await prisma.telemetry.findMany({
      where: { sensor: { deviceId } },
      include: {
        sensor: {
          select: {
            id: true,
            sensorType: true,
            unit: true,
          },
        },
      },
      orderBy: { timestamp: "desc" },
      take: safeLimit,
    });

    return ok(telemetry);
  } catch (err) {
    console.error("GET /api/devices/[deviceId]/telemetry", err);
    return error("Failed to fetch telemetry", 500);
  }
}
