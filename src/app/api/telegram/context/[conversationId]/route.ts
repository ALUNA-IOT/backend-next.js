import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { error, ok, parseIntParam, readJson } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ConversationParams = { conversationId: string };

export async function GET(
  _request: NextRequest,
  context: { params: Promise<ConversationParams> },
) {
  const { conversationId: rawConversationId } = await context.params;
  const conversationId = parseIntParam(rawConversationId);
  if (conversationId === null) return error("Invalid conversationId", 400);

  try {
    const context = await prisma.telegramContext.findUnique({
      where: { conversationId },
    });
    if (!context) return error("Context not found", 404);
    return ok(context);
  } catch (err) {
    console.error("GET /api/telegram/context/[conversationId]", err);
    return error("Failed to fetch telegram context", 500);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<ConversationParams> },
) {
  const { conversationId: rawConversationId } = await context.params;
  const conversationId = parseIntParam(rawConversationId);
  if (conversationId === null) return error("Invalid conversationId", 400);

  try {
    const body = await readJson<{
      activeFlow?: string;
      currentStep?: string;
      tempData?: unknown;
    }>(request);

    const context = await prisma.telegramContext.upsert({
      where: { conversationId },
      update: {
        activeFlow: body.activeFlow?.trim() || null,
        currentStep: body.currentStep?.trim() || null,
        tempData: body.tempData ?? {},
        lastActivity: new Date(),
      },
      create: {
        conversationId,
        activeFlow: body.activeFlow?.trim() || null,
        currentStep: body.currentStep?.trim() || null,
        tempData: body.tempData ?? {},
      },
    });

    return ok(context);
  } catch (err) {
    console.error("POST /api/telegram/context/[conversationId]", err);
    return error("Failed to upsert telegram context", 500);
  }
}
