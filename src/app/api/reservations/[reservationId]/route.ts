import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { error, ok, parseIntParam, readJson } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReservationParams = { reservationId: string };

export async function GET(
  _request: NextRequest,
  context: { params: Promise<ReservationParams> },
) {
  const { reservationId: rawReservationId } = await context.params;
  const reservationId = parseIntParam(rawReservationId);
  if (reservationId === null) return error("Invalid reservationId", 400);

  try {
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { user: true, zone: true },
    });
    if (!reservation) return error("Reservation not found", 404);
    return ok(reservation);
  } catch (err) {
    console.error("GET /api/reservations/[reservationId]", err);
    return error("Failed to fetch reservation", 500);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<ReservationParams> },
) {
  const { reservationId: rawReservationId } = await context.params;
  const reservationId = parseIntParam(rawReservationId);
  if (reservationId === null) return error("Invalid reservationId", 400);

  try {
    const body = await readJson<{
      status?: string;
      reservationChannel?: string;
      startDatetime?: string;
      endDatetime?: string;
    }>(request);

    const data: {
      status?: string;
      reservationChannel?: string;
      startDatetime?: Date;
      endDatetime?: Date;
    } = {};

    if (body.status) data.status = body.status.trim();
    if (body.reservationChannel)
      data.reservationChannel = body.reservationChannel.trim();

    if (body.startDatetime) {
      const start = new Date(body.startDatetime);
      if (Number.isNaN(start.getTime())) {
        return error("startDatetime is invalid", 400);
      }
      data.startDatetime = start;
    }

    if (body.endDatetime) {
      const end = new Date(body.endDatetime);
      if (Number.isNaN(end.getTime())) {
        return error("endDatetime is invalid", 400);
      }
      data.endDatetime = end;
    }

    if (!Object.keys(data).length) {
      return error("No fields to update", 400);
    }

    const updated = await prisma.reservation.update({
      where: { id: reservationId },
      data,
      include: { user: true, zone: true },
    });

    return ok(updated);
  } catch (err) {
    console.error("PATCH /api/reservations/[reservationId]", err);
    return error("Failed to update reservation", 500);
  }
}
