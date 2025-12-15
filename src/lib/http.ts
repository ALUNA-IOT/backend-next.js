const bigIntSafeJson = (data: unknown) =>
  JSON.stringify(data, (_key, value) =>
    typeof value === "bigint" ? value.toString() : value,
  );

const mergeHeaders = (headers?: HeadersInit): Headers => {
  const merged = new Headers({ "Content-Type": "application/json" });
  if (headers) {
    new Headers(headers).forEach((value, key) => merged.set(key, value));
  }
  return merged;
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
