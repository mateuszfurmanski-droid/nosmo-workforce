import { NextResponse } from "next/server";
import { getChatGPTUser } from "../../chatgpt-auth";
import { isDirectVacancyUrl } from "../../job-link";
import {
  canVerifyVacancyCandidate,
  canonicalVacancyUrl,
  FRESH_VACANCY_DAYS,
  isBackgroundSearchPending,
  isFreshVacancyDate,
  LIVE_SEARCH_CONTEXT_SIZE,
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
  vacancyAgeLabel,
  type VacancyIdentityInput,
} from "../../search-v2";

const unavailablePage = /\b(job|vacancy|position).{0,35}(expired|closed|filled|no longer available|removed)|page not found|404 not found/i;
const speculativeRole = /\b(multiple|various employers|roles listed|job aggregator)\b/i;

type SearchJob = VacancyIdentityInput & Record<string, unknown>;
type SearchLane = ReturnType<typeof searchLanes>[number];
type BackgroundTask = { responseId: string; laneId: string };
type CompletedLane = { lane: SearchLane; result: Record<string, unknown> };

class SearchUpstreamError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function isPublicHostname(hostname: string) {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host === "0.0.0.0" || host === "::1") return false;
  if (/^10\.|^127\.|^169\.254\.|^192\.168\./.test(host)) return false;
  const private172 = host.match(/^172\.(\d+)\./);
  return !private172 || Number(private172[1]) < 16 || Number(private172[1]) > 31;
}

function safeString(value: unknown, limit: number) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function safeList(value: unknown, limit: number, itemLimit: number) {
  return Array.isArray(value)
    ? value.map((item) => safeString(item, itemLimit)).filter(Boolean).slice(0, limit)
    : [];
}

function safeExisting(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 120).map((item) => {
    const record = item && typeof item === "object" ? item as Record<string, unknown> : {};
    return {
      company: safeString(record.company, 100),
      role: safeString(record.role, 120),
      area: safeString(record.area, 100),
      applicationLink: canonicalVacancyUrl(record.applicationLink),
    };
  });
}

function safeProfile(value: unknown) {
  const profile = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    availableFrom: safeString(profile.availableFrom, 40),
    travel: safeString(profile.travel, 160),
    preferredWork: safeString(profile.preferredWork, 160),
    preferredShifts: safeString(profile.preferredShifts, 160),
  };
}

function safeJobSearchCriteria(value: unknown) {
  const criteria = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const radius = Number(criteria.radiusMiles);
  const freshness = Number(criteria.postedWithinDays);
  const workPattern = safeString(criteria.workPattern, 30);
  return {
    location: safeString(criteria.location, 80) || "Leeds",
    radiusMiles: [5, 15, 30, 50].includes(radius) ? radius : 15,
    postedWithinDays: [7, 14, 30].includes(freshness) ? freshness : FRESH_VACANCY_DAYS,
    workPattern: ["Any", "Contract", "Permanent", "Temporary"].includes(workPattern) ? workPattern : "Any",
  };
}

function cutoffDate(now: Date, days: number) {
  const day = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return new Date(day - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

type JobPostingDetails = { postedDate: string; validThrough: string };

function findJobPostingDetails(value: unknown): JobPostingDetails | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findJobPostingDetails(item);
      if (found) return found;
    }
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const types = Array.isArray(record["@type"]) ? record["@type"] : [record["@type"]];
  if (types.some((type) => String(type).toLowerCase() === "jobposting")) {
    const date = record.datePosted || record.datePublished;
    return {
      postedDate: typeof date === "string" ? date.trim() : "",
      validThrough: typeof record.validThrough === "string" ? record.validThrough.trim() : "",
    };
  }
  for (const nested of Object.values(record)) {
    const found = findJobPostingDetails(nested);
    if (found) return found;
  }
  return null;
}

function extractJobPostingDetails(html: string): JobPostingDetails {
  const decoded = html.replace(/&quot;|&#34;/gi, '"').replace(/&#39;|&apos;/gi, "'");
  const scripts = decoded.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const script of scripts) {
    try {
      const found = findJobPostingDetails(JSON.parse(script[1].replace(/^\s*<!--|-->\s*$/g, "").trim()));
      if (found) return found;
    } catch {}
  }
  const posted = decoded.match(/["']datePosted["']\s*:\s*["']([^"']+)["']/i)?.[1]?.trim() || "";
  const validThrough = decoded.match(/["']validThrough["']\s*:\s*["']([^"']+)["']/i)?.[1]?.trim() || "";
  return { postedDate: posted, validThrough };
}

function isExpiredDate(value: unknown, now: Date) {
  const match = String(value || "").trim().match(/^(\d{4}-\d{2}-\d{2})/);
  if (!match) return false;
  const expiry = Date.parse(`${match[1]}T23:59:59Z`);
  return Number.isFinite(expiry) && expiry < now.getTime();
}

async function readPageStart(response: Response, limit = 96_000) {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";
  try {
    while (size < limit) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = value.subarray(0, Math.max(0, limit - size));
      size += chunk.byteLength;
      text += decoder.decode(chunk, { stream: true });
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  return text;
}

async function verifyLiveVacancy(job: SearchJob, now: Date) {
  if (!isDirectVacancyUrl(job.applicationLink)) return null;
  const claimedDate = safeString(job.publishedAt, 40);
  const dateEvidence = safeString(job.dateEvidence, 180);
  if (!canVerifyVacancyCandidate(claimedDate, dateEvidence, now)) return null;
  const publishedAt = claimedDate ? claimedDate.slice(0, 10) : "";
  const applicationLink = canonicalVacancyUrl(job.applicationLink);
  const checkedAt = new Date().toISOString();
  const unverified = publishedAt ? {
    ...job,
    applicationLink,
    publishedAt,
    listingAge: vacancyAgeLabel(publishedAt, now),
    freshnessVerified: false,
    linkVerified: false,
    checkedAt,
  } : null;
  try {
    const requested = new URL(applicationLink);
    if (!isPublicHostname(requested.hostname)) return null;
    const response = await fetch(requested, {
      redirect: "follow",
      signal: AbortSignal.timeout(6_000),
      headers: {
        Accept: "text/html,application/xhtml+xml",
        Range: "bytes=0-95999",
        "User-Agent": "Mozilla/5.0 (compatible; NOSMO-Work-Link-Check/2.0)",
      },
    });
    if (response.status === 404 || response.status === 410) return null;
    if (!response.ok) return unverified;
    if (!isDirectVacancyUrl(response.url)) return null;
    const finalUrl = new URL(response.url);
    if (!isPublicHostname(finalUrl.hostname)) return null;
    const pageStart = await readPageStart(response);
    if (unavailablePage.test(pageStart.replace(/<[^>]+>/g, " ").replace(/\s+/g, " "))) return null;
    const sourceDetails = extractJobPostingDetails(pageStart);
    const sourceDate = sourceDetails.postedDate;
    if (sourceDate && !isFreshVacancyDate(sourceDate, now)) return null;
    if (isExpiredDate(sourceDetails.validThrough, now)) return null;
    const confirmedDate = sourceDate ? sourceDate.slice(0, 10) : publishedAt;
    return {
      ...job,
      applicationLink: canonicalVacancyUrl(response.url),
      publishedAt: confirmedDate,
      listingAge: confirmedDate ? vacancyAgeLabel(confirmedDate, now) : "Active - date not shown",
      freshnessVerified: Boolean(sourceDate),
      linkVerified: true,
      checkedAt,
    };
  } catch {
    return unverified;
  }
}

function parseJobPayload(raw: string) {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const accept = (value: unknown) => Array.isArray(value)
    ? value
    : value && typeof value === "object" && Array.isArray((value as { jobs?: unknown }).jobs)
      ? (value as { jobs: unknown[] }).jobs
      : null;
  try {
    const parsed = accept(JSON.parse(cleaned));
    if (parsed) return parsed;
  } catch {}
  for (let start = cleaned.indexOf("["); start >= 0; start = cleaned.indexOf("[", start + 1)) {
    let depth = 0;
    let quoted = false;
    let escaped = false;
    for (let i = start; i < cleaned.length; i += 1) {
      const char = cleaned[i];
      if (quoted) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === '"') quoted = false;
      } else if (char === '"') quoted = true;
      else if (char === "[") depth += 1;
      else if (char === "]" && --depth === 0) {
        try { return JSON.parse(cleaned.slice(start, i + 1)); } catch { break; }
      }
    }
  }
  throw new SearchUpstreamError("The AI returned an unreadable result.", "invalid_ai_result", 502);
}

function responseText(result: Record<string, unknown>) {
  if (typeof result.output_text === "string") return result.output_text;
  const output = Array.isArray(result.output) ? result.output : [];
  return output.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    return Array.isArray((item as { content?: unknown }).content) ? (item as { content: unknown[] }).content : [];
  }).map((item) => item && typeof item === "object" && typeof (item as { text?: unknown }).text === "string" ? (item as { text: string }).text : "").join("");
}

function webSearchDiagnostics(result: Record<string, unknown>) {
  const output = Array.isArray(result.output) ? result.output : [];
  const calls = output.filter((item) => item && typeof item === "object" && (item as { type?: unknown }).type === "web_search_call");
  let searches = 0;
  let openedPages = 0;
  let findActions = 0;
  let consultedSources = 0;
  for (const call of calls) {
    const action = (call as { action?: unknown }).action;
    if (!action || typeof action !== "object") continue;
    const record = action as Record<string, unknown>;
    if (record.type === "search") {
      searches += Array.isArray(record.queries) && record.queries.length ? record.queries.length : 1;
    } else if (record.type === "open_page") openedPages += 1;
    else if (record.type === "find_in_page") findActions += 1;
    consultedSources += Array.isArray(record.sources) ? record.sources.length : 0;
  }
  return { searches, actions: calls.length, openedPages, findActions, consultedSources };
}

function safeBackgroundTasks(value: unknown, batch: number): Array<BackgroundTask & { lane: SearchLane }> {
  const lanes = new Map(searchLanes(batch).map((lane) => [lane.id, lane]));
  const seen = new Set<string>();
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const record = item && typeof item === "object" ? item as Record<string, unknown> : {};
    const responseId = safeString(record.responseId, 220);
    const laneId = safeString(record.laneId, 40);
    const lane = lanes.get(laneId);
    if (!lane || !/^resp_[A-Za-z0-9_-]{10,210}$/.test(responseId) || seen.has(responseId)) return [];
    seen.add(responseId);
    return [{ responseId, laneId, lane }];
  }).slice(0, searchLanes(batch).length);
}

function safeLaneErrors(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 8).flatMap((item) => {
    const record = item && typeof item === "object" ? item as Record<string, unknown> : {};
    const lane = safeString(record.lane, 80);
    const message = safeString(record.message, 180);
    return lane && message ? [{ lane, message }] : [];
  });
}

async function startBackgroundLane({
  lane,
  apiKey,
  query,
  batch,
  profile,
  jobTypes,
  criteria,
  existing,
}: {
  lane: SearchLane;
  apiKey: string;
  query: string;
  batch: number;
  profile: ReturnType<typeof safeProfile>;
  jobTypes: string[];
  criteria: ReturnType<typeof safeJobSearchCriteria>;
  existing: ReturnType<typeof safeExisting>;
}) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const priorityDays = Math.min(NEW_VACANCY_DAYS, criteria.postedWithinDays);
  const newAfter = cutoffDate(now, priorityDays);
  const freshAfter = cutoffDate(now, criteria.postedWithinDays);
  const patternRule = criteria.workPattern === "Any"
    ? "Any contract type is acceptable."
    : `Return only ${criteria.workPattern.toLowerCase()} roles when the advert states a contract type.`;
  const prompt = `Today is ${today}. Find current individual job vacancies for the literal request ${JSON.stringify(query)}. This is batch ${batch}, source lane ${JSON.stringify(lane.label)}. Focus only on: ${lane.focus}. Perform at least three distinct search actions with different useful query wording, then open promising individual adverts. Do not stop after the first match. Aim for ${LIVE_SEARCH_RESULTS_PER_LANE} different vacancies when they exist. The user's literal request is authoritative. CV-backed roles ${JSON.stringify(jobTypes)} may supply close title synonyms but must never narrow or replace the requested occupation. Worker context: ${JSON.stringify(profile)}. Search location: ${JSON.stringify(criteria.location)}, within approximately ${criteria.radiusMiles} miles. ${patternRule} Only accept vacancies explicitly posted or reposted from ${freshAfter} through ${today}; prioritize those posted from ${newAfter} through ${today}. Reject an explicit date older than ${freshAfter}. An explicit relative label such as "3 days ago" may be converted to YYYY-MM-DD using today's date, but preserve the visible words in dateEvidence. Never invent a date. If an individual advert appears open but has no visible date, use empty strings for publishedAt and dateEvidence so the server can inspect it. Return the exact direct individual advert or application URL, never a homepage, search-results page, category page, speculative listing, expired role, multi-employer page or invented URL. Do not discard a real vacancy because optional pay, hours, distance, transport or contact details are absent; use an empty string. Exclude prior results: ${JSON.stringify(existing)}. Use different searches and pages from earlier batches. Return JSON only.`;
  const searchTool = {
    type: "web_search",
    search_context_size: LIVE_SEARCH_CONTEXT_SIZE,
    return_token_budget: LIVE_SEARCH_RETURN_TOKEN_BUDGET,
    user_location: { type: "approximate", country: "GB", city: criteria.location },
    ...(lane.allowedDomains?.length ? { filters: { allowed_domains: lane.allowedDomains } } : {}),
  };
  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: AbortSignal.timeout(LIVE_SEARCH_START_TIMEOUT_MS),
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5.6-terra",
        reasoning: { effort: LIVE_SEARCH_REASONING_EFFORT },
        max_output_tokens: 6_000,
        background: true,
        store: false,
        tool_choice: LIVE_SEARCH_TOOL_CHOICE,
        include: ["web_search_call.action.sources"],
        tools: [searchTool],
        text: {
          format: {
            type: "json_schema",
            name: `nosmo_${lane.id}_vacancies`,
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["jobs"],
              properties: {
                jobs: {
                  type: "array",
                  maxItems: LIVE_SEARCH_RESULTS_PER_LANE,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["company", "role", "area", "shift", "distance", "travelTime", "pay", "category", "transport", "applicationLink", "method", "note", "source", "publishedAt", "dateEvidence"],
                    properties: {
                      company: { type: "string" }, role: { type: "string" }, area: { type: "string" },
                      shift: { type: "string" }, distance: { type: "string" }, travelTime: { type: "string" },
                      pay: { type: "string" }, category: { type: "string" }, transport: { type: "string" },
                      applicationLink: { type: "string" }, method: { type: "string" }, note: { type: "string" }, source: { type: "string" },
                      publishedAt: { type: "string", description: "Supported vacancy posting date in YYYY-MM-DD, or empty only when an open individual vacancy page shows no date." },
                      dateEvidence: { type: "string", description: "Visible absolute or relative posting-date wording supporting publishedAt, or empty together with publishedAt." },
                    },
                  },
                },
              },
            },
          },
        },
        input: prompt,
      }),
    });
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new SearchUpstreamError(`${lane.label} took too long to start.`, "search_start_timeout", 504);
    }
    throw new SearchUpstreamError(`${lane.label} could not reach live web search.`, "web_search_unavailable", 502);
  }
  if (!response.ok) {
    const failure = await response.json().catch(() => ({}));
    const error = failure && typeof failure === "object" ? (failure as { error?: { code?: string; type?: string } }).error : undefined;
    const code = error?.code || error?.type || "upstream_error";
    const message = code === "insufficient_quota" || code === "credit_balance_exhausted"
      ? "API credit is not available. Check the OpenAI API balance."
      : code === "model_not_found"
        ? "The configured AI model is unavailable."
        : `${lane.label} could not start.`;
    throw new SearchUpstreamError(message, code, response.status === 429 ? 429 : 502);
  }
  const result = await response.json() as Record<string, unknown>;
  const responseId = safeString(result.id, 220);
  if (!/^resp_[A-Za-z0-9_-]{10,210}$/.test(responseId)) {
    throw new SearchUpstreamError(`${lane.label} did not return a valid task ID.`, "invalid_response_id", 502);
  }
  return { responseId, laneId: lane.id, status: safeString(result.status, 40) || "queued" };
}

async function retrieveBackgroundSearch(apiKey: string, responseId: string) {
  let response: Response;
  try {
    response = await fetch(`https://api.openai.com/v1/responses/${encodeURIComponent(responseId)}`, {
      signal: AbortSignal.timeout(LIVE_SEARCH_POLL_TIMEOUT_MS),
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) return null;
    throw new SearchUpstreamError("Could not check live-search progress.", "search_poll_unavailable", 503);
  }
  if (!response.ok) {
    const retryable = response.status === 429 || response.status >= 500;
    throw new SearchUpstreamError(
      response.status === 404 ? "This background search expired. Start it again." : "Could not retrieve the live-search result.",
      response.status === 404 ? "search_expired" : retryable ? "search_poll_retryable" : "search_poll_failed",
      response.status === 404 ? 410 : 502,
    );
  }
  return await response.json() as Record<string, unknown>;
}

async function finalizeSearch(
  completed: CompletedLane[],
  batch: number,
  existing: ReturnType<typeof safeExisting>,
  initialLaneErrors: Array<{ lane: string; message: string }>,
  criteria: ReturnType<typeof safeJobSearchCriteria>,
) {
  const now = new Date();
  const freshAfter = cutoffDate(now, criteria.postedWithinDays);
  const newDays = Math.min(NEW_VACANCY_DAYS, criteria.postedWithinDays);
  const lanes = searchLanes(batch);
  const rawJobs: SearchJob[] = [];
  const laneErrors = [...initialLaneErrors];
  const laneDiagnostics: Array<Record<string, unknown>> = [];
  let webSearchCalls = 0;
  let webSearchActions = 0;
  let consultedSources = 0;
  for (const { lane, result } of completed) {
    const diagnostics = webSearchDiagnostics(result);
    webSearchCalls += diagnostics.searches;
    webSearchActions += diagnostics.actions;
    consultedSources += diagnostics.consultedSources;
    let jobs: unknown[] = [];
    try {
      jobs = parseJobPayload(responseText(result));
    } catch (error) {
      laneErrors.push({ lane: lane.label, message: error instanceof Error ? error.message : "Unreadable AI result" });
    }
    if (!diagnostics.searches) laneErrors.push({ lane: lane.label, message: "No live search action completed" });
    const laneJobs = diagnostics.searches ? jobs.map((job) => ({
      ...(job && typeof job === "object" ? job as Record<string, unknown> : {}),
      searchLane: lane.label,
    })) as SearchJob[] : [];
    rawJobs.push(...laneJobs);
    laneDiagnostics.push({ lane: lane.label, candidates: laneJobs.length, ...diagnostics });
  }
  const invalidDirectLinks = rawJobs.filter((job) => !isDirectVacancyUrl(job.applicationLink)).length;
  const speculativeListings = rawJobs.filter((job) => speculativeRole.test(safeString(job.role, 160))).length;
  const candidateHasAcceptedDate = (job: SearchJob) => {
    const publishedAt = safeString(job.publishedAt, 40);
    return canVerifyVacancyCandidate(publishedAt, job.dateEvidence, now) &&
      (!publishedAt || isFreshVacancyDate(publishedAt, now, criteria.postedWithinDays));
  };
  const staleOrUnsupportedDates = rawJobs.filter((job) => !candidateHasAcceptedDate(job)).length;
  const structurallyValid = rawJobs.filter((job) =>
    isDirectVacancyUrl(job.applicationLink) &&
    !speculativeRole.test(safeString(job.role, 160)) &&
    candidateHasAcceptedDate(job),
  )
    .sort((left, right) => {
      const leftTime = Date.parse(safeString(left.publishedAt, 40)) || 0;
      const rightTime = Date.parse(safeString(right.publishedAt, 40)) || 0;
      return rightTime - leftTime;
    });
  const previousJobs: SearchJob[] = existing.map((job) => ({ ...job }));
  const newCandidates = mergeUniqueVacancies<SearchJob>(previousJobs, structurallyValid, 20);
  const checked = await Promise.all(newCandidates.map((job) => {
    const publishedAt = safeString(job.publishedAt, 40).slice(0, 10);
    if (!publishedAt) return verifyLiveVacancy(job, now);
    return Promise.resolve({
      ...job,
      applicationLink: canonicalVacancyUrl(job.applicationLink),
      publishedAt,
      listingAge: vacancyAgeLabel(publishedAt, now),
      freshnessVerified: true,
      linkVerified: false,
      checkedAt: new Date().toISOString(),
    });
  }));
  const liveJobs = mergeUniqueVacancies<SearchJob>(previousJobs, checked.filter((job): job is NonNullable<typeof job> => Boolean(job)), 20);
  const rejectedByPageCheck = checked.filter((job) => !job).length;
  console.log("[autopilot] live search completed", JSON.stringify({
    batch,
    lanes: laneDiagnostics,
    candidates: rawJobs.length,
    invalidDirectLinks,
    speculativeListings,
    staleOrUnsupportedDates,
    directCandidates: newCandidates.length,
    rejectedByPageCheck,
    returned: liveJobs.length,
  }));
  return {
    mode: "live",
    batch,
    requested: 20,
    returned: liveJobs.length,
    totalCandidates: rawJobs.length,
    sourceGroups: completed.length,
    webSearchCalls,
    webSearchActions,
    consultedSources,
    directCandidates: newCandidates.length,
    rejected: rawJobs.length - liveJobs.length,
    partial: liveJobs.length < 20,
    freshnessDays: criteria.postedWithinDays,
    newDays,
    newThisWeek: liveJobs.filter((job) => isFreshVacancyDate(job.publishedAt, now, newDays)).length,
    datedCurrent: liveJobs.filter((job) => Boolean(safeString(job.publishedAt, 40))).length,
    activeWithoutDate: liveJobs.filter((job) => !safeString(job.publishedAt, 40)).length,
    freshAfter,
    lanes: lanes.map((lane) => lane.label),
    rejectionBreakdown: { invalidDirectLinks, speculativeListings, staleOrUnsupportedDates, rejectedByPageCheck },
    laneDiagnostics,
    laneErrors,
    jobs: liveJobs,
  };
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) {
    return NextResponse.json({
      error: "Sign in with ChatGPT to use the live AI search. The public demo stays viewable without sign-in.",
      code: "sign_in_required",
    }, { status: 401 });
  }
  const allowedEmails = (process.env.NOSMO_SEARCH_ALLOWED_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  if (allowedEmails.length && !allowedEmails.includes(user.email.toLowerCase())) {
    return NextResponse.json({ error: "Live AI search is not enabled for this account.", code: "search_not_enabled" }, { status: 403 });
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Ask Nexus AI is not configured on this deployment.", code: "not_configured" }, { status: 503 });

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid search request.", code: "invalid_request" }, { status: 400 });
  }
  const action = safeString(body.action, 20);
  const batch = safeSearchBatch(body.batch);
  const existing = safeExisting(body.existing);
  const criteria = safeJobSearchCriteria(body.criteria);
  try {
    if (action === "poll") {
      const tasks = safeBackgroundTasks(body.tasks, batch);
      if (!tasks.length) {
        return NextResponse.json({ error: "Invalid background search tasks.", code: "invalid_background_tasks", terminal: true }, { status: 400 });
      }
      const initialLaneErrors = safeLaneErrors(body.laneErrors);
      const settled = await Promise.allSettled(tasks.map(async (task) => ({
        task,
        result: await retrieveBackgroundSearch(apiKey, task.responseId),
      })));
      const retryableCodes = new Set(["search_poll_unavailable", "search_poll_retryable"]);
      const stillPending = settled.some((entry) => {
        if (entry.status === "fulfilled") {
          return !entry.value.result || isBackgroundSearchPending(entry.value.result.status);
        }
        return entry.reason instanceof SearchUpstreamError && retryableCodes.has(entry.reason.code);
      });
      if (stillPending) {
        return NextResponse.json({
          mode: "background",
          status: "in_progress",
          tasks: tasks.map(({ responseId, laneId }) => ({ responseId, laneId })),
          batch,
          pollAfterMs: 2_500,
          laneErrors: initialLaneErrors,
        }, {
          status: 202,
          headers: { "Cache-Control": "no-store" },
        });
      }
      const completed: CompletedLane[] = [];
      const terminalLaneErrors = [...initialLaneErrors];
      settled.forEach((entry, index) => {
        const lane = tasks[index].lane;
        if (entry.status === "rejected") {
          terminalLaneErrors.push({
            lane: lane.label,
            message: entry.reason instanceof Error ? entry.reason.message : "Source group failed",
          });
          return;
        }
        const status = safeString(entry.value.result?.status, 40);
        if (status === "completed" && entry.value.result) {
          completed.push({ lane, result: entry.value.result });
        } else {
          terminalLaneErrors.push({ lane: lane.label, message: `Search ended with status ${status || "unknown"}` });
        }
      });
      if (!completed.length) {
        throw new SearchUpstreamError("All source groups ended before producing a result. Start a new search.", "all_search_lanes_failed", 502);
      }
      return NextResponse.json(await finalizeSearch(completed, batch, existing, terminalLaneErrors, criteria), { headers: { "Cache-Control": "no-store" } });
    }

    const query = safeString(body.query, 240);
    if (!query) return NextResponse.json({ error: "Enter what kind of work you need.", code: "empty_query" }, { status: 400 });
    const profile = safeProfile(body.profile);
    const jobTypes = safeList(body.jobTypes, 30, 80);
    const lanes = searchLanes(batch);
    const settled = await Promise.allSettled(lanes.map((lane) =>
      startBackgroundLane({ lane, apiKey, query, batch, profile, jobTypes, criteria, existing }),
    ));
    const tasks: BackgroundTask[] = [];
    const laneErrors: Array<{ lane: string; message: string }> = [];
    settled.forEach((entry, index) => {
      if (entry.status === "fulfilled") {
        tasks.push({ responseId: entry.value.responseId, laneId: entry.value.laneId });
      } else {
        laneErrors.push({
          lane: lanes[index].label,
          message: entry.reason instanceof Error ? entry.reason.message : "Source group could not start",
        });
      }
    });
    if (!tasks.length) {
      const firstFailure = settled.find((entry) => entry.status === "rejected");
      if (firstFailure?.status === "rejected" && firstFailure.reason instanceof SearchUpstreamError) throw firstFailure.reason;
      throw new SearchUpstreamError("No live-search source group could start.", "all_search_lanes_failed", 502);
    }
    console.log("[autopilot] background lanes started", JSON.stringify({ batch, started: tasks.length, failed: laneErrors.length }));
    return NextResponse.json({
      mode: "background",
      status: "in_progress",
      tasks,
      batch,
      pollAfterMs: 2_500,
      laneErrors,
      lanes: lanes.map((lane) => lane.label),
    }, { status: 202, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const failure = error instanceof SearchUpstreamError
      ? error
      : new SearchUpstreamError("Ask Nexus could not complete the live search.", "upstream_error", 502);
    const retryablePollFailure = action === "poll" && ["search_poll_unavailable", "search_poll_retryable"].includes(failure.code);
    return NextResponse.json({ error: failure.message, code: failure.code, batch, terminal: !retryablePollFailure }, { status: failure.status });
  }
}
