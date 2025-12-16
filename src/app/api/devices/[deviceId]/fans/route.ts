import type { NextRequest } from "next/server";
import { corsOptions, withCors } from "@/lib/http";
import { publishCommand } from "@/lib/mqtt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { deviceId: string };

type FanBody = {
  value?: string;
  speed?: number;
};

export { corsOptions as OPTIONS };

export async function POST(
  request: NextRequest,
  context: { params: Promise<RouteParams> },
) {
  const { deviceId } = await context.params;

  let body: FanBody;
  try {
    body = (await request.json()) as FanBody;
  } catch {
    return withCors(
      Response.json({ error: "Invalid JSON body" }, { status: 400 }),
      request,
    );
  }

  if (body?.value !== "ON" && body?.value !== "OFF") {
    return withCors(
      Response.json({ error: 'value must be "ON" or "OFF"' }, { status: 400 }),
      request,
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

  return withCors(Response.json({ ok: true, requestId }), request);
}
