import type { NextRequest } from "next/server";
import { corsOptions, withCors } from "@/lib/http";
import { stateSnapshot } from "@/lib/mqtt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export { corsOptions as OPTIONS };

export async function GET(request: NextRequest) {
  return withCors(Response.json(stateSnapshot()), request);
}
