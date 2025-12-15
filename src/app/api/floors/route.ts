import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { error, ok, readJson } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
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

    return ok(floors);
  } catch (err) {
    console.error("GET /api/floors", err);
    return error("Failed to fetch floors", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await readJson<{ floorNumber?: number; floorName?: string }>(
      request,
    );
    if (typeof body.floorNumber !== "number") {
      return error("floorNumber is required and must be a number", 400);
    }

    const floor = await prisma.floor.create({
      data: {
        floorNumber: body.floorNumber,
        floorName: body.floorName?.trim() || null,
      },
    });

    return ok(floor, { status: 201 });
  } catch (err) {
    console.error("POST /api/floors", err);
    return error("Failed to create floor", 500);
  }
}
