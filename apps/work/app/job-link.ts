const DIRECT_ID_KEYS = /^(id|job_?id|jk|vacancy_?id|position_?id|posting_?id|req_?id|requisition_?id|gh_jid)$/i;
const GENERIC_QUERY_KEYS = /^(q|query|search|keyword|keywords|location|category|page|sort)$/i;
const VACANCY_MARKER = /^(jobs?|vacancies?|positions?|roles?|careers?|apply|applications?|requisitions?|openings?|opportunities?)$/i;
const GENERIC_SEGMENT = /^(jobs?|job-search|search|vacancies?|browse-jobs?|careers?|positions?|roles?|open-roles|openings?|opportunities?|work-with-us|join-us|recruitment|apply|applications?)$/i;

function usefulSegment(value: string) {
  return value.length >= 3 && !GENERIC_SEGMENT.test(value) && !/^\d{1,2}$/.test(value);
}

/** A false negative is safer than sending Apply to a homepage or search list. */
export function isDirectVacancyUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    const url = new URL(value.trim());
    if (!/^https?:$/.test(url.protocol)) return false;
    const segments = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    if (!segments.length) return false;
    const keys = [...url.searchParams.keys()];
    const hasDirectId = keys.some((key) => DIRECT_ID_KEYS.test(key) && Boolean(url.searchParams.get(key)?.trim()));
    if (hasDirectId) return true;
    const last = segments.at(-1) || "";
    if (GENERIC_SEGMENT.test(last)) return false;
    const markerIndex = segments.findIndex((segment) => VACANCY_MARKER.test(segment));
    if (markerIndex >= 0) return segments.slice(markerIndex + 1).some(usefulSegment);
    if (url.hostname.toLowerCase() === "jobs.lever.co") return segments.length >= 2 && usefulSegment(last);
    if (keys.some((key) => GENERIC_QUERY_KEYS.test(key))) return false;
    return false;
  } catch {
    return false;
  }
}
