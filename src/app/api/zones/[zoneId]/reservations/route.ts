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

type ZoneParams = { zoneId: string };

export { corsOptions as OPTIONS };

export async function GET(
  request: NextRequest,
  context: { params: Promise<ZoneParams> },
) {
  const { zoneId: rawZoneId } = await context.params;
  const zoneId = parseIntParam(rawZoneId);
  if (zoneId === null) return withCors(error("Invalid zoneId", 400), request);

  try {
    const reservations = await prisma.reservation.findMany({
      where: { zoneId },
      include: { user: true },
      orderBy: { startDatetime: "asc" },
    });
    return withCors(ok(reservations), request);
  } catch (err) {
    console.error("GET /api/zones/[zoneId]/reservations", err);
    return withCors(error("Failed to fetch reservations", 500), request);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<ZoneParams> },
) {
  const { zoneId: rawZoneId } = await context.params;
  const zoneId = parseIntParam(rawZoneId);
  if (zoneId === null) return withCors(error("Invalid zoneId", 400), request);

  try {
    const body = await readJson<{
      userId?: number;
      startDatetime?: string;
      endDatetime?: string;
      status?: string;
      reservationChannel?: string;
    }>(request);

    const start = body.startDatetime ? new Date(body.startDatetime) : null;
    const end = body.endDatetime ? new Date(body.endDatetime) : null;
    if (!start || Number.isNaN(start.getTime())) {
      return withCors(
        error("startDatetime is required and must be valid", 400),
        request,
      );
    }
    if (!end || Number.isNaN(end.getTime())) {
      return withCors(
        error("endDatetime is required and must be valid", 400),
        request,
      );
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
      include: { user: true },
    });

    return withCors(ok(reservation, { status: 201 }), request);
  } catch (err) {
    console.error("POST /api/zones/[zoneId]/reservations", err);
    return withCors(error("Failed to create reservation", 500), request);
  }
}
