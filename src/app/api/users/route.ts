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

export { corsOptions as OPTIONS };

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const roleId = parseIntParam(url.searchParams.get("roleId"));
    const activeParam = url.searchParams.get("active");

    const users = await prisma.user.findMany({
      where: {
        ...(roleId !== null ? { roleId } : {}),
        ...(activeParam !== null ? { isActive: activeParam === "true" } : {}),
      },
      include: { role: true },
      orderBy: { createdAt: "desc" },
    });

    return withCors(ok(users), request);
  } catch (err) {
    console.error("GET /api/users", err);
    return withCors(error("Failed to fetch users", 500), request);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await readJson<{
      fullName?: string;
      email?: string;
      passwordHash?: string;
      phone?: string;
      roleId?: number;
      isActive?: boolean;
    }>(request);

    const fullName = body.fullName?.trim();
    const email = body.email?.trim();
    const passwordHash = body.passwordHash?.trim();

    if (!fullName || !email || !passwordHash) {
      return withCors(
        error("fullName, email and passwordHash are required", 400),
        request,
      );
    }

    const user = await prisma.user.create({
      data: {
        fullName,
        email,
        passwordHash,
        phone: body.phone?.trim() || null,
        isActive: body.isActive ?? true,
        roleId: body.roleId ?? null,
      },
      include: { role: true },
    });

    return withCors(ok(user, { status: 201 }), request);
  } catch (err) {
    console.error("POST /api/users", err);
    return withCors(error("Failed to create user", 500), request);
  }
}
