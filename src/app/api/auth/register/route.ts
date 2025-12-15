import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { error, ok, readJson } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await readJson<{
      fullName?: string;
      email?: string;
      password?: string;
      phone?: string;
      roleId?: number;
    }>(request);

    const fullName = body.fullName?.trim();
    const email = body.email?.toLowerCase().trim();
    const password = body.password ?? "";

    if (!fullName || !email || !password) {
      return error("fullName, email and password are required", 400);
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return error("User already exists", 409);

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        fullName,
        email,
        passwordHash,
        phone: body.phone?.trim() || null,
        roleId: body.roleId ?? null,
        isActive: true,
      },
      include: { role: true },
    });

    return ok(
      {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role?.roleName ?? null,
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("POST /api/auth/register", err);
    return error("Failed to register user", 500);
  }
}
