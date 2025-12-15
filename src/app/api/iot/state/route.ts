import { stateSnapshot } from "@/lib/mqtt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(stateSnapshot());
}
