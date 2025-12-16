import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { buildCorsHeaders } from "@/lib/http";

export function middleware(request: NextRequest) {
  const corsHeaders = buildCorsHeaders(request);

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
