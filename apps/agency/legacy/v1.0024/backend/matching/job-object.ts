export type NexusJobSourceMode = "api" | "feed" | "external-link" | "synthetic";

export interface NexusJobObjectV1 {
  schema: "nexus-job-object/v1";
  id: string;
  source: {
    connectorId: string;
    provider: string;
    mode: NexusJobSourceMode;
    externalId: string;
    sourceUrl?: string;
    observedAt: string;
  };
  title: string;
  company?: string;
  location?: {
    display?: string;
    area?: string[];
    latitude?: number;
    longitude?: number;
  };
  descriptionSnippet?: string;
  salary?: {
    min?: number;
    max?: number;
    currency?: string;
    interval?: string;
    display?: string;
  };
  contract?: {
    fullTime?: boolean;
    partTime?: boolean;
    permanent?: boolean;
    contract?: boolean;
  };
  createdAt?: string;
  category?: string;
}

const cleanText = (value: unknown, max = 500): string | undefined => {
  if (typeof value !== "string") return undefined;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return undefined;
  return normalized.slice(0, max);
};

const finiteNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

export const createNexusJobId = (provider: string, externalId: string): string => {
  const safe = `${provider}:${externalId}`
    .toLowerCase()
    .replace(/[^a-z0-9:_-]+/g, "-")
    .slice(0, 180);
  return `job:${safe}`;
};

export const normalizeAdzunaJob = (
  raw: Record<string, unknown>,
  observedAt = new Date().toISOString(),
): NexusJobObjectV1 | null => {
  const externalId = cleanText(raw.id, 120);
  const title = cleanText(raw.title, 200);
  if (!externalId || !title) return null;

  const companyObject =
    raw.company && typeof raw.company === "object"
      ? (raw.company as Record<string, unknown>)
      : undefined;
  const locationObject =
    raw.location && typeof raw.location === "object"
      ? (raw.location as Record<string, unknown>)
      : undefined;
  const categoryObject =
    raw.category && typeof raw.category === "object"
      ? (raw.category as Record<string, unknown>)
      : undefined;

  const area = Array.isArray(locationObject?.area)
    ? locationObject?.area
        .map((item) => cleanText(item, 120))
        .filter((item): item is string => Boolean(item))
        .slice(0, 8)
    : undefined;

  const salaryMin = finiteNumber(raw.salary_min);
  const salaryMax = finiteNumber(raw.salary_max);
  const salaryDisplay =
    salaryMin !== undefined || salaryMax !== undefined
      ? [
          salaryMin !== undefined ? String(Math.round(salaryMin)) : undefined,
          salaryMax !== undefined ? String(Math.round(salaryMax)) : undefined,
        ]
          .filter(Boolean)
          .join(" – ")
      : undefined;

  return {
    schema: "nexus-job-object/v1",
    id: createNexusJobId("adzuna", externalId),
    source: {
      connectorId: "adzuna-jobs",
      provider: "Adzuna",
      mode: "api",
      externalId,
      sourceUrl: cleanText(raw.redirect_url, 1000),
      observedAt,
    },
    title,
    company: cleanText(companyObject?.display_name, 200),
    location: {
      display: cleanText(locationObject?.display_name, 250),
      area,
      latitude: finiteNumber(raw.latitude),
      longitude: finiteNumber(raw.longitude),
    },
    descriptionSnippet: cleanText(raw.description, 700),
    salary:
      salaryMin !== undefined || salaryMax !== undefined
        ? {
            min: salaryMin,
            max: salaryMax,
            currency: "GBP",
            display: salaryDisplay,
          }
        : undefined,
    contract: {
      fullTime: raw.full_time === 1 || raw.full_time === true,
      partTime: raw.part_time === 1 || raw.part_time === true,
      permanent: raw.contract_type === "permanent" || raw.contract_time === "permanent",
      contract: raw.contract_type === "contract" || raw.contract_time === "contract",
    },
    createdAt: cleanText(raw.created, 80),
    category: cleanText(categoryObject?.label, 160),
  };
};
