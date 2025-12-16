import NextAuth from "next-auth/next";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Type cast to bypass NextAuth overload typing issues in app router.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handler = NextAuth(authOptions as any);

export { handler as GET, handler as POST };
