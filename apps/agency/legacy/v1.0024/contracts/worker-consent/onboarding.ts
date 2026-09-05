import { randomUUID } from "node:crypto";
import OpenAI from "openai";
import { eq } from "drizzle-orm";
import { Router, type IRouter, type Request } from "express";
import {
  db,
  nexusPersonAgenciesTable,
  nexusPersonAgencyMembersTable,
  nexusPersonAgencyRecruiterProfilesTable,
} from "@workspace/db";
import {
  createNexusOnboardingDraftToken,
  createNexusOnboardingInviteToken,
  digestNexusOnboardingToken,
  NexusOnboardingInviteError,
  verifyNexusOnboardingDraftToken,
  verifyNexusOnboardingInviteToken,
  type NexusOnboardingInvitePayload,
} from "./onboarding-invite";
import {
  claimNexusOnboardingInvite,
  loadNexusPersonWorkProfile,
  NexusPersonWorkProfilePersistenceError,
  persistNexusOnboardingInvite,
  saveNexusPersonWorkProfile,
} from "./person-work-profile-persistence";

const router: IRouter = Router();
const MAX_CV_TEXT = 20_000;
const MAX_INVITE_DAYS = 14;
const DRAFT_TOKEN_DAYS = 30;

const allowedOrigins = new Set(
  (process.env.NEXUS_ONBOARDING_PUBLIC_ORIGINS ??
    "https://nosmotechnology.co.uk,https://www.nosmotechnology.co.uk,https://nosmo.tech,https://www.nosmo.tech")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);

router.use("/person-card/onboarding", (req, res, next) => {
  const origin = req.get("origin");
  if (origin) {
    if (!allowedOrigins.has(origin)) {
      res.status(403).json({ error: "NEXUS_ONBOARDING_ORIGIN_DENIED" });
      return;
    }
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Vary", "Origin");
  }
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

const clean = (value: unknown, max: number): string | undefined => {
  if (typeof value !== "string") return undefined;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, max) : undefined;
};

const rawText = (value: unknown, max: number): string => {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
};

const bool = (value: unknown): boolean => value === true;
const finiteInt = (
  value: unknown,
  min: number,
  max: number,
  fallback = 0,
): number => {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, Math.round(num)));
};

async function authenticatedAgency(req: Request): Promise<{
  agencyId: string;
  name: string;
  recruiterName: string;
  recruiterTitle: string | null;
} | null> {
  if (!req.isAuthenticated()) return null;
  const rows = await db
    .select({
      agencyId: nexusPersonAgenciesTable.agencyId,
      name: nexusPersonAgenciesTable.name,
      agencyStatus: nexusPersonAgenciesTable.status,
      memberStatus: nexusPersonAgencyMembersTable.status,
    })
    .from(nexusPersonAgencyMembersTable)
    .innerJoin(
      nexusPersonAgenciesTable,
      eq(nexusPersonAgenciesTable.agencyId, nexusPersonAgencyMembersTable.agencyId),
    )
    .where(eq(nexusPersonAgencyMembersTable.authUserId, req.user.id))
    .limit(2);

  if (
    rows.length !== 1 ||
    rows[0]!.agencyStatus !== "ACTIVE" ||
    rows[0]!.memberStatus !== "ACTIVE"
  ) {
    return null;
  }

  const recruiterRows = await db
    .select({
      displayName: nexusPersonAgencyRecruiterProfilesTable.displayName,
      jobTitle: nexusPersonAgencyRecruiterProfilesTable.jobTitle,
    })
    .from(nexusPersonAgencyRecruiterProfilesTable)
    .where(eq(nexusPersonAgencyRecruiterProfilesTable.authUserId, req.user.id))
    .limit(1);

  const recruiterName =
    recruiterRows[0]?.displayName ??
    ([req.user.firstName, req.user.lastName].filter(Boolean).join(" ").trim() ||
      req.user.email ||
      "Recruiter");

  return {
    agencyId: rows[0]!.agencyId,
    name: rows[0]!.name,
    recruiterName,
    recruiterTitle: recruiterRows[0]?.jobTitle ?? null,
  };
}

const persistenceError = (
  req: Request,
  res: Parameters<IRouter["post"]>[1] extends never ? never : any,
  error: unknown,
  context: string,
): boolean => {
  if (error instanceof NexusPersonWorkProfilePersistenceError) {
    req.log?.warn?.({ code: error.code }, context);
    res.status(error.status).json({ error: error.code });
    return true;
  }
  return false;
};

router.get("/person-card/onboarding/_health", (_req, res) => {
  res.json({
    schema: "nexus-person-onboarding-health/v1",
    status: "ok",
    inviteSigningConfigured: Boolean(
      process.env.NEXUS_ONBOARDING_INVITE_SECRET?.trim(),
    ),
    draftSigningConfigured: Boolean(
      process.env.NEXUS_ONBOARDING_DRAFT_SECRET?.trim(),
    ),
    aiConfigured: Boolean(
      process.env.OPENAI_API_KEY?.trim() &&
        process.env.NEXUS_ONBOARDING_AI_MODEL?.trim(),
    ),
    personPersistenceConfigured: Boolean(process.env.DATABASE_URL?.trim()),
    serverPersonMutationPerformed: false,
  });
});

router.post("/person-card/onboarding/invite-info", async (req, res) => {
  const inviteToken = clean(req.body?.inviteToken, 8_000);
  if (!inviteToken) {
    res.status(401).json({ error: "NEXUS_ONBOARDING_INVITE_REQUIRED" });
    return;
  }

  try {
    const invite = verifyNexusOnboardingInviteToken(inviteToken);
    res.json({
      schema: "nexus-person-onboarding-invite-info/v1",
      inviteId: invite.inviteId,
      agency: {
        agencyId: invite.agencyId ?? null,
        name: invite.agency,
      },
      recruiter: {
        displayName: invite.recruiterName ?? "Recruiter",
        jobTitle: invite.recruiterTitle ?? null,
      },
      suggestedTrade: invite.trade ?? null,
      suggestedLocation: invite.location ?? null,
      expiresAt: new Date(invite.expiresAt).toISOString(),
      verifiedSignedInvite: true,
      serverPersonMutationPerformed: false,
    });
  } catch (error) {
    if (error instanceof NexusOnboardingInviteError) {
      res.status(error.status).json({ error: error.code });
      return;
    }
    res.status(401).json({ error: "NEXUS_ONBOARDING_INVITE_INVALID" });
  }
});

router.post("/person-card/onboarding/invites", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "NEXUS_AUTH_REQUIRED" });
    return;
  }

  const agencyAccount = await authenticatedAgency(req);
  if (!agencyAccount) {
    res.status(403).json({ error: "NEXUS_AGENCY_ACCOUNT_REQUIRED" });
    return;
  }
  const agency = agencyAccount.name;

  const daysRaw = Number(req.body?.expiresInDays ?? 7);
  const expiresInDays = Number.isFinite(daysRaw)
    ? Math.max(1, Math.min(MAX_INVITE_DAYS, Math.round(daysRaw)))
    : 7;
  const now = Date.now();
  const payload: NexusOnboardingInvitePayload = {
    schema: "nexus-person-onboarding-invite/v1",
    inviteId: randomUUID(),
    agency,
    agencyId: agencyAccount.agencyId,
    recruiterName: agencyAccount.recruiterName,
    recruiterTitle: agencyAccount.recruiterTitle ?? undefined,
    trade: clean(req.body?.trade, 120),
    location: clean(req.body?.location, 120),
    message: clean(req.body?.message, 240),
    issuedAt: now,
    expiresAt: now + expiresInDays * 24 * 60 * 60 * 1000,
  };

  try {
    const token = createNexusOnboardingInviteToken(payload);
    await persistNexusOnboardingInvite({
      inviteId: payload.inviteId,
      tokenDigest: digestNexusOnboardingToken(token),
      agency: payload.agency,
      agencyId: agencyAccount.agencyId,
      createdByUserId: req.user.id,
      suggestedTrade: payload.trade,
      suggestedLocation: payload.location,
      message: payload.message,
      expiresAt: new Date(payload.expiresAt),
      createdAt: new Date(now),
    });

    const base =
      process.env.NEXUS_ONBOARDING_PUBLIC_BASE_URL?.trim() ||
      "https://nosmotechnology.co.uk/person-card-onboarding.html";
    const url = new URL(base);
    url.searchParams.set("inviteId", payload.inviteId);
    url.searchParams.set("agency", payload.agency);
    if (payload.trade) url.searchParams.set("trade", payload.trade);
    if (payload.location) url.searchParams.set("location", payload.location);
    if (payload.message) url.searchParams.set("message", payload.message);
    url.searchParams.set("inviteToken", token);

    res.status(201).json({
      schema: "nexus-person-onboarding-invite-created/v1",
      inviteId: payload.inviteId,
      expiresAt: new Date(payload.expiresAt).toISOString(),
      onboardingUrl: url.toString(),
      invitePersisted: true,
      serverPersonMutationPerformed: false,
    });
  } catch (error) {
    if (error instanceof NexusOnboardingInviteError) {
      res.status(error.status).json({ error: error.code });
      return;
    }
    if (persistenceError(req, res, error, "Onboarding invite persistence failed")) {
      return;
    }
    req.log?.error?.({ err: error }, "Onboarding invite creation failed");
    res.status(500).json({ error: "NEXUS_ONBOARDING_INVITE_CREATE_FAILED" });
  }
});

router.post("/person-card/onboarding/claim", async (req, res) => {
  const inviteToken = clean(req.body?.inviteToken, 8_000);
  if (!inviteToken) {
    res.status(401).json({ error: "NEXUS_ONBOARDING_INVITE_REQUIRED" });
    return;
  }

  let invite: NexusOnboardingInvitePayload;
  try {
    invite = verifyNexusOnboardingInviteToken(inviteToken);
  } catch (error) {
    if (error instanceof NexusOnboardingInviteError) {
      res.status(error.status).json({ error: error.code });
      return;
    }
    res.status(401).json({ error: "NEXUS_ONBOARDING_INVITE_INVALID" });
    return;
  }

  const now = new Date();
  const personId = `person-work-${randomUUID()}`;
  const stubPersonRecord = {
    schema: "nexus-person-draft/v1",
    id: personId,
    source: "agency-invite",
    inviteId: invite.inviteId,
    displayName: "Person Card Draft",
    firstName: null,
    lastName: null,
    primaryRole: invite.trade ?? null,
    location: invite.location ?? null,
    contact: { phone: null, email: null },
    verification: "unverified-draft",
    createdAt: now.toISOString(),
  };
  const stubWorkProfileRecord = {
    schema: "nexus-person-work-profile/v1",
    id: `work-profile:${personId}`,
    personId,
    version: "server-draft-v1",
    demoMode: false,
    source: "agency-invite",
    agency: invite.agency,
    updatedAt: now.toISOString(),
    availability: {
      status: "available",
      label: "Available",
      availableFrom: null,
      preferredRadiusKm: 40,
      workAway: false,
      ownTransport: false,
      shifts: ["day"],
    },
    preferences: {
      primaryTrade: invite.trade ?? "",
      targetRoles: invite.trade ? [invite.trade] : [],
      locations: invite.location ? [invite.location] : [],
      employmentTypes: ["contract", "temporary", "permanent"],
      paymentPreferences: [],
      rate: { amount: null, currency: "GBP", unit: "hour", display: "Open to offers" },
    },
    readiness: {
      cv: { state: "missing", source: "onboarding" },
      certificates: { state: "missing", source: "onboarding" },
      references: { state: "missing", source: "onboarding" },
      vault: { state: "not-connected", source: "onboarding" },
    },
    cvText: "",
  };

  try {
    const claim = await claimNexusOnboardingInvite({
      inviteId: invite.inviteId,
      tokenDigest: digestNexusOnboardingToken(inviteToken),
      personId,
      now,
      stubPersonRecord,
      stubWorkProfileRecord,
    });

    const issuedAt = Date.now();
    const draftExpiresAt = issuedAt + DRAFT_TOKEN_DAYS * 24 * 60 * 60 * 1000;
    const draftToken = createNexusOnboardingDraftToken({
      schema: "nexus-person-onboarding-draft-token/v1",
      inviteId: invite.inviteId,
      personId: claim.personId,
      issuedAt,
      expiresAt: draftExpiresAt,
    });

    res.status(201).json({
      schema: "nexus-person-onboarding-claim/v1",
      inviteId: invite.inviteId,
      personId: claim.personId,
      agency: claim.agency,
      draftToken,
      draftTokenExpiresAt: new Date(draftExpiresAt).toISOString(),
      serverPersonMutationPerformed: true,
    });
  } catch (error) {
    if (error instanceof NexusOnboardingInviteError) {
      res.status(error.status).json({ error: error.code });
      return;
    }
    if (persistenceError(req, res, error, "Onboarding claim failed")) return;
    req.log?.error?.({ err: error }, "Onboarding claim failed");
    res.status(500).json({ error: "NEXUS_ONBOARDING_CLAIM_FAILED" });
  }
});

const requireDraftAuthority = (
  req: Request,
):
  | {
      inviteId: string;
      personId: string;
    }
  | null => {
  const draftToken = clean(req.body?.draftToken, 8_000);
  if (!draftToken) return null;
  const payload = verifyNexusOnboardingDraftToken(draftToken);
  return {
    inviteId: payload.inviteId,
    personId: payload.personId,
  };
};

router.post("/person-card/onboarding/drafts/load", async (req, res) => {
  let authority: { inviteId: string; personId: string } | null;
  try {
    authority = requireDraftAuthority(req);
  } catch (error) {
    if (error instanceof NexusOnboardingInviteError) {
      res.status(error.status).json({ error: error.code });
      return;
    }
    res.status(401).json({ error: "NEXUS_ONBOARDING_DRAFT_TOKEN_INVALID" });
    return;
  }
  if (!authority) {
    res.status(401).json({ error: "NEXUS_ONBOARDING_DRAFT_TOKEN_REQUIRED" });
    return;
  }

  try {
    const draft = await loadNexusPersonWorkProfile(authority);
    res.json({
      schema: "nexus-person-onboarding-draft-load/v1",
      personId: authority.personId,
      person: draft.person,
      workProfile: draft.workProfile,
      personStatus: draft.personStatus,
      workProfileStatus: draft.workProfileStatus,
      persistedAt: draft.persistedAt.toISOString(),
      serverPersonMutationPerformed: false,
    });
  } catch (error) {
    if (persistenceError(req, res, error, "Onboarding draft load failed")) return;
    req.log?.error?.({ err: error }, "Onboarding draft load failed");
    res.status(500).json({ error: "NEXUS_ONBOARDING_DRAFT_LOAD_FAILED" });
  }
});

router.post("/person-card/onboarding/drafts/save", async (req, res) => {
  let authority: { inviteId: string; personId: string } | null;
  try {
    authority = requireDraftAuthority(req);
  } catch (error) {
    if (error instanceof NexusOnboardingInviteError) {
      res.status(error.status).json({ error: error.code });
      return;
    }
    res.status(401).json({ error: "NEXUS_ONBOARDING_DRAFT_TOKEN_INVALID" });
    return;
  }
  if (!authority) {
    res.status(401).json({ error: "NEXUS_ONBOARDING_DRAFT_TOKEN_REQUIRED" });
    return;
  }

  const firstName = clean(req.body?.firstName, 80) ?? "";
  const lastName = clean(req.body?.lastName, 80) ?? "";
  const trade = clean(req.body?.trade, 140) ?? "";
  const location = clean(req.body?.location, 140) ?? "";
  const phone = clean(req.body?.phone, 80) ?? "";
  const email = clean(req.body?.email, 160) ?? "";
  const cvText = rawText(req.body?.cvText, MAX_CV_TEXT);
  const finalize = req.body?.finalize === true;
  const shareWithInvitingAgency = bool(req.body?.shareWithInvitingAgency);

  if (finalize && (!firstName || !lastName || !trade || !location)) {
    res.status(400).json({
      error: "NEXUS_ONBOARDING_FINALIZE_FIELDS_REQUIRED",
      required: ["firstName", "lastName", "trade", "location"],
    });
    return;
  }

  const experienceYears = finiteInt(req.body?.experienceYears, 0, 60, 0);
  const radius = finiteInt(req.body?.radius, 0, 500, 40);
  const availabilityRaw = clean(req.body?.availability, 40) ?? "available";
  const availability = new Set(["available", "from-date", "not-looking"]).has(
    availabilityRaw,
  )
    ? availabilityRaw
    : "available";
  const availableFrom = clean(req.body?.availableFrom, 40) ?? "";
  const dayShift = bool(req.body?.dayShift);
  const nightShift = bool(req.body?.nightShift);
  const ownTransport = bool(req.body?.ownTransport);
  const workAway = bool(req.body?.workAway);
  const now = new Date();
  const displayName =
    [firstName, lastName].filter(Boolean).join(" ") || "Person Card Draft";
  const personStatus = finalize ? "active" : "draft";
  const workProfileStatus = finalize ? "active" : "draft";

  const personRecord = {
    schema: "nexus-person-draft/v1",
    id: authority.personId,
    source: "agency-invite",
    inviteId: authority.inviteId,
    displayName,
    firstName: firstName || null,
    lastName: lastName || null,
    primaryRole: trade || null,
    location: location || null,
    experienceYears,
    contact: {
      phone: phone || null,
      email: email || null,
    },
    photo: {
      state: "local-only",
      serverBinaryPersisted: false,
    },
    verification: finalize ? "unverified" : "unverified-draft",
    updatedAt: now.toISOString(),
  };

  const workProfileRecord = {
    schema: "nexus-person-work-profile/v1",
    id: `work-profile:${authority.personId}`,
    personId: authority.personId,
    version: finalize ? "server-active-v1" : "server-draft-v1",
    demoMode: false,
    source: "agency-invite",
    updatedAt: now.toISOString(),
    availability: {
      status: availability,
      label:
        availability === "not-looking"
          ? "Not Looking"
          : availability === "from-date"
            ? "From Date"
            : "Available",
      availableFrom: availableFrom || null,
      preferredRadiusKm: radius,
      workAway,
      ownTransport,
      shifts: [dayShift ? "day" : null, nightShift ? "night" : null].filter(
        (value): value is string => Boolean(value),
      ),
    },
    preferences: {
      primaryTrade: trade,
      targetRoles: trade ? [trade] : [],
      locations: location ? [location] : [],
      employmentTypes: ["contract", "temporary", "permanent"],
      paymentPreferences: [],
      rate: {
        amount: null,
        currency: "GBP",
        unit: "hour",
        display: "Open to offers",
      },
    },
    readiness: {
      cv: {
        state: cvText.length > 80 ? "draft" : "missing",
        source: "onboarding",
      },
      certificates: { state: "missing", source: "onboarding" },
      references: { state: "missing", source: "onboarding" },
      vault: { state: "not-connected", source: "onboarding" },
    },
    cvText,
    visibility: {
      invitingAgencyRecruiterSafe:
        finalize && shareWithInvitingAgency,
      privateDocumentsShared: false,
      contactDetailsShared: false,
      cvTextShared: false,
    },
  };

  try {
    await saveNexusPersonWorkProfile({
      inviteId: authority.inviteId,
      personId: authority.personId,
      now,
      displayName,
      personStatus,
      personRecord,
      workProfileStatus,
      workProfileRecord,
      shareWithInvitingAgency,
    });
    res.json({
      schema: "nexus-person-onboarding-draft-save/v1",
      personId: authority.personId,
      status: finalize ? "ACTIVE" : "DRAFT",
      persistedAt: now.toISOString(),
      serverPersonMutationPerformed: true,
      photoBinaryPersisted: false,
      agencyRecruiterSafeAccess:
        finalize && shareWithInvitingAgency ? "GRANTED" : "NOT_GRANTED",
      privateDocumentsShared: false,
    });
  } catch (error) {
    if (persistenceError(req, res, error, "Onboarding draft save failed")) return;
    req.log?.error?.({ err: error }, "Onboarding draft save failed");
    res.status(500).json({ error: "NEXUS_ONBOARDING_DRAFT_SAVE_FAILED" });
  }
});

const prefillSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    firstName: { type: ["string", "null"] },
    lastName: { type: ["string", "null"] },
    trade: { type: ["string", "null"] },
    location: { type: ["string", "null"] },
    experienceYears: { type: ["integer", "null"], minimum: 0, maximum: 60 },
    summary: { type: ["string", "null"] },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    warnings: {
      type: "array",
      maxItems: 6,
      items: { type: "string" },
    },
  },
  required: [
    "firstName",
    "lastName",
    "trade",
    "location",
    "experienceYears",
    "summary",
    "confidence",
    "warnings",
  ],
} as const;

router.post("/person-card/onboarding/ai-prefill", async (req, res) => {
  const inviteToken = clean(req.body?.inviteToken, 8_000);
  const draftToken = clean(req.body?.draftToken, 8_000);
  if (!inviteToken || !draftToken) {
    res.status(401).json({
      error: "NEXUS_ONBOARDING_INVITE_AND_DRAFT_TOKEN_REQUIRED",
    });
    return;
  }

  let invite: NexusOnboardingInvitePayload;
  let draftAuthority: { inviteId: string; personId: string };
  try {
    invite = verifyNexusOnboardingInviteToken(inviteToken);
    const draft = verifyNexusOnboardingDraftToken(draftToken);
    draftAuthority = { inviteId: draft.inviteId, personId: draft.personId };
  } catch (error) {
    if (error instanceof NexusOnboardingInviteError) {
      res.status(error.status).json({ error: error.code });
      return;
    }
    res.status(401).json({ error: "NEXUS_ONBOARDING_AUTHORITY_INVALID" });
    return;
  }

  if (invite.inviteId !== draftAuthority.inviteId) {
    res.status(403).json({ error: "NEXUS_ONBOARDING_AUTHORITY_MISMATCH" });
    return;
  }

  try {
    await loadNexusPersonWorkProfile(draftAuthority);
  } catch (error) {
    if (persistenceError(req, res, error, "Onboarding AI authority check failed")) {
      return;
    }
    res.status(403).json({ error: "NEXUS_ONBOARDING_DRAFT_AUTHORITY_INVALID" });
    return;
  }

  const cvText = rawText(req.body?.cvText, MAX_CV_TEXT);
  if (!cvText) {
    res.status(400).json({ error: "NEXUS_ONBOARDING_CV_TEXT_INVALID" });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const model = process.env.NEXUS_ONBOARDING_AI_MODEL?.trim();
  if (!apiKey || !model) {
    res.status(503).json({
      schema: "nexus-person-onboarding-ai-error/v1",
      error: "NEXUS_ONBOARDING_AI_NOT_CONFIGURED",
      serverPersonMutationPerformed: false,
    });
    return;
  }

  const current =
    req.body?.current && typeof req.body.current === "object"
      ? req.body.current
      : {};

  const prompt = {
    task:
      "Extract a draft construction work profile from supplied CV/work-history text. Use only explicit evidence. Do not invent credentials, certifications, legal status, addresses, dates or employers. Return null when uncertain.",
    inviteContext: {
      agency: invite.agency,
      suggestedTrade: invite.trade,
      suggestedLocation: invite.location,
    },
    currentDraft: current,
    cvText,
  };

  try {
    const client = new OpenAI({ apiKey });
    const response = await client.responses.create({
      model,
      store: false,
      input: JSON.stringify(prompt),
      text: {
        format: {
          type: "json_schema",
          name: "nexus_person_onboarding_prefill",
          strict: true,
          schema: prefillSchema,
        },
      },
    });
    const parsed = JSON.parse(response.output_text || "{}") as Record<
      string,
      unknown
    >;

    res.json({
      schema: "nexus-person-onboarding-ai-prefill/v1",
      inviteId: invite.inviteId,
      personId: draftAuthority.personId,
      prefill: {
        firstName: clean(parsed.firstName, 80) ?? null,
        lastName: clean(parsed.lastName, 80) ?? null,
        trade: clean(parsed.trade, 140) ?? null,
        location: clean(parsed.location, 140) ?? null,
        experienceYears:
          typeof parsed.experienceYears === "number" &&
          Number.isInteger(parsed.experienceYears)
            ? Math.max(0, Math.min(60, parsed.experienceYears))
            : null,
        summary: clean(parsed.summary, 600) ?? null,
        confidence:
          typeof parsed.confidence === "number"
            ? Math.max(0, Math.min(1, parsed.confidence))
            : 0,
        warnings: Array.isArray(parsed.warnings)
          ? parsed.warnings
              .map((value) => clean(value, 180))
              .filter((value): value is string => Boolean(value))
              .slice(0, 6)
          : [],
      },
      serverPersonMutationPerformed: false,
      humanReviewRequired: true,
    });
  } catch (error) {
    req.log?.error?.({ err: error }, "Nexus onboarding AI prefill failed");
    res.status(502).json({
      schema: "nexus-person-onboarding-ai-error/v1",
      error: "NEXUS_ONBOARDING_AI_FAILED",
      serverPersonMutationPerformed: false,
    });
  }
});

export default router;
