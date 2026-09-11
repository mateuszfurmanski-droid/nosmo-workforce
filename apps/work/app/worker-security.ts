type RateBucket = {
  windowStartedAt: number;
  count: number;
};

type GlobalRateState = typeof globalThis & {
  __nosmoWorkerRateBuckets?: Map<string, RateBucket>;
};

const globalRateState = globalThis as GlobalRateState;
const rateBuckets =
  globalRateState.__nosmoWorkerRateBuckets ??
  (globalRateState.__nosmoWorkerRateBuckets = new Map<string, RateBucket>());

const WINDOW_MS = 60_000;
const GENERAL_LIMIT = 120;
const CONNECTION_LIMIT = 30;
const MAX_MUTATION_BYTES = 64 * 1024;

function securityHeaders(): Record<string, string> {
  return {
    "Cache-Control": "no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy":
      "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    "Cross-Origin-Opener-Policy": "same-origin",
  };
}

function securedJson(error: string, status: number): Response {
  return Response.json(
    { error },
    {
      status,
      headers: securityHeaders(),
    },
  );
}

function requestKey(request: Request): string {
  const identity = request.headers
    .get("oai-authenticated-user-email")
    ?.trim()
    .toLowerCase();
  if (identity) return `identity:${identity}`;

  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return `network:${forwarded || "anonymous"}`;
}

function rateAllowed(request: Request, path: string[]): boolean {
  const now = Date.now();
  const route = path.join("/");
  const limit = route === "connection" ? CONNECTION_LIMIT : GENERAL_LIMIT;
  const key = `${requestKey(request)}:${route || "root"}`;
  const current = rateBuckets.get(key);

  if (!current || now - current.windowStartedAt >= WINDOW_MS) {
    rateBuckets.set(key, { windowStartedAt: now, count: 1 });
    return true;
  }

  current.count += 1;
  if (rateBuckets.size > 5_000) {
    for (const [bucketKey, bucket] of rateBuckets) {
      if (now - bucket.windowStartedAt >= WINDOW_MS) rateBuckets.delete(bucketKey);
    }
  }
  return current.count <= limit;
}

function mutationOriginAllowed(request: Request): boolean {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD") return true;

  const origin = request.headers.get("origin");
  if (!origin) return false;

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function payloadAllowed(request: Request): boolean {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD") return true;
  const rawLength = request.headers.get("content-length");
  if (!rawLength) return true;
  const length = Number(rawLength);
  return Number.isFinite(length) && length >= 0 && length <= MAX_MUTATION_BYTES;
}

function credentialsInUrl(request: Request): boolean {
  const url = new URL(request.url);
  return ["sid", "sessionId", "draftToken", "authorization"].some((key) =>
    url.searchParams.has(key),
  );
}

function applySecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(securityHeaders())) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export async function secureWorkerRequest(
  request: Request,
  path: string[],
  handler: () => Promise<Response>,
): Promise<Response> {
  if (credentialsInUrl(request)) {
    return securedJson("NEXUS_CREDENTIAL_IN_URL_DENIED", 400);
  }
  if (!mutationOriginAllowed(request)) {
    return securedJson("NEXUS_ORIGIN_DENIED", 403);
  }
  if (!payloadAllowed(request)) {
    return securedJson("NEXUS_PAYLOAD_TOO_LARGE", 413);
  }
  if (!rateAllowed(request, path)) {
    return securedJson("NEXUS_RATE_LIMITED", 429);
  }

  return applySecurityHeaders(await handler());
}
