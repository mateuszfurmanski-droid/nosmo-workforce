import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const route = await readFile(new URL("../app/api/autopilot/route.ts", import.meta.url), "utf8");
const css = await readFile(new URL("../app/compact-theme.css", import.meta.url), "utf8");

test("Jobs contains the permanent live search and stores new results visibly", () => {
  assert.match(page, /id="jobs-live-search"/);
  assert.match(page, /New results are saved here automatically; duplicates are skipped/);
  assert.match(page, /visible\.filter\(\(job\) => job\.status === "New"\)/);
  assert.match(page, /setJobs\(\(current\) => \[\.\.\.mergeUniqueVacancies\(current, added, 20\), \.\.\.current\]\)/);
  assert.match(page, /setActive\("Applications"\)/);
});

test("live-search criteria are persisted, sent and enforced by the backend", () => {
  for (const field of ["location", "radiusMiles", "postedWithinDays", "workPattern"]) {
    assert.match(page, new RegExp(field));
    assert.match(route, new RegExp(field));
  }
  assert.match(page, /criteria: jobSearchCriteria/);
  assert.match(route, /isFreshVacancyDate\(publishedAt, now, criteria\.postedWithinDays\)/);
  assert.match(route, /within approximately \$\{criteria\.radiusMiles\} miles/);
});

test("the Jobs list filter does not overwrite the Ask Nexus query", () => {
  assert.match(page, /\[jobsFilterQuery, setJobsFilterQuery\]/);
  assert.match(page, /includes\(jobsFilterQuery\.toLowerCase\(\)\)/);
  assert.match(page, /Filter saved jobs\.\.\./);
});

test("Jobs keeps one compact command path", () => {
  assert.match(page, /className="jobs-command-row"/);
  assert.match(page, /className="jobs-search-preferences"/);
  assert.match(page, /className="jobs-status-picker"/);
  assert.match(page, /Search preferences/);
  assert.doesNotMatch(page, /\[addMenu, setAddMenu\]/);
  assert.doesNotMatch(page, /className="mobile-add-job"/);
});


test("Jobs uses compact app-owned menus and a radius slider above the panel", () => {
  assert.match(page, /className="worker-account-signin"/);
  assert.match(page, /href="\/signin-with-chatgpt\?return_to=%2F"/);
  assert.match(page, /className="jobs-criteria-menu"/);
  assert.match(page, /type="range"/);
  assert.match(page, /New only/);
  assert.match(page, /1 day/);
  assert.match(page, /3 days/);
  assert.doesNotMatch(page, /<select[^>]*jobSearchCriteria/);
  assert.match(route, /\[0, 1, 3, 7, 14, 30\]\.includes\(freshness\)/);
  assert.match(css, /\.jobs-live-search, \.jobs-search-preferences\[open\] \{ overflow: visible; \}/);
  assert.match(css, /\.jobs-criteria-menu \{ position: absolute;/);
});
