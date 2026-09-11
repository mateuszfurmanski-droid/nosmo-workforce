self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith("nosmo-work-v1")).map((key) => caches.delete(key)));
    await self.registration.unregister();
    await self.clients.claim();
  })());
});
