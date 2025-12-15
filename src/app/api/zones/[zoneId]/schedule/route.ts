import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { error, ok, parseIntParam, readJson } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ZoneParams = { zoneId: string };

export async function GET(
  _request: NextRequest,
  context: { params: Promise<ZoneParams> },
) {
  const { zoneId: rawZoneId } = await context.params;
  const zoneId = parseIntParam(rawZoneId);
  if (zoneId === null) return error("Invalid zoneId", 400);

  try {
    const classes = await prisma.scheduledClass.findMany({
      where: { zoneId },
      orderBy: { startTime: "asc" },
    });
    return ok(classes);
  } catch (err) {
    console.error("GET /api/zones/[zoneId]/schedule", err);
    return error("Failed to fetch scheduled classes", 500);
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
      teacherName?: string;
      groupName?: string;
      startTime?: string;
      endTime?: string;
    }>(request);

    const startTime = body.startTime ? new Date(body.startTime) : null;
    const endTime = body.endTime ? new Date(body.endTime) : null;

    if (!startTime || Number.isNaN(startTime.getTime())) {
      return error("startTime is required and must be a valid date", 400);
    }
    if (!endTime || Number.isNaN(endTime.getTime())) {
      return error("endTime is required and must be a valid date", 400);
    }

    const scheduledClass = await prisma.scheduledClass.create({
      data: {
        zoneId,
        teacherName: body.teacherName?.trim() || null,
        groupName: body.groupName?.trim() || null,
        startTime,
        endTime,
      },
    });

    return ok(scheduledClass, { status: 201 });
  } catch (err) {
    console.error("POST /api/zones/[zoneId]/schedule", err);
    return error("Failed to create scheduled class", 500);
  }
}
