import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { error, ok, parseIntParam, readJson } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RuleParams = { ruleId: string };

export async function GET(
  _request: NextRequest,
  context: { params: Promise<RuleParams> },
) {
  const { ruleId: rawRuleId } = await context.params;
  const ruleId = parseIntParam(rawRuleId);
  if (ruleId === null) return error("Invalid ruleId", 400);

  try {
    const logs = await prisma.automationLog.findMany({
      where: { ruleId },
      orderBy: { timestamp: "desc" },
      take: 200,
    });
    return ok(logs);
  } catch (err) {
    console.error("GET /api/automation/rules/[ruleId]/logs", err);
    return error("Failed to fetch automation logs", 500);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<RuleParams> },
) {
  const { ruleId: rawRuleId } = await context.params;
  const ruleId = parseIntParam(rawRuleId);
  if (ruleId === null) return error("Invalid ruleId", 400);

  try {
    const body = await readJson<{ message?: string; timestamp?: string }>(
      request,
    );
    const message = body.message?.trim() || null;
    const timestamp = body.timestamp ? new Date(body.timestamp) : new Date();
    if (Number.isNaN(timestamp.getTime())) {
      return error("timestamp is invalid", 400);
    }

    const log = await prisma.automationLog.create({
      data: {
        ruleId,
        message,
        timestamp,
      },
    });

    return ok(log, { status: 201 });
  } catch (err) {
    console.error("POST /api/automation/rules/[ruleId]/logs", err);
    return error("Failed to create automation log", 500);
  }
}
