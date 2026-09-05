import OpenAI from "openai";
import { Router, type IRouter, type Request } from "express";
import type { NexusJobObjectV1 } from "./job-object";

const router: IRouter = Router();
const MAX_JOBS = 12;
const MAX_TEXT = 300;
const MAX_ARRAY = 12;

type SafeWorkProfile = {
  personId: string;
  trade?: string;
  targetRoles: string[];
  preferredLocations: string[];
  availability?: string;
  experienceSummary?: string;
  readiness: {
    cv?: string;
    certificates?: string;
    references?: string;
  };
};

const cleanText = (value: unknown, max = MAX_TEXT): string | undefined => {
  if (typeof value !== "string") return undefined;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return undefined;
  return normalized.slice(0, max);
};

const cleanArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .map((item) => cleanText(item, 120))
        .filter((item): item is string => Boolean(item))
        .slice(0, MAX_ARRAY)
    : [];

const safeProfileFromBody = (value: unknown): SafeWorkProfile | null => {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const personId = cleanText(raw.personId, 160);
  if (!personId) return null;

  const readinessRaw =
    raw.readiness && typeof raw.readiness === "object"
      ? (raw.readiness as Record<string, unknown>)
      : {};

  return {
    personId,
    trade: cleanText(raw.trade, 160),
    targetRoles: cleanArray(raw.targetRoles),
    preferredLocations: cleanArray(raw.preferredLocations),
    availability: cleanText(raw.availability, 120),
    experienceSummary: cleanText(raw.experienceSummary, 500),
    readiness: {
      cv: cleanText(readinessRaw.cv, 80),
      certificates: cleanText(readinessRaw.certificates, 80),
      references: cleanText(readinessRaw.references, 80),
    },
  };
};

const safeJobsFromBody = (value: unknown): NexusJobObjectV1[] => {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, MAX_JOBS)
    .filter((job): job is NexusJobObjectV1 => {
      if (!job || typeof job !== "object") return false;
      const record = job as Partial<NexusJobObjectV1>;
      return (
        record.schema === "nexus-job-object/v1" &&
        typeof record.id === "string" &&
        typeof record.title === "string"
      );
    })
    .map((job) => ({
      schema: "nexus-job-object/v1" as const,
      id: job.id.slice(0, 200),
      source: {
        connectorId: cleanText(job.source?.connectorId, 100) ?? "unknown",
        provider: cleanText(job.source?.provider, 100) ?? "unknown",
        mode: job.source?.mode ?? "feed",
        externalId: cleanText(job.source?.externalId, 160) ?? job.id.slice(0, 160),
        observedAt: cleanText(job.source?.observedAt, 80) ?? new Date().toISOString(),
      },
      title: cleanText(job.title, 200) ?? "Untitled job",
      company: cleanText(job.company, 160),
      location: {
        display: cleanText(job.location?.display, 200),
        area: cleanArray(job.location?.area),
      },
      descriptionSnippet: cleanText(job.descriptionSnippet, 700),
      salary: job.salary
        ? {
            min: typeof job.salary.min === "number" ? job.salary.min : undefined,
            max: typeof job.salary.max === "number" ? job.salary.max : undefined,
            currency: cleanText(job.salary.currency, 10),
            interval: cleanText(job.salary.interval, 40),
            display: cleanText(job.salary.display, 120),
          }
        : undefined,
      contract: job.contract
        ? {
            fullTime: Boolean(job.contract.fullTime),
            partTime: Boolean(job.contract.partTime),
            permanent: Boolean(job.contract.permanent),
            contract: Boolean(job.contract.contract),
          }
        : undefined,
      createdAt: cleanText(job.createdAt, 80),
      category: cleanText(job.category, 120),
    }));
};

const requireAuthenticated = (req: Request): boolean =>
  typeof req.isAuthenticated === "function" && req.isAuthenticated();

const outputSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    ranked: {
      type: "array",
      maxItems: MAX_JOBS,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          jobId: { type: "string" },
          score: { type: "integer", minimum: 0, maximum: 100 },
          recommendation: {
            type: "string",
            enum: ["strong", "review", "skip"],
          },
          reasons: {
            type: "array",
            maxItems: 4,
            items: { type: "string" },
          },
          gaps: {
            type: "array",
            maxItems: 4,
            items: { type: "string" },
          },
        },
        required: ["jobId", "score", "recommendation", "reasons", "gaps"],
      },
    },
  },
  required: ["ranked"],
} as const;

router.get("/person-card/jobs/ai/_health", (req, res) => {
  if (!requireAuthenticated(req)) {
    res.status(401).json({ error: "NEXUS_AUTH_REQUIRED" });
    return;
  }
  res.json({
    schema: "nexus-job-ai-health/v1",
    status: "ok",
    configured: Boolean(
      process.env.OPENAI_API_KEY?.trim() &&
        process.env.NEXUS_JOB_AI_MODEL?.trim(),
    ),
    protected: true,
    personMutationPerformed: false,
    applicationPerformed: false,
  });
});

router.post("/person-card/jobs/ai/match", async (req, res) => {
  if (!requireAuthenticated(req)) {
    res.status(401).json({ error: "NEXUS_AUTH_REQUIRED" });
    return;
  }

  const profile = safeProfileFromBody(req.body?.profile);
  const jobs = safeJobsFromBody(req.body?.jobs);
  if (!profile || jobs.length === 0) {
    res.status(400).json({ error: "NEXUS_JOB_AI_INVALID_INPUT" });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const model = process.env.NEXUS_JOB_AI_MODEL?.trim();
  if (!apiKey || !model) {
    res.status(503).json({
      schema: "nexus-job-ai-error/v1",
      error: "NEXUS_JOB_AI_NOT_CONFIGURED",
      personMutationPerformed: false,
      applicationPerformed: false,
    });
    return;
  }

  const client = new OpenAI({ apiKey });
  const prompt = {
    task:
      "Rank construction work opportunities for a worker. Use only supplied facts. Never invent credentials. Penalize missing required evidence and explain uncertainty.",
    profile,
    jobs,
  };

  try {
    const response = await client.responses.create({
      model,
      store: false,
      input: JSON.stringify(prompt),
      text: {
        format: {
          type: "json_schema",
          name: "nexus_job_ai_match",
          strict: true,
          schema: outputSchema,
        },
      },
    });

    const parsed = JSON.parse(response.output_text || "{}") as {
      ranked?: unknown;
    };
    if (!Array.isArray(parsed.ranked)) {
      throw new Error("NEXUS_JOB_AI_INVALID_MODEL_OUTPUT");
    }

    const knownJobIds = new Set(jobs.map((job) => job.id));
    const ranked = parsed.ranked
      .filter(
        (item): item is {
          jobId: string;
          score: number;
          recommendation: "strong" | "review" | "skip";
          reasons: string[];
          gaps: string[];
        } =>
          Boolean(item) &&
          typeof item === "object" &&
          typeof (item as { jobId?: unknown }).jobId === "string" &&
          knownJobIds.has((item as { jobId: string }).jobId) &&
          Number.isInteger((item as { score?: unknown }).score) &&
          typeof (item as { recommendation?: unknown }).recommendation === "string" &&
          Array.isArray((item as { reasons?: unknown }).reasons) &&
          Array.isArray((item as { gaps?: unknown }).gaps),
      )
      .map((item) => ({
        jobId: item.jobId,
        score: Math.max(0, Math.min(100, item.score)),
        recommendation: item.recommendation,
        reasons: item.reasons.map((value) => cleanText(value, 180)).filter(Boolean).slice(0, 4),
        gaps: item.gaps.map((value) => cleanText(value, 180)).filter(Boolean).slice(0, 4),
      }))
      .sort((a, b) => b.score - a.score);

    res.json({
      schema: "nexus-job-ai-match-result/v1",
      model,
      profilePersonId: profile.personId,
      ranked,
      providerDataWritten: false,
      personMutationPerformed: false,
      applicationPerformed: false,
      humanReviewRequired: true,
    });
  } catch (error) {
    req.log?.error?.({ err: error }, "Nexus Job AI match failed");
    res.status(502).json({
      schema: "nexus-job-ai-error/v1",
      error: "NEXUS_JOB_AI_FAILED",
      personMutationPerformed: false,
      applicationPerformed: false,
    });
  }
});

export default router;
