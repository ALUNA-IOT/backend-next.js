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
    const classes = await prisma.scheduledClass.findMany({
      where: { zoneId },
      orderBy: { startTime: "asc" },
    });
    return withCors(ok(classes), request);
  } catch (err) {
    console.error("GET /api/zones/[zoneId]/schedule", err);
    return withCors(error("Failed to fetch scheduled classes", 500), request);
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
      teacherName?: string;
      groupName?: string;
      startTime?: string;
      endTime?: string;
    }>(request);

    const startTime = body.startTime ? new Date(body.startTime) : null;
    const endTime = body.endTime ? new Date(body.endTime) : null;

    if (!startTime || Number.isNaN(startTime.getTime())) {
      return withCors(
        error("startTime is required and must be a valid date", 400),
        request,
      );
    }
    if (!endTime || Number.isNaN(endTime.getTime())) {
      return withCors(
        error("endTime is required and must be a valid date", 400),
        request,
      );
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

    return withCors(ok(scheduledClass, { status: 201 }), request);
  } catch (err) {
    console.error("POST /api/zones/[zoneId]/schedule", err);
    return withCors(error("Failed to create scheduled class", 500), request);
  }
}
