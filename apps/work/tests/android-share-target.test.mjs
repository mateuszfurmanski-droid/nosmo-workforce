import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const manifest = await readFile(new URL("../android-app/app/src/main/AndroidManifest.xml", import.meta.url), "utf8");
const activity = await readFile(new URL("../android-app/app/src/main/java/tech/nosmo/work/MainActivity.kt", import.meta.url), "utf8");
const parser = await readFile(new URL("../android-app/app/src/main/java/tech/nosmo/work/ShareParser.kt", import.meta.url), "utf8");
const queue = await readFile(new URL("../android-app/app/src/main/java/tech/nosmo/work/NativeShareQueue.kt", import.meta.url), "utf8");
const build = await readFile(new URL("../android-app/app/build.gradle.kts", import.meta.url), "utf8");
const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/compact-theme.css", import.meta.url), "utf8");

test("Android registers one deliberate Share Target without broad private-data permissions", () => {
  assert.match(manifest, /android\.intent\.action\.SEND/);
  for (const mime of ["text/plain", "text/html", "text/vcard", "text/x-vcard", "application/vcard", "application/x-vcard", "image/\*"]) {
    assert.match(manifest, new RegExp(mime.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(manifest, /android:allowBackup="false"/);
  assert.doesNotMatch(manifest, /READ_CONTACTS|READ_MEDIA|READ_EXTERNAL_STORAGE|WRITE_EXTERNAL_STORAGE/);
});

test("the Android package follows the public NOSMO Work V1 version line", () => {
  assert.match(build, /versionCode\s*=\s*10101/);
  assert.match(build, /versionName\s*=\s*"1\.0101"/);
  assert.doesNotMatch(build, /versionName\s*=\s*"0\.2\.0"/);
});

test("Android keeps the WebView clear of status, navigation and display cutout areas", () => {
  assert.match(activity, /WindowCompat\.setDecorFitsSystemWindows\(window, false\)/);
  assert.match(activity, /WindowInsetsCompat\.Type\.systemBars\(\) or WindowInsetsCompat\.Type\.displayCutout\(\)/);
  assert.match(activity, /view\.setPadding\(bars\.left, bars\.top, bars\.right, bars\.bottom\)/);
  assert.match(activity, /setContentView\(withSystemBarInsets\(webView\)\)/);
});

test("shared text, vCards and screenshots stay behind an editable native confirmation", () => {
  assert.match(activity, /handleShareIntent/);
  assert.match(activity, /ShareParser\.parseVCard/);
  assert.match(activity, /TextRecognition\.getClient\(TextRecognizerOptions\.DEFAULT_OPTIONS\)/);
  assert.match(activity, /Check before saving/);
  assert.match(activity, /Save to NOSMO/);
  assert.match(activity, /Nothing is saved until you press Save to NOSMO/);
  assert.match(activity, /original image is not retained/i);
  assert.match(build, /com\.google\.mlkit:text-recognition:16\.0\.1/);
});

test("confirmed native items use a bounded acknowledged queue", () => {
  assert.match(queue, /MAX_ITEMS = 20/);
  assert.match(queue, /fun enqueue/);
  assert.match(queue, /fun acknowledge/);
  assert.match(activity, /addJavascriptInterface\(AndroidBridge\(\), "NosmoAndroid"\)/);
  assert.match(activity, /window\.__NOSMO_RECEIVE_NATIVE_SHARE__/);
  assert.match(activity, /mateusz-furmanski-job-hub\.mateusz-furmanski\.chatgpt\.site/);
  assert.doesNotMatch(activity, /asia-job-hub/);
});

test("parsing normalizes UK numbers and extracts job and contact fields locally", () => {
  assert.match(parser, /fun normalisePhone/);
  assert.match(parser, /startsWith\("0044"\)/);
  assert.match(parser, /startsWith\("\+440"\)/);
  assert.match(parser, /fun parseVCard/);
  for (const field of ["contactName", "company", "phone", "email", "role", "location", "pay", "reference", "applicationLink"]) {
    assert.match(parser, new RegExp(`val ${field}: String`));
  }
});

test("the web layer saves only confirmed shares and resolves duplicates explicitly", () => {
  assert.match(page, /__NOSMO_RECEIVE_NATIVE_SHARE__/);
  assert.match(page, /NosmoAndroid\?: \{ ackShare/);
  assert.match(page, /findNativeContactDuplicate/);
  assert.match(page, /findNativeJobDuplicate/);
  assert.match(page, /normaliseContactPhone\(payload\.phone\)/);
  assert.match(page, /Update existing/);
  assert.match(page, /Save separately/);
  assert.match(page, /Discard/);
  assert.match(page, /className="native-share-conflict"/);
  assert.match(css, /V1\.0100: confirmed Android Share intake/);
  assert.match(page, /NOSMO WORK · V1\.0101/);
});
