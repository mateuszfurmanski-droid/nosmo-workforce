import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export interface NexusOnboardingInvitePayload {
  schema: "nexus-person-onboarding-invite/v1";
  inviteId: string;
  agency: string;
  agencyId?: string;
  recruiterName?: string;
  recruiterTitle?: string;
  trade?: string;
  location?: string;
  message?: string;
  issuedAt: number;
  expiresAt: number;
}

export interface NexusOnboardingDraftPayload {
  schema: "nexus-person-onboarding-draft-token/v1";
  inviteId: string;
  personId: string;
  issuedAt: number;
  expiresAt: number;
}

export class NexusOnboardingInviteError extends Error {
  constructor(public readonly code: string, public readonly status = 400) {
    super(code);
  }
}

const secret = (): string => {
  const value = process.env.NEXUS_ONBOARDING_INVITE_SECRET?.trim();
  if (!value || value.length < 32) {
    throw new NexusOnboardingInviteError("NEXUS_ONBOARDING_INVITE_SECRET_NOT_CONFIGURED", 503);
  }
  return value;
};

const draftSecret = (): string => {
  const value = process.env.NEXUS_ONBOARDING_DRAFT_SECRET?.trim();
  if (!value || value.length < 32) {
    throw new NexusOnboardingInviteError(
      "NEXUS_ONBOARDING_DRAFT_SECRET_NOT_CONFIGURED",
      503,
    );
  }
  return value;
};

const encode = (value: string): string => Buffer.from(value, "utf8").toString("base64url");
const decode = (value: string): string => Buffer.from(value, "base64url").toString("utf8");

const signBody = (body: string): string =>
  createHmac("sha256", secret()).update(body).digest("base64url");

const signDraftBody = (body: string): string =>
  createHmac("sha256", draftSecret()).update(body).digest("base64url");

export const digestNexusOnboardingToken = (token: string): string =>
  createHash("sha256").update(token, "utf8").digest("hex");

export const createNexusOnboardingInviteToken = (
  payload: NexusOnboardingInvitePayload,
): string => {
  const body = encode(JSON.stringify(payload));
  const sig = signBody(body);
  return `${body}.${sig}`;
};

export const verifyNexusOnboardingInviteToken = (
  token: string,
  nowMs = Date.now(),
): NexusOnboardingInvitePayload => {
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra) {
    throw new NexusOnboardingInviteError("NEXUS_ONBOARDING_INVITE_INVALID", 401);
  }
  const expected = signBody(body);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new NexusOnboardingInviteError("NEXUS_ONBOARDING_INVITE_INVALID", 401);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(decode(body));
  } catch {
    throw new NexusOnboardingInviteError("NEXUS_ONBOARDING_INVITE_INVALID", 401);
  }
  if (!payload || typeof payload !== "object") {
    throw new NexusOnboardingInviteError("NEXUS_ONBOARDING_INVITE_INVALID", 401);
  }
  const p = payload as Partial<NexusOnboardingInvitePayload>;
  if (
    p.schema !== "nexus-person-onboarding-invite/v1" ||
    typeof p.inviteId !== "string" ||
    typeof p.agency !== "string" ||
    typeof p.issuedAt !== "number" ||
    typeof p.expiresAt !== "number"
  ) {
    throw new NexusOnboardingInviteError("NEXUS_ONBOARDING_INVITE_INVALID", 401);
  }
  if (p.expiresAt <= nowMs) {
    throw new NexusOnboardingInviteError("NEXUS_ONBOARDING_INVITE_EXPIRED", 401);
  }
  if (p.issuedAt > nowMs + 60_000) {
    throw new NexusOnboardingInviteError("NEXUS_ONBOARDING_INVITE_INVALID", 401);
  }
  return p as NexusOnboardingInvitePayload;
};


export const createNexusOnboardingDraftToken = (
  payload: NexusOnboardingDraftPayload,
): string => {
  const body = encode(JSON.stringify(payload));
  const sig = signDraftBody(body);
  return `${body}.${sig}`;
};

export const verifyNexusOnboardingDraftToken = (
  token: string,
  nowMs = Date.now(),
): NexusOnboardingDraftPayload => {
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra) {
    throw new NexusOnboardingInviteError(
      "NEXUS_ONBOARDING_DRAFT_TOKEN_INVALID",
      401,
    );
  }
  const expected = signDraftBody(body);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new NexusOnboardingInviteError(
      "NEXUS_ONBOARDING_DRAFT_TOKEN_INVALID",
      401,
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(decode(body));
  } catch {
    throw new NexusOnboardingInviteError(
      "NEXUS_ONBOARDING_DRAFT_TOKEN_INVALID",
      401,
    );
  }
  if (!payload || typeof payload !== "object") {
    throw new NexusOnboardingInviteError(
      "NEXUS_ONBOARDING_DRAFT_TOKEN_INVALID",
      401,
    );
  }
  const p = payload as Partial<NexusOnboardingDraftPayload>;
  if (
    p.schema !== "nexus-person-onboarding-draft-token/v1" ||
    typeof p.inviteId !== "string" ||
    typeof p.personId !== "string" ||
    typeof p.issuedAt !== "number" ||
    typeof p.expiresAt !== "number"
  ) {
    throw new NexusOnboardingInviteError(
      "NEXUS_ONBOARDING_DRAFT_TOKEN_INVALID",
      401,
    );
  }
  if (p.expiresAt <= nowMs || p.issuedAt > nowMs + 60_000) {
    throw new NexusOnboardingInviteError(
      "NEXUS_ONBOARDING_DRAFT_TOKEN_EXPIRED",
      401,
    );
  }
  return p as NexusOnboardingDraftPayload;
};
