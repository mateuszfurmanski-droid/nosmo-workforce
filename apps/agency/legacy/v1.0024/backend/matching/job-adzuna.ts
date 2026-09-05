import { normalizeAdzunaJob, type NexusJobObjectV1 } from "./job-object";

export class NexusJobConnectorError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message = code,
  ) {
    super(message);
  }
}

export interface NexusJobSearchInput {
  what: string;
  where?: string;
  country: string;
  page: number;
  resultsPerPage: number;
}

export interface NexusJobSearchResult {
  schema: "nexus-job-search-result/v1";
  connectorId: "adzuna-jobs";
  provider: "Adzuna";
  query: NexusJobSearchInput;
  observedAt: string;
  total?: number;
  results: NexusJobObjectV1[];
  providerWritePerformed: false;
  applicationPerformed: false;
}

const requireEnv = (name: "ADZUNA_APP_ID" | "ADZUNA_APP_KEY"): string => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new NexusJobConnectorError(
      "NEXUS_JOB_CONNECTOR_NOT_CONFIGURED",
      503,
      `${name} is not configured`,
    );
  }
  return value;
};

export const searchAdzunaJobs = async (
  input: NexusJobSearchInput,
): Promise<NexusJobSearchResult> => {
  const appId = requireEnv("ADZUNA_APP_ID");
  const appKey = requireEnv("ADZUNA_APP_KEY");
  const params = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    results_per_page: String(input.resultsPerPage),
    what: input.what,
    "content-type": "application/json",
  });
  if (input.where) params.set("where", input.where);

  const endpoint =
    `https://api.adzuna.com/v1/api/jobs/${encodeURIComponent(input.country)}/search/${input.page}?${params.toString()}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  let response: Response;
  try {
    response = await fetch(endpoint, {
      headers: { accept: "application/json", "user-agent": "NOSMO-Nexus/1.0" },
      signal: controller.signal,
    });
  } catch (error) {
    throw new NexusJobConnectorError(
      "NEXUS_JOB_PROVIDER_UNAVAILABLE",
      502,
      error instanceof Error ? error.message : "Provider request failed",
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new NexusJobConnectorError(
      "NEXUS_JOB_PROVIDER_REJECTED",
      response.status === 429 ? 429 : 502,
      `Adzuna returned HTTP ${response.status}`,
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new NexusJobConnectorError("NEXUS_JOB_PROVIDER_INVALID_JSON", 502);
  }

  if (!payload || typeof payload !== "object") {
    throw new NexusJobConnectorError("NEXUS_JOB_PROVIDER_INVALID_PAYLOAD", 502);
  }

  const record = payload as Record<string, unknown>;
  const rawResults = Array.isArray(record.results) ? record.results : [];
  const observedAt = new Date().toISOString();
  const results = rawResults
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => normalizeAdzunaJob(item, observedAt))
    .filter((item): item is NexusJobObjectV1 => Boolean(item));

  return {
    schema: "nexus-job-search-result/v1",
    connectorId: "adzuna-jobs",
    provider: "Adzuna",
    query: input,
    observedAt,
    total: typeof record.count === "number" && Number.isFinite(record.count) ? record.count : undefined,
    results,
    providerWritePerformed: false,
    applicationPerformed: false,
  };
};
