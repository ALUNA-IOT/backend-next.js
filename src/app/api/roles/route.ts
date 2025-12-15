import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { error, ok, readJson } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const roles = await prisma.role.findMany({
      orderBy: { createdAt: "desc" },
    });
    return ok(roles);
  } catch (err) {
    console.error("GET /api/roles", err);
    return error("Failed to fetch roles", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await readJson<{ roleName?: string; description?: string }>(
      request,
    );
    const roleName = body.roleName?.trim();
    if (!roleName) {
      return error("roleName is required", 400);
    }

    const role = await prisma.role.create({
      data: {
        roleName,
        description: body.description?.trim() || null,
      },
    });

    return ok(role, { status: 201 });
  } catch (err) {
    console.error("POST /api/roles", err);
    return error("Failed to create role", 500);
  }
}
