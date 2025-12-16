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

type ActuatorParams = { actuatorId: string };

export function OPTIONS(request: NextRequest) {
  return corsOptions(request);
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<ActuatorParams> },
) {
  const { actuatorId: rawActuatorId } = await context.params;
  const actuatorId = parseIntParam(rawActuatorId);
  if (actuatorId === null)
    return withCors(error("Invalid actuatorId", 400), request);

  try {
    const url = new URL(request.url);
    const limit = parseIntParam(url.searchParams.get("limit")) ?? 20;
    const safeLimit = Math.max(1, Math.min(limit, 200));

    const states = await prisma.actuatorState.findMany({
      where: { actuatorId },
      orderBy: { timestamp: "desc" },
      take: safeLimit,
    });

    return withCors(ok(states), request);
  } catch (err) {
    console.error("GET /api/actuators/[actuatorId]/state", err);
    return withCors(error("Failed to fetch actuator state", 500), request);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<ActuatorParams> },
) {
  const { actuatorId: rawActuatorId } = await context.params;
  const actuatorId = parseIntParam(rawActuatorId);
  if (actuatorId === null)
    return withCors(error("Invalid actuatorId", 400), request);

  try {
    const body = await readJson<{
      state?: string;
      speed?: number;
      intensity?: number;
      timestamp?: string;
    }>(request);

    const state = body.state?.trim();
    if (!state) return withCors(error("state is required", 400), request);

    const ts = body.timestamp ? new Date(body.timestamp) : new Date();
    if (Number.isNaN(ts.getTime()))
      return withCors(error("timestamp is invalid", 400), request);

    const created = await prisma.actuatorState.create({
      data: {
        actuatorId,
        state,
        speed: typeof body.speed === "number" ? body.speed : null,
        intensity: typeof body.intensity === "number" ? body.intensity : null,
        timestamp: ts,
      },
    });

    return withCors(ok(created, { status: 201 }), request);
  } catch (err) {
    console.error("POST /api/actuators/[actuatorId]/state", err);
    return withCors(error("Failed to create actuator state", 500), request);
  }
}
