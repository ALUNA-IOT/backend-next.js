import NextAuth from "next-auth/next";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handler = (NextAuth as unknown as (options?: unknown) => unknown)(
  authOptions,
) as typeof NextAuth;

export { handler as GET, handler as POST };
