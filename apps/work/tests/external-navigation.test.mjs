import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

test("external web pages open above the app so closing returns to NOSMO", () => {
  assert.match(pageSource, /link\.target = "_blank"/);
  assert.match(pageSource, /link\.rel = "external noopener noreferrer"/);
  assert.doesNotMatch(pageSource, /target="_top"\s+rel="external"/);
});
