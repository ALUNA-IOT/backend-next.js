import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { error, ok, parseIntParam, readJson } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

    return ok(users);
  } catch (err) {
    console.error("GET /api/users", err);
    return error("Failed to fetch users", 500);
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
      return error("fullName, email and passwordHash are required", 400);
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

    return ok(user, { status: 201 });
  } catch (err) {
    console.error("POST /api/users", err);
    return error("Failed to create user", 500);
  }
}
