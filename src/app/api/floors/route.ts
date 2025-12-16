import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { corsOptions, error, ok, readJson, withCors } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export { corsOptions as OPTIONS };

export async function GET(request: NextRequest) {
  try {
    const floors = await prisma.floor.findMany({
      include: {
        zones: {
          select: {
            id: true,
            zoneName: true,
            zoneType: true,
            capacity: true,
          },
        },
      },
      orderBy: { floorNumber: "asc" },
    });

    return withCors(ok(floors), request);
  } catch (err) {
    console.error("GET /api/floors", err);
    return withCors(error("Failed to fetch floors", 500), request);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await readJson<{ floorNumber?: number; floorName?: string }>(
      request,
    );
    if (typeof body.floorNumber !== "number") {
      return withCors(
        error("floorNumber is required and must be a number", 400),
        request,
      );
    }

    const floor = await prisma.floor.create({
      data: {
        floorNumber: body.floorNumber,
        floorName: body.floorName?.trim() || null,
      },
    });

    return withCors(ok(floor, { status: 201 }), request);
  } catch (err) {
    console.error("POST /api/floors", err);
    return withCors(error("Failed to create floor", 500), request);
  }
}
