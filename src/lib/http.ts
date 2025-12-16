const bigIntSafeJson = (data: unknown) =>
  JSON.stringify(data, (_key, value) =>
    typeof value === "bigint" ? value.toString() : value,
  );

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

const mergeHeaders = (headers?: HeadersInit): Headers => {
  const merged = new Headers({ "Content-Type": "application/json" });
  if (headers) {
    new Headers(headers).forEach((value, key) => merged.set(key, value));
  }
  return merged;
};

export const buildCorsHeaders = (request?: Request): Record<string, string> => {
  const originHeader = request?.headers.get("origin");
  const requestMethod =
    request?.headers.get("access-control-request-method") ?? DEFAULT_METHODS;
  const requestHeaders =
    request?.headers.get("access-control-request-headers") ?? DEFAULT_HEADERS;

  const allowOrigin = resolveOrigin(originHeader);

  const corsHeaders: Record<string, string> = {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": requestMethod,
    "Access-Control-Allow-Headers": requestHeaders,
    "Access-Control-Max-Age": "600",
  };

  if (allowOrigin !== "*") {
    corsHeaders["Access-Control-Allow-Credentials"] = "true";
  }
  corsHeaders["Access-Control-Expose-Headers"] = requestHeaders;

  return corsHeaders;
};

export const ok = (data: unknown, init?: ResponseInit) => {
  const { headers, status, ...rest } = init ?? {};
  return new Response(bigIntSafeJson(data), {
    status: status ?? 200,
    headers: mergeHeaders(headers),
    ...rest,
  });
};

export const error = (message: string, status = 400, init?: ResponseInit) => {
  const { headers, ...rest } = init ?? {};
  return new Response(bigIntSafeJson({ error: message }), {
    status,
    headers: mergeHeaders(headers),
    ...rest,
  });
};

export const parseIntParam = (value?: string | null): number | null => {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

export const parseBigIntParam = (value?: string | null): bigint | null => {
  if (!value) return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
};

export const parseUUID = (value?: string | null): string | null => {
  if (!value) return null;
  return /^[0-9a-fA-F-]{36}$/.test(value) ? value : null;
};

export async function readJson<T = unknown>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new Error("Invalid JSON body");
  }
}

export const withCors = (response: Response, request?: Request): Response => {
  const corsHeaders = buildCorsHeaders(request);
  Object.entries(corsHeaders).forEach(([key, value]) =>
    response.headers.set(key, value),
  );
  return response;
};

export const corsOptions = (request?: Request) =>
  withCors(new Response(null, { status: 204 }), request);
