import test from "node:test";
import assert from "node:assert/strict";
import {
  canVerifyVacancyCandidate,
  canonicalVacancyUrl,
  FRESH_VACANCY_DAYS,
  isBackgroundSearchPending,
  isFreshVacancyDate,
  LIVE_SEARCH_CONTEXT_SIZE,
  LIVE_SEARCH_MAX_POLLS,
  LIVE_SEARCH_POLL_INTERVAL_MS,
  LIVE_SEARCH_POLL_TIMEOUT_MS,
  LIVE_SEARCH_REASONING_EFFORT,
  LIVE_SEARCH_RESULTS_PER_LANE,
  LIVE_SEARCH_RETURN_TOKEN_BUDGET,
  LIVE_SEARCH_START_TIMEOUT_MS,
  LIVE_SEARCH_TOOL_CHOICE,
  mergeUniqueVacancies,
  NEW_VACANCY_DAYS,
  safeSearchBatch,
  searchLanes,
  vacancyIdentity,
  vacancyAgeLabel,
} from "../app/search-v2.ts";

test("live vacancy discovery uses resumable background polling", () => {
  assert.equal(LIVE_SEARCH_TOOL_CHOICE, "required");
  assert.equal(LIVE_SEARCH_CONTEXT_SIZE, "high");
  assert.equal(LIVE_SEARCH_REASONING_EFFORT, "medium");
  assert.equal(LIVE_SEARCH_RESULTS_PER_LANE, 8);
  assert.equal(LIVE_SEARCH_RETURN_TOKEN_BUDGET, "unlimited");
  assert.equal(LIVE_SEARCH_START_TIMEOUT_MS, 12_000);
  assert.equal(LIVE_SEARCH_POLL_TIMEOUT_MS, 10_000);
  assert.equal(LIVE_SEARCH_POLL_INTERVAL_MS, 2_500);
  assert.equal(LIVE_SEARCH_MAX_POLLS, 96);
  assert.equal(isBackgroundSearchPending("queued"), true);
  assert.equal(isBackgroundSearchPending("in_progress"), true);
  assert.equal(isBackgroundSearchPending("completed"), false);
});

test("canonical vacancy URLs ignore tracking without losing vacancy IDs", () => {
  assert.equal(
    canonicalVacancyUrl("https://UK.Indeed.com/viewjob?utm_source=x&jk=abc123#top"),
    "https://uk.indeed.com/viewjob?jk=abc123",
  );
});

test("continuation search adds only unseen direct vacancies", () => {
  const existing = [{ company: "Acme", role: "Joiner", area: "Leeds", applicationLink: "https://example.com/jobs/123/joiner" }];
  const candidates = [
    { company: "Acme", role: "Joiner", area: "Leeds", applicationLink: "https://example.com/jobs/123/joiner?utm_source=mail" },
    { company: "Beta", role: "Fire Door Joiner", area: "Bradford", applicationLink: "https://example.com/jobs/456/fire-door-joiner" },
    { company: "Home", role: "Joiner", area: "Leeds", applicationLink: "https://example.com/jobs?q=joiner" },
  ];
  assert.deepEqual(mergeUniqueVacancies(existing, candidates), [candidates[1]]);
  assert.equal(vacancyIdentity(existing[0]), vacancyIdentity(candidates[0]));
});

test("search batches are bounded and rotate four independent source lanes", () => {
  assert.equal(safeSearchBatch(0), 1);
  assert.equal(safeSearchBatch(999), 50);
  assert.equal(searchLanes(1).length, 4);
  assert.equal(new Set(searchLanes(1).map((lane) => lane.id)).size, 4);
  assert.equal(searchLanes(1).filter((lane) => lane.allowedDomains?.length).length, 2);
  assert.notEqual(searchLanes(1)[0].focus, searchLanes(2)[0].focus);
});

test("current vacancies use a 30-day limit with a seven-day priority window", () => {
  const now = new Date("2026-09-02T20:00:00Z");
  assert.equal(FRESH_VACANCY_DAYS, 30);
  assert.equal(NEW_VACANCY_DAYS, 7);
  assert.equal(isFreshVacancyDate("2026-09-02", now), true);
  assert.equal(isFreshVacancyDate("2026-08-03", now), true);
  assert.equal(isFreshVacancyDate("2026-08-02", now), false);
  assert.equal(isFreshVacancyDate("2026-08-26T08:00:00Z", now, NEW_VACANCY_DAYS), true);
  assert.equal(isFreshVacancyDate("2026-08-25", now, NEW_VACANCY_DAYS), false);
  assert.equal(isFreshVacancyDate("2026-09-03", now), false);
  assert.equal(isFreshVacancyDate("unknown", now), false);
  assert.equal(vacancyAgeLabel("2026-09-02", now), "Posted today");
  assert.equal(vacancyAgeLabel("2026-08-31", now), "Posted 2 days ago");
});

test("undated candidates reach direct-page verification without weakening dated checks", () => {
  const now = new Date("2026-09-02T20:00:00Z");
  assert.equal(canVerifyVacancyCandidate("", "", now), true);
  assert.equal(canVerifyVacancyCandidate("2026-09-01", "Posted 1 day ago", now), true);
  assert.equal(canVerifyVacancyCandidate("2026-09-01", "", now), false);
  assert.equal(canVerifyVacancyCandidate("2026-07-01", "Posted 2 months ago", now), false);
  assert.equal(canVerifyVacancyCandidate("2026-09-03", "Posted tomorrow", now), false);
});
