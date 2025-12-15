import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { error, ok, parseIntParam, readJson } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const zoneId = parseIntParam(url.searchParams.get("zoneId"));
    const activeParam = url.searchParams.get("active");

    const rules = await prisma.automationRule.findMany({
      where: {
        ...(zoneId !== null ? { zoneId } : {}),
        ...(activeParam !== null ? { isActive: activeParam === "true" } : {}),
      },
      include: { zone: true },
      orderBy: { createdAt: "desc" },
    });

    return ok(rules);
  } catch (err) {
    console.error("GET /api/automation/rules", err);
    return error("Failed to fetch automation rules", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await readJson<{
      zoneId?: number;
      ruleType?: string;
      condition?: string;
      action?: string;
      parameters?: unknown;
      isActive?: boolean;
    }>(request);

    const ruleType = body.ruleType?.trim();
    const condition = body.condition?.trim();
    const action = body.action?.trim();
    if (!ruleType || !condition || !action) {
      return error("ruleType, condition and action are required", 400);
    }

    const rule = await prisma.automationRule.create({
      data: {
        zoneId: body.zoneId ?? null,
        ruleType,
        condition,
        action,
        parameters: body.parameters ?? undefined,
        isActive: body.isActive ?? true,
      },
    });

    return ok(rule, { status: 201 });
  } catch (err) {
    console.error("POST /api/automation/rules", err);
    return error("Failed to create automation rule", 500);
  }
}
