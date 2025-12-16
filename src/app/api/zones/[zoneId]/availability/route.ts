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

const parseTime = (value?: string | null): Date | null => {
  if (!value) return null;
  const iso = `1970-01-01T${value.trim()}Z`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
};

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
    const availability = await prisma.zoneAvailability.findMany({
      where: { zoneId },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });
    return withCors(ok(availability), request);
  } catch (err) {
    console.error("GET /api/zones/[zoneId]/availability", err);
    return withCors(error("Failed to fetch availability", 500), request);
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
      dayOfWeek?: string;
      startTime?: string;
      endTime?: string;
    }>(request);

    const start = parseTime(body.startTime);
    const end = parseTime(body.endTime);

    if (!start || !end) {
      return withCors(
        error("startTime and endTime must be valid time strings (HH:mm)", 400),
        request,
      );
    }

    const availability = await prisma.zoneAvailability.create({
      data: {
        zoneId,
        dayOfWeek: body.dayOfWeek?.trim() || null,
        startTime: start,
        endTime: end,
      },
    });

    return withCors(ok(availability, { status: 201 }), request);
  } catch (err) {
    console.error("POST /api/zones/[zoneId]/availability", err);
    return withCors(error("Failed to create availability", 500), request);
  }
}
