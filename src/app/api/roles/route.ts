import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { corsOptions, error, ok, readJson, withCors } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export { corsOptions as OPTIONS };

export async function GET(request: NextRequest) {
  try {
    const roles = await prisma.role.findMany({
      orderBy: { createdAt: "desc" },
    });
    return withCors(ok(roles), request);
  } catch (err) {
    console.error("GET /api/roles", err);
    return withCors(error("Failed to fetch roles", 500), request);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await readJson<{ roleName?: string; description?: string }>(
      request,
    );
    const roleName = body.roleName?.trim();
    if (!roleName) {
      return withCors(error("roleName is required", 400), request);
    }

    const role = await prisma.role.create({
      data: {
        roleName,
        description: body.description?.trim() || null,
      },
    });

    return withCors(ok(role, { status: 201 }), request);
  } catch (err) {
    console.error("POST /api/roles", err);
    return withCors(error("Failed to create role", 500), request);
  }
}
