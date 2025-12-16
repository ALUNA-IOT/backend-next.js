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
    const floorId = parseIntParam(url.searchParams.get("floorId"));

    const zones = await prisma.zone.findMany({
      where: {
        ...(floorId !== null ? { floorId } : {}),
      },
      include: {
        floor: true,
        availability: true,
      },
      orderBy: { zoneName: "asc" },
    });

    return withCors(ok(zones), request);
  } catch (err) {
    console.error("GET /api/zones", err);
    return withCors(error("Failed to fetch zones", 500), request);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await readJson<{
      floorId?: number;
      zoneName?: string;
      zoneType?: string;
      description?: string;
      idealTemperature?: number;
      capacity?: number;
    }>(request);

    const zoneName = body.zoneName?.trim();
    if (!zoneName) {
      return withCors(error("zoneName is required", 400), request);
    }

    const zone = await prisma.zone.create({
      data: {
        floorId: body.floorId ?? null,
        zoneName,
        zoneType: body.zoneType?.trim() || null,
        description: body.description?.trim() || null,
        idealTemperature:
          typeof body.idealTemperature === "number"
            ? body.idealTemperature
            : null,
        capacity: typeof body.capacity === "number" ? body.capacity : null,
      },
    });

    return withCors(ok(zone, { status: 201 }), request);
  } catch (err) {
    console.error("POST /api/zones", err);
    return withCors(error("Failed to create zone", 500), request);
  }
}
