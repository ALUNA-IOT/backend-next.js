import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ALLOWED_ORIGIN = process.env.CORS_ORIGIN ?? "*";
const ALLOWED_METHODS = "GET,POST,PUT,PATCH,DELETE,OPTIONS";
const ALLOWED_HEADERS = "Content-Type, Authorization";

const buildCorsHeaders = () => {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": ALLOWED_METHODS,
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
    "Access-Control-Max-Age": "600",
  };
  if (ALLOWED_ORIGIN !== "*") {
    headers["Access-Control-Allow-Credentials"] = "true";
  }
  return headers;
};

export function middleware(request: NextRequest) {
  const corsHeaders = buildCorsHeaders();

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
