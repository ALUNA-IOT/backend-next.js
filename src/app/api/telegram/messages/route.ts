import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  corsOptions,
  error,
  ok,
  parseBigIntParam,
  parseIntParam,
  readJson,
  withCors,
} from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export { corsOptions as OPTIONS };

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const conversationId = parseIntParam(url.searchParams.get("conversationId"));
    const limit = parseIntParam(url.searchParams.get("limit")) ?? 50;
    const safeLimit = Math.max(1, Math.min(limit, 200));

    const messages = await prisma.telegramMessage.findMany({
      where: {
        ...(conversationId !== null ? { conversationId } : {}),
      },
      include: { conversation: true },
      orderBy: { createdAt: "desc" },
      take: safeLimit,
    });

    return withCors(ok(messages), request);
  } catch (err) {
    console.error("GET /api/telegram/messages", err);
    return withCors(error("Failed to fetch telegram messages", 500), request);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await readJson<{
      conversationId?: number;
      telegramMessageId?: string | number;
      sender?: string;
      content?: string;
    }>(request);

    if (typeof body.conversationId !== "number") {
      return withCors(error("conversationId is required", 400), request);
    }

    const sender = body.sender?.trim();
    const content = body.content?.trim();
    if (!sender || !content) {
      return withCors(error("sender and content are required", 400), request);
    }

    let telegramMessageId: bigint | null = null;
    if (typeof body.telegramMessageId === "string") {
      telegramMessageId = parseBigIntParam(body.telegramMessageId);
    } else if (typeof body.telegramMessageId === "number") {
      telegramMessageId = BigInt(body.telegramMessageId);
    }

    const message = await prisma.telegramMessage.create({
      data: {
        conversationId: body.conversationId,
        telegramMessageId,
        sender,
        content,
      },
    });

    await prisma.telegramConversation.update({
      where: { id: body.conversationId },
      data: { updatedAt: new Date() },
    });

    return withCors(ok(message, { status: 201 }), request);
  } catch (err) {
    console.error("POST /api/telegram/messages", err);
    return withCors(error("Failed to create telegram message", 500), request);
  }
}
