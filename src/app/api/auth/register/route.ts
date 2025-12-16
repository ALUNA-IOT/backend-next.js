import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { error, ok, readJson } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const corsHeaders = {
  "Access-Control-Allow-Origin": process.env.CORS_ORIGIN ?? "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const withCors = (response: Response) => {
  Object.entries(corsHeaders).forEach(([key, value]) =>
    response.headers.set(key, value),
  );
  return response;
};

export async function OPTIONS() {
  return withCors(new Response(null, { status: 204 }));
}

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
      return withCors(error("fullName, email and password are required", 400));
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return withCors(error("User already exists", 409));

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

    return withCors(
      ok(
        {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          role: user.role?.roleName ?? null,
        },
        { status: 201 },
      ),
    );
  } catch (err) {
    console.error("POST /api/auth/register", err);
    return withCors(error("Failed to register user", 500));
  }
}
