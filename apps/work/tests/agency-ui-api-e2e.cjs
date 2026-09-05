const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const baseUrl = process.env.AGENCY_E2E_BASE_URL || "http://127.0.0.1:8130";
const sessionId = "nosmo-ui-e2e-session";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const evidence = [];
  const consoleErrors = [];
  const pageErrors = [];

  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    await context.addCookies([
      {
        name: "sid",
        value: sessionId,
        url: baseUrl,
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);

    const page = await context.newPage();
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("response", (response) => {
      if (response.url().includes("/api/person-card/agency/")) {
        evidence.push({
          method: response.request().method(),
          path: new URL(response.url()).pathname,
          status: response.status(),
        });
      }
    });

    const initialCandidates = page.waitForResponse(
      (response) =>
        response.request().method() === "GET" &&
        new URL(response.url()).pathname ===
          "/api/person-card/agency/candidates",
    );

    const navigation = await page.goto(baseUrl + "/agency-desk.html", {
      waitUntil: "domcontentloaded",
    });
    assert.equal(navigation.status(), 200, "Agency Desk HTML must load");

    const candidatesResponse = await initialCandidates;
    assert.equal(candidatesResponse.status(), 200, "Candidate API must return 200");
    const candidatesPayload = await candidatesResponse.json();

    assert.equal(
      candidatesPayload.schema,
      "nexus-person-agency-candidate-list/v1",
    );
    assert.equal(candidatesPayload.count, 2, "Only two active grants are visible");
    assert.equal(candidatesPayload.recruiterSafeProjection, true);
    assert.equal(
      candidatesPayload.candidates.every(
        (candidate) => candidate.privateFieldsIncluded === false,
      ),
      true,
      "Every API candidate must be recruiter-safe",
    );

    const serializedPayload = JSON.stringify(candidatesPayload);
    for (const privateMarker of [
      "PRIVATE_ALICE_CV_MUST_NOT_LEAK",
      "PRIVATE_CHARLIE_CV_MUST_NOT_LEAK",
      "PRIVATE_BOB_CV_MUST_NOT_LEAK",
      "PRIVATE_ALICE_DOCUMENT",
      "PRIVATE_CHARLIE_DOCUMENT",
      "PRIVATE_BOB_DOCUMENT",
      "alice-private@nosmo-e2e.invalid",
      "charlie-private@nosmo-e2e.invalid",
      "bob-private@nosmo-e2e.invalid",
      "07000000001",
      "07000000002",
      "07000000003",
    ]) {
      assert.equal(
        serializedPayload.includes(privateMarker),
        false,
        "Private marker leaked from candidate API: " + privateMarker,
      );
    }

    await page.waitForFunction(
      () => document.querySelector("#candidateCount")?.textContent === "2",
    );

    assert.match(
      await page.locator("#agencyAccountState").innerText(),
      /NorthBuild E2E Agency.*authenticated/,
    );

    const candidateListText = await page.locator("#candidateList").innerText();
    assert.match(candidateListText, /Alice Joiner/);
    assert.match(candidateListText, /Charlie Electrician/);
    assert.doesNotMatch(candidateListText, /Bob Revoked/);
    assert.doesNotMatch(candidateListText, /PRIVATE_/);

    const aliceCard = page
      .locator(".candidate")
      .filter({ hasText: "Alice Joiner" })
      .first();
    await aliceCard.waitFor();

    const shortlistResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname ===
          "/api/person-card/agency/candidates/nosmo-ui-e2e-worker-alice/actions",
    );

    await aliceCard.locator("[data-shortlist]").click();
    const shortlistResponse = await shortlistResponsePromise;
    const shortlistPayload = await shortlistResponse.json();
    assert.equal(
      shortlistResponse.status(),
      201,
      "Shortlist action must persist: " + JSON.stringify(shortlistPayload),
    );
    assert.equal(shortlistPayload.actionType, "SHORTLISTED");
    assert.equal(shortlistPayload.nextStage, "SHORTLISTED");
    assert.equal(shortlistPayload.privateDocumentsIncluded, false);

    await page.waitForFunction(
      () =>
        document.querySelector("#shortlistCount")?.textContent === "1" &&
        [...document.querySelectorAll(".candidate")].some(
          (card) =>
            card.textContent?.includes("Alice Joiner") &&
            card.textContent?.includes("SHORTLISTED"),
        ),
    );
    await page.waitForFunction(() =>
      document
        .querySelector("#agencyActivity")
        ?.textContent?.includes("SHORTLISTED · Alice Joiner"),
    );

    const searchResponsePromise = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return (
        response.request().method() === "GET" &&
        url.pathname === "/api/person-card/agency/candidates" &&
        url.searchParams.get("q") === "Electrician"
      );
    });
    await page.locator("#candidateSearch").fill("Electrician");
    await page.locator("#candidateSearchButton").click();
    const searchResponse = await searchResponsePromise;
    assert.equal(searchResponse.status(), 200, "Search API must return 200");
    await page.waitForFunction(
      () => document.querySelector("#candidateCount")?.textContent === "1",
    );

    const filteredText = await page.locator("#candidateList").innerText();
    assert.match(filteredText, /Charlie Electrician/);
    assert.doesNotMatch(filteredText, /Alice Joiner|Bob Revoked/);

    assert.deepEqual(pageErrors, [], "Agency Desk must have no page errors");
    assert.deepEqual(consoleErrors, [], "Agency Desk must have no console errors");

    const requiredBoundaries = [
      ["GET", "/api/person-card/agency/_health", 200],
      ["GET", "/api/person-card/agency/account", 200],
      ["GET", "/api/person-card/agency/profile", 200],
      ["GET", "/api/person-card/agency/candidates", 200],
      ["GET", "/api/person-card/agency/activity", 200],
      [
        "POST",
        "/api/person-card/agency/candidates/nosmo-ui-e2e-worker-alice/actions",
        201,
      ],
    ];
    for (const [method, path, status] of requiredBoundaries) {
      assert.equal(
        evidence.some(
          (entry) =>
            entry.method === method &&
            entry.path === path &&
            entry.status === status,
        ),
        true,
        "Missing browser network evidence: " +
          method +
          " " +
          path +
          " " +
          status,
      );
    }

    console.log(
      "AGENCY_UI_API_E2E_PASS " +
        JSON.stringify({
          ui: "agency-desk.html",
          visibleCandidates: 2,
          revokedCandidateHidden: true,
          recruiterSafeProjection: true,
          shortlistPersisted: true,
          searchRendered: true,
          boundaries: evidence,
        }),
    );
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error("AGENCY_UI_API_E2E_FAIL", error);
  process.exitCode = 1;
});
