import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ALLOWED_ORIGINS = (process.env.CORS_ORIGIN ?? "*")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const DEFAULT_HEADERS =
  "Content-Type, Authorization, X-CSRF-Token, x-csrf-token, next-auth.csrf-token, next-auth.session-token, Cookie";
const DEFAULT_METHODS = "GET,POST,PUT,PATCH,DELETE,OPTIONS";

const resolveOrigin = (origin: string | null): string => {
  if (origin) return origin;
  if (ALLOWED_ORIGINS.includes("*")) return "*";
  return ALLOWED_ORIGINS[0] ?? "*";
};

export function middleware(request: NextRequest) {
  const originHeader = request.headers.get("origin");
  const requestMethod =
    request.headers.get("access-control-request-method") ?? DEFAULT_METHODS;
  const requestHeaders =
    request.headers.get("access-control-request-headers") ?? DEFAULT_HEADERS;

  const allowOrigin = resolveOrigin(originHeader);

  const corsHeaders: Record<string, string> = {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": requestMethod,
    "Access-Control-Allow-Headers": requestHeaders,
    "Access-Control-Max-Age": "600",
  };

  // Always allow credentials so NextAuth cookies work cross-origin when origin is reflected
  if (allowOrigin !== "*") {
    corsHeaders["Access-Control-Allow-Credentials"] = "true";
  }
  corsHeaders["Access-Control-Expose-Headers"] = requestHeaders;

  if (request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  const response = NextResponse.next();
  Object.entries(corsHeaders).forEach(([key, value]) =>
    response.headers.set(key, value),
  );
  return response;
}

export const config = {
  matcher: ["/api/:path*"],
};
