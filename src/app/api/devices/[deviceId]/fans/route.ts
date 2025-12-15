import type { NextRequest } from "next/server";
import { publishCommand } from "@/lib/mqtt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { deviceId: string };

type FanBody = {
  value?: string;
  speed?: number;
};

export async function POST(
  request: NextRequest,
  context: { params: Promise<RouteParams> },
) {
  const { deviceId } = await context.params;

  let body: FanBody;
  try {
    body = (await request.json()) as FanBody;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body?.value !== "ON" && body?.value !== "OFF") {
    return Response.json(
      { error: 'value must be "ON" or "OFF"' },
      { status: 400 },
    );
  }

  const hasSpeed =
    body.speed !== undefined &&
    body.speed !== null &&
    Number.isFinite(Number(body.speed));

  const speed = hasSpeed ? Number(body.speed) : undefined;

  const { requestId } = await publishCommand(
    deviceId,
    "FAN_SET",
    body.value,
    speed,
  );

  return Response.json({ ok: true, requestId });
}
