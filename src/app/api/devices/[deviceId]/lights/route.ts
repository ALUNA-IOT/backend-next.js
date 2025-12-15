import type { NextRequest } from "next/server";
import { publishCommand } from "@/lib/mqtt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { deviceId: string };

type LightBody = {
  value?: string;
};

export async function POST(
  request: NextRequest,
  context: { params: Promise<RouteParams> },
) {
  const { deviceId } = await context.params;

  let body: LightBody;
  try {
    body = (await request.json()) as LightBody;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body?.value !== "ON" && body?.value !== "OFF") {
    return Response.json(
      { error: 'value must be "ON" or "OFF"' },
      { status: 400 },
    );
  }

  const { requestId } = await publishCommand(deviceId, "LIGHT_SET", body.value);

  return Response.json({ ok: true, requestId });
}
