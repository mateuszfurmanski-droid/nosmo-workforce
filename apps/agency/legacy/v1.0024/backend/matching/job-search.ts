import { Router, type IRouter, type Request, type Response } from "express";
import {
  NexusJobConnectorError,
  searchAdzunaJobs,
  type NexusJobSearchInput,
} from "./job-adzuna";

const router: IRouter = Router();
const textPattern = /^[\p{L}\p{N}\s+&/.,'()#-]{1,120}$/u;
const countryPattern = /^[a-z]{2}$/;

const allowedOrigins = new Set(
  (process.env.NEXUS_JOB_PUBLIC_ORIGINS ??
    "https://nosmotechnology.co.uk,https://www.nosmotechnology.co.uk,https://nosmo.tech,https://www.nosmo.tech")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);

const setCors = (req: Request, res: Response): boolean => {
  const origin = req.get("origin");
  if (!origin) return true;
  if (!allowedOrigins.has(origin)) {
    res.status(403).json({ error: "NEXUS_JOB_ORIGIN_DENIED" });
    return false;
  }
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  return true;
};

const queryText = (
  req: Request,
  key: "what" | "where",
  required: boolean,
): string | undefined => {
  const raw = req.query[key];
  if (typeof raw !== "string") {
    if (required) throw new Error(`NEXUS_JOB_${key.toUpperCase()}_REQUIRED`);
    return undefined;
  }
  const value = raw.trim();
  if (!value) {
    if (required) throw new Error(`NEXUS_JOB_${key.toUpperCase()}_REQUIRED`);
    return undefined;
  }
  if (!textPattern.test(value)) {
    throw new Error(`NEXUS_JOB_INVALID_${key.toUpperCase()}`);
  }
  return value;
};

const boundedInteger = (
  req: Request,
  key: "page" | "results",
  fallback: number,
  min: number,
  max: number,
): number => {
  const raw = req.query[key];
  if (raw === undefined) return fallback;
  if (typeof raw !== "string" || !/^\d{1,3}$/.test(raw)) {
    throw new Error(`NEXUS_JOB_INVALID_${key.toUpperCase()}`);
  }
  const value = Number(raw);
  if (value < min || value > max) {
    throw new Error(`NEXUS_JOB_INVALID_${key.toUpperCase()}`);
  }
  return value;
};

router.get("/person-card/jobs/_health", (req, res) => {
  if (!setCors(req, res)) return;
  res.json({
    schema: "nexus-job-gateway-health/v1",
    status: "ok",
    provider: "Adzuna",
    configured: Boolean(process.env.ADZUNA_APP_ID?.trim() && process.env.ADZUNA_APP_KEY?.trim()),
    readOnly: true,
    providerWritePerformed: false,
    applicationPerformed: false,
  });
});

router.get("/person-card/jobs/search", async (req, res) => {
  if (!setCors(req, res)) return;

  let input: NexusJobSearchInput;
  try {
    const what = queryText(req, "what", true)!;
    const where = queryText(req, "where", false);
    const countryRaw = typeof req.query.country === "string" ? req.query.country.trim().toLowerCase() : "gb";
    if (!countryPattern.test(countryRaw)) throw new Error("NEXUS_JOB_INVALID_COUNTRY");

    input = {
      what,
      where,
      country: countryRaw,
      page: boundedInteger(req, "page", 1, 1, 20),
      resultsPerPage: boundedInteger(req, "results", 10, 1, 20),
    };
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "NEXUS_JOB_INVALID_REQUEST",
    });
    return;
  }

  try {
    const result = await searchAdzunaJobs(input);
    res.json(result);
  } catch (error) {
    if (error instanceof NexusJobConnectorError) {
      req.log?.warn?.({ code: error.code }, "Nexus Job provider request blocked");
      res.status(error.status).json({
        schema: "nexus-job-search-error/v1",
        error: error.code,
        providerWritePerformed: false,
        applicationPerformed: false,
      });
      return;
    }
    req.log?.error?.({ err: error }, "Nexus Job Gateway failed");
    res.status(500).json({
      schema: "nexus-job-search-error/v1",
      error: "NEXUS_JOB_GATEWAY_FAILED",
      providerWritePerformed: false,
      applicationPerformed: false,
    });
  }
});

export default router;
