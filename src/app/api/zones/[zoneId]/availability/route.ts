import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { error, ok, parseIntParam, readJson } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const parseTime = (value?: string | null): Date | null => {
  if (!value) return null;
  const iso = `1970-01-01T${value.trim()}Z`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
};

type ZoneParams = { zoneId: string };

export async function GET(
  _request: NextRequest,
  context: { params: Promise<ZoneParams> },
) {
  const { zoneId: rawZoneId } = await context.params;
  const zoneId = parseIntParam(rawZoneId);
  if (zoneId === null) return error("Invalid zoneId", 400);

  try {
    const availability = await prisma.zoneAvailability.findMany({
      where: { zoneId },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });
    return ok(availability);
  } catch (err) {
    console.error("GET /api/zones/[zoneId]/availability", err);
    return error("Failed to fetch availability", 500);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<ZoneParams> },
) {
  const { zoneId: rawZoneId } = await context.params;
  const zoneId = parseIntParam(rawZoneId);
  if (zoneId === null) return error("Invalid zoneId", 400);

  try {
    const body = await readJson<{
      dayOfWeek?: string;
      startTime?: string;
      endTime?: string;
    }>(request);

    const start = parseTime(body.startTime);
    const end = parseTime(body.endTime);

    if (!start || !end) {
      return error("startTime and endTime must be valid time strings (HH:mm)", 400);
    }

    const availability = await prisma.zoneAvailability.create({
      data: {
        zoneId,
        dayOfWeek: body.dayOfWeek?.trim() || null,
        startTime: start,
        endTime: end,
      },
    });

    return ok(availability, { status: 201 });
  } catch (err) {
    console.error("POST /api/zones/[zoneId]/availability", err);
    return error("Failed to create availability", 500);
  }
}
