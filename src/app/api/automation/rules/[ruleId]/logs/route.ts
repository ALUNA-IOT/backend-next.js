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

type RuleParams = { ruleId: string };

export { corsOptions as OPTIONS };

export async function GET(
  request: NextRequest,
  context: { params: Promise<RuleParams> },
) {
  const { ruleId: rawRuleId } = await context.params;
  const ruleId = parseIntParam(rawRuleId);
  if (ruleId === null) return withCors(error("Invalid ruleId", 400), request);

  try {
    const logs = await prisma.automationLog.findMany({
      where: { ruleId },
      orderBy: { timestamp: "desc" },
      take: 200,
    });
    return withCors(ok(logs), request);
  } catch (err) {
    console.error("GET /api/automation/rules/[ruleId]/logs", err);
    return withCors(error("Failed to fetch automation logs", 500), request);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<RuleParams> },
) {
  const { ruleId: rawRuleId } = await context.params;
  const ruleId = parseIntParam(rawRuleId);
  if (ruleId === null) return withCors(error("Invalid ruleId", 400), request);

  try {
    const body = await readJson<{ message?: string; timestamp?: string }>(
      request,
    );
    const message = body.message?.trim() || null;
    const timestamp = body.timestamp ? new Date(body.timestamp) : new Date();
    if (Number.isNaN(timestamp.getTime())) {
      return withCors(error("timestamp is invalid", 400), request);
    }

    const log = await prisma.automationLog.create({
      data: {
        ruleId,
        message,
        timestamp,
      },
    });

    return withCors(ok(log, { status: 201 }), request);
  } catch (err) {
    console.error("POST /api/automation/rules/[ruleId]/logs", err);
    return withCors(error("Failed to create automation log", 500), request);
  }
}
