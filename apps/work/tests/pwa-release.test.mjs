import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const readText = (path) => readFile(new URL(path, root), "utf8");

async function pngSize(path) {
  const data = await readFile(new URL(path, root));
  assert.equal(data.subarray(1, 4).toString("ascii"), "PNG");
  return [data.readUInt32BE(16), data.readUInt32BE(20)];
}

test("V1.0102 exposes a complete install manifest and app icons", async () => {
  const manifest = await readText("app/manifest.ts");
  const layout = await readText("app/layout.tsx");

  assert.match(manifest, /id: "\/"/);
  assert.match(manifest, /start_url: "\/"/);
  assert.match(manifest, /scope: "\/"/);
  assert.match(manifest, /display: "standalone"/);
  assert.match(manifest, /pwa-icon-192\.png/);
  assert.match(manifest, /pwa-icon-512\.png/);
  assert.match(manifest, /pwa-maskable-512\.png/);
  assert.match(layout, /manifest: "\/manifest\.webmanifest"/);
  assert.deepEqual(await pngSize("public/pwa-icon-192.png"), [192, 192]);
  assert.deepEqual(await pngSize("public/pwa-icon-512.png"), [512, 512]);
  assert.deepEqual(await pngSize("public/pwa-maskable-512.png"), [512, 512]);
});

test("V1.0102 registers an offline shell without caching private API traffic", async () => {
  const page = await readText("app/page.tsx");
  const serviceWorker = await readText("public/sw.js");

  assert.match(page, /beforeinstallprompt/);
  assert.match(page, /appinstalled/);
  assert.match(page, /register\("\/sw\.js", \{ scope: "\/" \}\)/);
  assert.match(page, /id="worker-pwa-install"/);
  assert.match(serviceWorker, /nosmo-work-v10102/);
  assert.match(serviceWorker, /pathname\.startsWith\("\/api\/"\)/);
  assert.match(serviceWorker, /pathname\.startsWith\("\/signin-with-chatgpt"\)/);
  assert.match(serviceWorker, /self\.addEventListener\("install"/);
  assert.match(serviceWorker, /self\.addEventListener\("activate"/);
  assert.match(serviceWorker, /self\.addEventListener\("fetch"/);
  assert.doesNotThrow(() => new Function(serviceWorker));
});
