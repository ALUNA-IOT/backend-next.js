import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ALLOWED_ORIGINS = (process.env.CORS_ORIGIN ?? "*")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const DEFAULT_HEADERS = "Content-Type, Authorization";
const DEFAULT_METHODS = "GET,POST,PUT,PATCH,DELETE,OPTIONS";

const resolveOrigin = (origin: string | null): { value: string; credentials: boolean } => {
  if (!origin) return { value: "*", credentials: false };
  if (ALLOWED_ORIGINS.includes("*")) {
    return { value: origin, credentials: true };
  }
  if (ALLOWED_ORIGINS.includes(origin)) {
    return { value: origin, credentials: true };
  }
  // Fallback to first allowed origin if defined
  const fallback = ALLOWED_ORIGINS[0] ?? "*";
  return { value: fallback, credentials: fallback !== "*" };
};

export function middleware(request: NextRequest) {
  const originHeader = request.headers.get("origin");
  const requestMethod =
    request.headers.get("access-control-request-method") ?? DEFAULT_METHODS;
  const requestHeaders =
    request.headers.get("access-control-request-headers") ?? DEFAULT_HEADERS;

  const { value: allowOrigin, credentials } = resolveOrigin(originHeader);

  const corsHeaders: Record<string, string> = {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": requestMethod,
    "Access-Control-Allow-Headers": requestHeaders,
    "Access-Control-Max-Age": "600",
  };

  if (credentials) {
    corsHeaders["Access-Control-Allow-Credentials"] = "true";
  }

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
