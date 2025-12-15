import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const authOptions = {
  session: {
    strategy: "jwt" as const,
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.toString().toLowerCase().trim();
        const password = credentials?.password?.toString() ?? "";
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({
          where: { email },
          include: { role: true },
        });
        if (!user || !user.isActive) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id.toString(),
          name: user.fullName,
          email: user.email,
          role: user.role?.roleName ?? null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({
      token,
      user,
    }: {
      token: Record<string, unknown>;
      user?: {
        id: string;
        name?: string | null;
        email?: string | null;
        role?: string | null;
      };
    }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
        token.role = (user as { role?: string | null }).role ?? null;
      }
      return token;
    },
    async session({
      session,
      token,
    }: {
      session: {
        user?: {
          id?: string;
          name?: string | null;
          email?: string | null;
          role?: string | null;
        };
        [key: string]: unknown;
      };
      token: Record<string, unknown>;
    }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = (token as { role?: string | null }).role ?? null;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
};
