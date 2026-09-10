import { isDirectVacancyUrl } from "./job-link.ts";

export type VacancyIdentityInput = {
  applicationLink?: unknown;
  company?: unknown;
  role?: unknown;
  area?: unknown;
};

export const NEW_VACANCY_DAYS = 7;
export const FRESH_VACANCY_DAYS = 30;
export const LIVE_SEARCH_TOOL_CHOICE = "required" as const;
export const LIVE_SEARCH_CONTEXT_SIZE = "high" as const;
export const LIVE_SEARCH_REASONING_EFFORT = "medium" as const;
export const LIVE_SEARCH_RESULTS_PER_LANE = 8;
export const LIVE_SEARCH_RETURN_TOKEN_BUDGET = "unlimited" as const;
export const LIVE_SEARCH_START_TIMEOUT_MS = 12_000;
export const LIVE_SEARCH_POLL_TIMEOUT_MS = 10_000;
export const LIVE_SEARCH_POLL_INTERVAL_MS = 2_500;
export const LIVE_SEARCH_MAX_POLLS = 96;
const DAY_MS = 24 * 60 * 60 * 1000;

const TRACKING_QUERY_KEY = /^(utm_.+|gclid|fbclid|msclkid|source|src|referrer|ref_src|campaign)$/i;

function compact(value: unknown) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function utcDay(value: unknown) {
  const match = String(value || "").trim().match(/^(\d{4}-\d{2}-\d{2})/);
  if (!match) return null;
  const parsed = new Date(`${match[1]}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== match[1]) return null;
  return parsed.getTime();
}

export function isFreshVacancyDate(
  value: unknown,
  now = new Date(),
  maxAgeDays = FRESH_VACANCY_DAYS,
) {
  const postedDay = utcDay(value);
  if (postedDay === null || Number.isNaN(now.getTime())) return false;
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const ageDays = Math.floor((today - postedDay) / DAY_MS);
  return ageDays >= 0 && ageDays <= maxAgeDays;
}

export function canVerifyVacancyCandidate(
  publishedAt: unknown,
  dateEvidence: unknown,
  now = new Date(),
) {
  const date = String(publishedAt || "").trim();
  if (!date) return true;
  return isFreshVacancyDate(date, now) && Boolean(String(dateEvidence || "").trim());
}

export function vacancyAgeLabel(value: unknown, now = new Date()) {
  const postedDay = utcDay(value);
  if (postedDay === null || Number.isNaN(now.getTime())) return "";
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const ageDays = Math.floor((today - postedDay) / DAY_MS);
  if (ageDays === 0) return "Posted today";
  if (ageDays === 1) return "Posted yesterday";
  return ageDays > 1 ? `Posted ${ageDays} days ago` : "";
}

export function canonicalVacancyUrl(value: unknown) {
  if (!isDirectVacancyUrl(value)) return "";
  try {
    const url = new URL(String(value).trim());
    url.hash = "";
    url.hostname = url.hostname.toLowerCase();
    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_QUERY_KEY.test(key)) url.searchParams.delete(key);
    }
    url.searchParams.sort();
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString();
  } catch {
    return "";
  }
}

export function vacancyIdentity(job: VacancyIdentityInput) {
  const url = canonicalVacancyUrl(job.applicationLink);
  if (url) return `url:${url}`;
  return `job:${compact(job.company)}|${compact(job.role)}|${compact(job.area)}`;
}

export function mergeUniqueVacancies<T extends VacancyIdentityInput>(
  existing: T[],
  candidates: T[],
  limit = 20,
) {
  const seen = new Set(existing.map(vacancyIdentity));
  const added: T[] = [];
  for (const candidate of candidates) {
    if (!isDirectVacancyUrl(candidate.applicationLink)) continue;
    const identity = vacancyIdentity(candidate);
    if (seen.has(identity)) continue;
    seen.add(identity);
    added.push(candidate);
    if (added.length >= limit) break;
  }
  return added;
}

export function safeSearchBatch(value: unknown) {
  const batch = Number(value);
  return Number.isInteger(batch) ? Math.min(50, Math.max(1, batch)) : 1;
}

export function isBackgroundSearchPending(value: unknown) {
  return value === "queued" || value === "in_progress";
}

export function searchLanes(batch: number) {
  const rotation = ((safeSearchBatch(batch) - 1) % 3) + 1;
  const boardFocus = rotation === 1
    ? "major UK job boards; use the exact role plus Leeds and open individual advert pages"
    : rotation === 2
      ? "major UK job boards using trade synonyms, nearby West Yorkshire towns and result pages not used before"
      : "newest major-board vacancies using different query wording and individual advert pages not used before";
  const agencyFocus = rotation === 1
    ? "UK recruitment agencies with live construction, trades, driving, sales and local Leeds vacancy pages"
    : rotation === 2
      ? "specialist and regional recruitment agencies across West Yorkshire, using role synonyms"
      : "agency vacancies not used in earlier batches, prioritising newly posted individual adverts";
  const employerFocus = rotation === 1
    ? "direct employer career pages and ATS vacancy pages for the exact role around Leeds"
    : rotation === 2
      ? "local employers and contractors across Leeds, Bradford, Wakefield, Huddersfield, Halifax and Castleford"
      : "different direct employers and ATS pages across West Yorkshire, newest vacancies first";
  const localFocus = rotation === 1
    ? "local and specialist vacancy sites; expand the literal query with close trade titles without changing the occupation"
    : rotation === 2
      ? "local West Yorkshire vacancies and specialist boards using alternative job-title wording"
      : "remaining current direct vacancies from local and specialist sources not used in earlier batches";
  return [
    {
      id: "boards",
      label: "Major job boards",
      focus: boardFocus,
      allowedDomains: ["reed.co.uk", "cv-library.co.uk", "totaljobs.com", "indeed.com", "jobsite.co.uk", "careerstructure.com", "adzuna.co.uk", "constructionjobboard.co.uk"],
    },
    {
      id: "agencies",
      label: "Recruitment agencies",
      focus: agencyFocus,
      allowedDomains: ["danielowen.co.uk", "hays.co.uk", "randstad.co.uk", "search.co.uk", "fawkes-reece.com", "optionsresourcing.com", "buildrec.com", "psrsolutions.co.uk", "mcginley.co.uk", "setsquare.co.uk", "resourcinggroup.co.uk", "thornbaker.co.uk"],
    },
    { id: "employers", label: "Direct employers", focus: employerFocus },
    { id: "local", label: "Local & specialist", focus: localFocus },
  ];
}
