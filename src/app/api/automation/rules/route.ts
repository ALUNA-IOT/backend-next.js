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

export function OPTIONS(request: NextRequest) {
  return corsOptions(request);
}

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

    return withCors(ok(rules), request);
  } catch (err) {
    console.error("GET /api/automation/rules", err);
    return withCors(error("Failed to fetch automation rules", 500), request);
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
      return withCors(
        error("ruleType, condition and action are required", 400),
        request,
      );
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

    return withCors(ok(rule, { status: 201 }), request);
  } catch (err) {
    console.error("POST /api/automation/rules", err);
    return withCors(error("Failed to create automation rule", 500), request);
  }
}
