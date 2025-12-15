import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { error, ok, parseIntParam, readJson } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get("status") ?? undefined;
    const zoneId = parseIntParam(url.searchParams.get("zoneId"));
    const userId = parseIntParam(url.searchParams.get("userId"));

    const reservations = await prisma.reservation.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(zoneId !== null ? { zoneId } : {}),
        ...(userId !== null ? { userId } : {}),
      },
      include: { user: true, zone: true },
      orderBy: { startDatetime: "desc" },
      take: 200,
    });

    return ok(reservations);
  } catch (err) {
    console.error("GET /api/reservations", err);
    return error("Failed to fetch reservations", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await readJson<{
      zoneId?: number;
      userId?: number;
      startDatetime?: string;
      endDatetime?: string;
      status?: string;
      reservationChannel?: string;
    }>(request);

    const zoneId = body.zoneId;
    if (typeof zoneId !== "number") {
      return error("zoneId is required", 400);
    }

    const start = body.startDatetime ? new Date(body.startDatetime) : null;
    const end = body.endDatetime ? new Date(body.endDatetime) : null;
    if (!start || Number.isNaN(start.getTime())) {
      return error("startDatetime is required and must be valid", 400);
    }
    if (!end || Number.isNaN(end.getTime())) {
      return error("endDatetime is required and must be valid", 400);
    }

    const reservation = await prisma.reservation.create({
      data: {
        zoneId,
        userId: body.userId ?? null,
        startDatetime: start,
        endDatetime: end,
        status: body.status?.trim() || "pending",
        reservationChannel: body.reservationChannel?.trim() || "web",
      },
      include: { user: true, zone: true },
    });

    return ok(reservation, { status: 201 });
  } catch (err) {
    console.error("POST /api/reservations", err);
    return error("Failed to create reservation", 500);
  }
}
