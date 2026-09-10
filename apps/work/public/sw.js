const CACHE_PREFIX = "nosmo-work-v10102";
const CACHE_NAME = `${CACHE_PREFIX}-shell-v1`;
const CORE_URLS = [
  "/manifest.webmanifest",
  "/favicon.svg",
  "/pwa-icon-192.png",
  "/pwa-icon-512.png",
  "/pwa-maskable-512.png",
];

function isPrivatePath(pathname) {
  return pathname.startsWith("/api/") || pathname.startsWith("/signin-with-chatgpt");
}

function isStaticAsset(request, url) {
  return ["script", "style", "image", "font"].includes(request.destination) ||
    /\.(?:css|js|mjs|png|jpg|jpeg|webp|svg|ico|woff2?)$/i.test(url.pathname);
}

async function cacheResponse(cache, request) {
  const response = await fetch(request, { cache: "reload" });
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

async function installAppShell() {
  const cache = await caches.open(CACHE_NAME);
  const rootResponse = await cacheResponse(cache, "/");
  const html = await rootResponse.clone().text();
  const discovered = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/gi)]
    .map((match) => new URL(match[1], self.location.origin))
    .filter((url) => url.origin === self.location.origin && !isPrivatePath(url.pathname))
    .map((url) => `${url.pathname}${url.search}`);

  await Promise.allSettled(
    [...new Set([...CORE_URLS, ...discovered])].map((url) => cacheResponse(cache, url)),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(installAppShell().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
        .map((key) => caches.delete(key)),
    );
    await self.clients.claim();
  })());
});

async function navigationResponse(request, url) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok && url.pathname === "/" && !url.search) {
      await cache.put("/", response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match("/");
    return cached || new Response("NOSMO Work is offline. Reconnect once to finish setup.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

async function staticResponse(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || isPrivatePath(url.pathname)) return;

  if (request.mode === "navigate") {
    event.respondWith(navigationResponse(request, url));
    return;
  }
  if (isStaticAsset(request, url)) event.respondWith(staticResponse(request));
});
