import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const themeStyles = await readFile(new URL("../app/compact-theme.css", import.meta.url), "utf8");

test("offers and persists all six NOSMO colour systems", () => {
  for (const name of ["Midnight Black", "Nexus Blue", "Eco Green", "Silent Gold", "Windows Grey", "Architect White"]) {
    assert.match(pageSource, new RegExp(name));
  }
  assert.match(pageSource, /localStorage\.setItem\("nosmo-theme-preset", next\)/);
  assert.match(pageSource, /document\.documentElement\.dataset\.skin = themePreset/);
  assert.match(themeStyles, /\[data-skin="nexus-blue"\]\s*\{[^}]*--accent:\s*#55a5ff/s);
  assert.match(themeStyles, /\[data-skin="eco-green"\]\s*\{[^}]*--accent:\s*#16865c/s);
  assert.match(themeStyles, /\[data-skin="midnight-black"\]\s*\{[^}]*--accent:\s*#d7d7d7/s);
  assert.match(pageSource, /Black \+ greyscale/);
  const midnightTheme = themeStyles.match(/\[data-skin="midnight-black"\]\s*\{([^}]*)\}/s)?.[1] || "";
  assert.doesNotMatch(midnightTheme, /#(?:bd7cff|9d58e5|281439|58336f|171020|14091e|3d2b4b|aa9db8|cbb4dc|f7f2ff|050407|0d0a12|0a0710)/i);
});

test("themes also control Ask Nexus and the five-item dock", () => {
  assert.match(themeStyles, /\[data-skin\] \.worker-nexus-bar > button\s*\{[^}]*background:\s*var\(--surface\)[^}]*box-shadow:\s*inset 0 3px var\(--accent\)/s);
  assert.match(themeStyles, /\[data-skin\] \.bottom-nav\.worker-bottom-nav\s*\{[^}]*background:\s*var\(--surface\)/s);
  assert.match(themeStyles, /\[data-skin\] \.worker-bottom-nav button\.on::before\s*\{[^}]*background:\s*var\(--accent\)/s);
  assert.match(themeStyles, /\.bottom-nav\.worker-bottom-nav\s*\{[^}]*height:\s*82px[^}]*box-shadow:\s*0 -8px 24px var\(--shadow\)/s);
  assert.match(themeStyles, /\[data-skin\] \.worker-bottom-nav button\s*\{[^}]*min-height:\s*69px[^}]*font-size:\s*9px/s);
});

test("availability uses semantic green, amber and red LEDs while its controls follow the theme", () => {
  assert.match(pageSource, /availability-led \$\{availability\}/);
  assert.match(themeStyles, /\.availability-led\s*\{[^}]*--led-color:\s*#39d98a[^}]*box-shadow:/s);
  assert.match(themeStyles, /\.availability-led\.yellow\s*\{[^}]*--led-color:\s*#ffc83d/s);
  assert.match(themeStyles, /\.availability-led\.red\s*\{[^}]*--led-color:\s*#ff5b67/s);
  assert.match(themeStyles, /\[data-skin\] \.mini-switch\.on\s*\{[^}]*background:\s*var\(--accent\)/s);
  assert.match(themeStyles, /\[data-skin\] \.calendar-pick\s*\{[^}]*color:\s*var\(--accent\)/s);
});

test("appearance and language selectors are collapsible and language defaults to the system", () => {
  assert.match(pageSource, /<details className="settings-collapsible theme-setting">/);
  assert.match(pageSource, /<details className="settings-collapsible language-setting">/);
  assert.match(pageSource, /useState<LanguagePreference>\("auto"\)/);
  assert.match(pageSource, /navigator\.languages\?\.\[0\] \|\| navigator\.language/);
  assert.match(pageSource, /window\.addEventListener\("languagechange"/);
  assert.match(pageSource, /localStorage\.setItem\("nosmo-language", next\)/);
  assert.match(pageSource, /document\.documentElement\.lang = resolved/);
});

test("document actions use the shared theme palette", () => {
  assert.match(pageSource, /className="cv-file-button cv-open"/);
  assert.match(pageSource, /className="cv-file-button cv-share"/);
  assert.match(themeStyles, /\.cv-open\s*\{[^}]*background:\s*var\(--accent-soft\)/s);
  assert.match(themeStyles, /\.cv-share\s*\{[^}]*background:\s*var\(--accent\)/s);
});
