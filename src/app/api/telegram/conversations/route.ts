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
    const chatId = parseBigIntParam(url.searchParams.get("chatId"));
    const userId = parseIntParam(url.searchParams.get("userId"));

    const conversations = await prisma.telegramConversation.findMany({
      where: {
        ...(chatId !== null ? { telegramChatId: chatId } : {}),
        ...(userId !== null ? { userId } : {}),
      },
      include: {
        user: true,
        context: true,
        messages: { orderBy: { createdAt: "desc" }, take: 5 },
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });

    return withCors(ok(conversations), request);
  } catch (err) {
    console.error("GET /api/telegram/conversations", err);
    return withCors(error("Failed to fetch telegram conversations", 500), request);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await readJson<{
      telegramChatId?: string | number;
      telegramUsername?: string;
      telegramFirstName?: string;
      telegramLastName?: string;
      userId?: number;
      status?: string;
    }>(request);

    const rawChat = body.telegramChatId;
    const chatId =
      typeof rawChat === "string"
        ? parseBigIntParam(rawChat)
        : typeof rawChat === "number"
          ? BigInt(rawChat)
          : null;
    if (chatId === null)
      return withCors(error("telegramChatId is required", 400), request);

    const conversation = await prisma.telegramConversation.create({
      data: {
        telegramChatId: chatId,
        telegramUsername: body.telegramUsername?.trim() || null,
        telegramFirstName: body.telegramFirstName?.trim() || null,
        telegramLastName: body.telegramLastName?.trim() || null,
        userId: body.userId ?? null,
        status: body.status?.trim() || "active",
      },
    });

    return withCors(ok(conversation, { status: 201 }), request);
  } catch (err) {
    console.error("POST /api/telegram/conversations", err);
    return withCors(
      error("Failed to create telegram conversation", 500),
      request,
    );
  }
}
