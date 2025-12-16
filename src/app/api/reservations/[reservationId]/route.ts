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

type ReservationParams = { reservationId: string };

export { corsOptions as OPTIONS };

export async function GET(
  request: NextRequest,
  context: { params: Promise<ReservationParams> },
) {
  const { reservationId: rawReservationId } = await context.params;
  const reservationId = parseIntParam(rawReservationId);
  if (reservationId === null)
    return withCors(error("Invalid reservationId", 400), request);

  try {
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { user: true, zone: true },
    });
    if (!reservation)
      return withCors(error("Reservation not found", 404), request);
    return withCors(ok(reservation), request);
  } catch (err) {
    console.error("GET /api/reservations/[reservationId]", err);
    return withCors(error("Failed to fetch reservation", 500), request);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<ReservationParams> },
) {
  const { reservationId: rawReservationId } = await context.params;
  const reservationId = parseIntParam(rawReservationId);
  if (reservationId === null)
    return withCors(error("Invalid reservationId", 400), request);

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
        return withCors(error("startDatetime is invalid", 400), request);
      }
      data.startDatetime = start;
    }

    if (body.endDatetime) {
      const end = new Date(body.endDatetime);
      if (Number.isNaN(end.getTime())) {
        return withCors(error("endDatetime is invalid", 400), request);
      }
      data.endDatetime = end;
    }

    if (!Object.keys(data).length) {
      return withCors(error("No fields to update", 400), request);
    }

    const updated = await prisma.reservation.update({
      where: { id: reservationId },
      data,
      include: { user: true, zone: true },
    });

    return withCors(ok(updated), request);
  } catch (err) {
    console.error("PATCH /api/reservations/[reservationId]", err);
    return withCors(error("Failed to update reservation", 500), request);
  }
}
