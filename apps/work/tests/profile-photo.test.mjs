import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

test("Worker Card photo can be selected and restored from device storage", () => {
  assert.match(pageSource, /const PROFILE_PHOTO_KEY = "nosmo-worker-profile-photo"/);
  assert.match(pageSource, /readLocalFile\(PROFILE_PHOTO_KEY\)/);
  assert.match(pageSource, /saveLocalFile\(PROFILE_PHOTO_KEY, file\)/);
  assert.match(pageSource, /accept="image\/\*"/);
});

test("Worker Card photo is rendered as a circle with a camera control", () => {
  assert.match(pageSource, /className="profile-photo-circle"/);
  assert.match(pageSource, /<Camera \/>/);
  assert.match(styles, /\.profile-photo-circle\{[^}]*border-radius:50%/);
  assert.match(styles, /\.profile-photo-circle img\{[^}]*object-fit:cover/);
});
