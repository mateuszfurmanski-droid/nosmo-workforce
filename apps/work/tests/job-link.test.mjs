import test from "node:test";
import assert from "node:assert/strict";
import { isDirectVacancyUrl } from "../app/job-link.ts";

test("rejects home, careers, category and search pages on any domain", () => {
  for (const url of [
    "https://leedsjobs.com",
    "https://example.com/about-us",
    "https://example.com/careers",
    "https://randstad.co.uk/jobs",
    "https://uk.indeed.com/jobs?q=joiner&l=Leeds",
    "https://example.com/jobs/search?keywords=joiner",
  ]) assert.equal(isDirectVacancyUrl(url), false, url);
});

test("accepts individual vacancy routes across job sites and ATS providers", () => {
  for (const url of [
    "https://uk.indeed.com/viewjob?jk=abc123",
    "https://boards.greenhouse.io/company/jobs/123456",
    "https://jobs.lever.co/company/abcd-1234",
    "https://example.com/careers/site-joiner-12345",
    "https://example.com/jobs/12345/site-joiner",
    "https://gumtree.com/p/jobs/joiner-required/1234567890",
  ]) assert.equal(isDirectVacancyUrl(url), true, url);
});
