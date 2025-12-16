import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  corsOptions,
  error,
  ok,
  parseIntParam,
  parseUUID,
  readJson,
  withCors,
} from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export { corsOptions as OPTIONS };

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const deviceId = parseUUID(url.searchParams.get("deviceId"));
    const actuatorId = parseIntParam(url.searchParams.get("actuatorId"));
    const successParam = url.searchParams.get("success");

    const commands = await prisma.ioTCommand.findMany({
      where: {
        ...(deviceId ? { deviceId } : {}),
        ...(actuatorId !== null ? { actuatorId } : {}),
        ...(successParam !== null
          ? { success: successParam === "true" }
          : {}),
      },
      include: {
        device: true,
        actuator: true,
      },
      orderBy: { sentTimestamp: "desc" },
      take: 200,
    });

    return withCors(ok(commands), request);
  } catch (err) {
    console.error("GET /api/commands", err);
    return withCors(error("Failed to fetch commands", 500), request);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await readJson<{
      deviceId?: string;
      actuatorId?: number;
      command?: string;
      value?: string;
      sentTimestamp?: string;
      responseTimestamp?: string;
      success?: boolean;
    }>(request);

    const command = body.command?.trim();
    if (!command) return withCors(error("command is required", 400), request);

    const sentTimestamp = body.sentTimestamp
      ? new Date(body.sentTimestamp)
      : new Date();
    if (Number.isNaN(sentTimestamp.getTime())) {
      return withCors(error("sentTimestamp is invalid", 400), request);
    }

    const responseTimestamp =
      body.responseTimestamp && !Number.isNaN(new Date(body.responseTimestamp).getTime())
        ? new Date(body.responseTimestamp)
        : null;

    const created = await prisma.ioTCommand.create({
      data: {
        deviceId: body.deviceId ? parseUUID(body.deviceId) : null,
        actuatorId: body.actuatorId ?? null,
        command,
        value: body.value?.trim() || null,
        sentTimestamp,
        responseTimestamp,
        success: body.success ?? null,
      },
    });

    return withCors(ok(created, { status: 201 }), request);
  } catch (err) {
    console.error("POST /api/commands", err);
    return withCors(error("Failed to create command", 500), request);
  }
}
