import { neon } from "@neondatabase/serverless";

type Sql = ReturnType<typeof neon>;
type JsonRecord = Record<string, unknown>;

type RequestIdentity = {
  email: string;
  displayName: string;
};

type AvailabilityStatus = "available" | "busy" | "ready_on_date";

class WorkerHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

function getSql(): Sql {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new WorkerHttpError(503, "NEXUS_DATABASE_NOT_CONFIGURED");
  }
  return neon(connectionString);
}

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function clean(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, max) : undefined;
}

function asRecord(value: unknown): JsonRecord {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as JsonRecord;
  }
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as JsonRecord)
        : {};
    } catch {
      return {};
    }
  }
  return {};
}

function requestIdentity(request: Request): RequestIdentity | null {
  const email = clean(
    request.headers.get("oai-authenticated-user-email"),
    320,
  )?.toLowerCase();
  if (!email) return null;

  const encodedName = request.headers.get("oai-authenticated-user-full-name");
  const encoding = request.headers.get(
    "oai-authenticated-user-full-name-encoding",
  );
  let displayName = email;
  if (encodedName && encoding === "percent-encoded-utf-8") {
    try {
      displayName = clean(decodeURIComponent(encodedName), 160) ?? email;
    } catch {
      displayName = email;
    }
  }
  return { email, displayName };
}

function requireIdentity(request: Request): RequestIdentity {
  const identity = requestIdentity(request);
  if (!identity) throw new WorkerHttpError(401, "NEXUS_SIGN_IN_REQUIRED");
  return identity;
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

async function identityDigest(email: string): Promise<string> {
  const pepper = process.env.NEXUS_IDENTITY_PEPPER;
  if (!pepper) {
    throw new WorkerHttpError(503, "NEXUS_IDENTITY_NOT_CONFIGURED");
  }
  return sha256(`${pepper}:${email.toLowerCase()}`);
}

function availabilityLabel(status: AvailabilityStatus, availableFrom: string | null) {
  if (status === "available") return "Available";
  if (status === "busy") return "Busy";
  return availableFrom ? `Ready on ${availableFrom}` : "Ready on date";
}

function safeDate(value: unknown): string | null {
  const date = clean(value, 10);
  return date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

function parseStatus(value: unknown): AvailabilityStatus {
  if (value === "available" || value === "busy" || value === "ready_on_date") {
    return value;
  }
  throw new WorkerHttpError(400, "NEXUS_AVAILABILITY_INVALID");
}

async function findPersonId(sql: Sql, identity: RequestIdentity) {
  const digest = await identityDigest(identity.email);
  const rows = await sql`
    SELECT person_id AS "personId"
    FROM nexus_identity_bindings
    WHERE provider = 'chatgpt-email-v1'
      AND provider_subject_digest = ${digest}
      AND status = 'ACTIVE'
    LIMIT 1
  `;
  return {
    digest,
    personId: clean(rows[0]?.personId, 255) ?? null,
  };
}

async function connectedAgencies(sql: Sql, personId: string) {
  const rows = await sql`
    SELECT agency.agency_id AS "agencyId", agency.name
    FROM nexus_person_agency_access_grants AS grant_row
    INNER JOIN nexus_person_agencies AS agency
      ON agency.agency_id = grant_row.agency_id
     AND agency.status = 'ACTIVE'
    WHERE grant_row.person_id = ${personId}
      AND grant_row.status = 'ACTIVE'
      AND grant_row.scope = 'RECRUITER_SAFE'
    ORDER BY agency.name
  `;
  return rows.map((row) => ({
    agencyId: String(row.agencyId),
    name: String(row.name),
  }));
}

async function ensureWorker(
  sql: Sql,
  identity: RequestIdentity,
  input: JsonRecord,
) {
  const found = await findPersonId(sql, identity);
  const personId = found.personId ?? `worker-${found.digest.slice(0, 40)}`;
  const bindingId = `binding-${found.digest.slice(0, 48)}`;
  const selfInviteId = `self-${found.digest.slice(0, 48)}`;
  const displayName =
    clean(input.displayName, 160) ??
    (identity.displayName.includes("@") ? "NOSMO Worker" : identity.displayName);
  const primaryTrade = clean(input.primaryTrade, 160) ?? "Not set";
  const location = clean(input.location, 160) ?? "Not set";
  const personRecord = JSON.stringify({
    schema: "nexus-person/v1",
    id: personId,
    displayName,
    personType: "worker",
    status: "active",
    primaryRole: primaryTrade,
    location,
    sourceSystem: "nosmo-work",
  });

  if (!found.personId) {
    await sql.transaction((tx) => [
      tx`
        INSERT INTO nexus_pm_people (
          person_id, display_name, person_type, status, record_json, persisted_at
        )
        VALUES (
          ${personId}, ${displayName}, 'worker', 'active',
          ${personRecord}::jsonb, now()
        )
        ON CONFLICT (person_id) DO NOTHING
      `,
      tx`
        INSERT INTO nexus_identity_bindings (
          binding_id, provider, provider_subject_digest, person_id,
          status, verified_at, created_at
        )
        VALUES (
          ${bindingId}, 'chatgpt-email-v1', ${found.digest}, ${personId},
          'ACTIVE', now(), now()
        )
        ON CONFLICT (provider, provider_subject_digest) DO NOTHING
      `,
    ]);
  }

  await sql.transaction((tx) => [
    tx`
      UPDATE nexus_pm_people
      SET
        display_name = ${displayName},
        record_json = ${personRecord}::jsonb,
        persisted_at = now()
      WHERE person_id = ${personId}
    `,
    tx`
      INSERT INTO nexus_person_onboarding_invites (
        invite_id, token_digest, agency, agency_id, status,
        expires_at, created_at, claimed_at
      )
      VALUES (
        ${selfInviteId}, ${`self:${found.digest}`}, 'NOSMO Work', NULL,
        'CLAIMED', now() + interval '100 years', now(), now()
      )
      ON CONFLICT (invite_id) DO NOTHING
    `,
  ]);

  return { personId, selfInviteId, displayName, primaryTrade, location };
}

async function getStatus(request: Request): Promise<Response> {
  const sql = getSql();
  const identity = requireIdentity(request);
  const found = await findPersonId(sql, identity);
  if (!found.personId) {
    return json({
      schema: "nosmo-worker-status/v1",
      signedIn: true,
      persisted: false,
      connectedAgencies: [],
      profile: null,
    });
  }
  const rows = await sql`
    SELECT record_json AS "record", persisted_at AS "persistedAt"
    FROM nexus_person_work_profiles
    WHERE person_id = ${found.personId}
      AND status = 'active'
    LIMIT 1
  `;
  const profile = asRecord(rows[0]?.record);
  return json({
    schema: "nosmo-worker-status/v1",
    signedIn: true,
    persisted: rows.length === 1,
    connectedAgencies: await connectedAgencies(sql, found.personId),
    profile: rows.length
      ? {
          availability: asRecord(profile.availability),
          updatedAt:
            rows[0]?.persistedAt instanceof Date
              ? rows[0].persistedAt.toISOString()
              : String(rows[0]?.persistedAt || ""),
        }
      : null,
  });
}

async function updateStatus(request: Request): Promise<Response> {
  const sql = getSql();
  const identity = requireIdentity(request);
  const body = asRecord(await request.json().catch(() => null));
  const status = parseStatus(body.status);
  const availableFrom = status === "ready_on_date" ? safeDate(body.availableFrom) : null;
  if (status === "ready_on_date" && !availableFrom) {
    throw new WorkerHttpError(400, "NEXUS_AVAILABILITY_DATE_REQUIRED");
  }
  const worker = await ensureWorker(sql, identity, body);
  const existingRows = await sql`
    SELECT record_json AS "record"
    FROM nexus_person_work_profiles
    WHERE person_id = ${worker.personId}
    LIMIT 1
  `;
  const existing = asRecord(existingRows[0]?.record);
  const existingPreferences = asRecord(existing.preferences);
  const roles = Array.isArray(body.targetRoles)
    ? body.targetRoles
        .map((role) => clean(role, 100))
        .filter((role): role is string => Boolean(role))
        .slice(0, 12)
    : [];
  const travel = clean(body.travel, 220) ?? "";
  const workProfile = JSON.stringify({
    ...existing,
    schema: "nexus-worker-recruiter-safe/v1",
    availability: {
      ...asRecord(existing.availability),
      status,
      label: availabilityLabel(status, availableFrom),
      availableFrom,
      preferredRadiusKm: 40,
      workAway: /travel|nationwide|travelling/i.test(travel),
      ownTransport: /driving licence|own transport/i.test(travel),
      shifts: [clean(body.preferredShifts, 160)].filter(Boolean),
    },
    preferences: {
      ...existingPreferences,
      primaryTrade: worker.primaryTrade,
      targetRoles: roles.length ? roles : [worker.primaryTrade],
      employmentTypes: [clean(body.preferredWork, 160)].filter(Boolean),
      locations: [worker.location].filter((value) => value !== "Not set"),
      rate: asRecord(existingPreferences.rate),
    },
    readiness: asRecord(existing.readiness),
    updatedBy: "worker",
  });
  const eventId = `work-event-${crypto.randomUUID()}`;
  const eventRecord = JSON.stringify({
    schema: "nexus-worker-availability-event/v1",
    status,
    availableFrom,
    source: "nosmo-work",
  });

  await sql.transaction((tx) => [
    tx`
      INSERT INTO nexus_person_work_profiles (
        person_id, schema_version, status, source_invite_id,
        record_json, persisted_at
      )
      VALUES (
        ${worker.personId}, 'nexus-worker-recruiter-safe/v1', 'active',
        ${worker.selfInviteId}, ${workProfile}::jsonb, now()
      )
      ON CONFLICT (person_id) DO UPDATE SET
        schema_version = EXCLUDED.schema_version,
        status = 'active',
        record_json = EXCLUDED.record_json,
        persisted_at = now()
    `,
    tx`
      INSERT INTO nexus_person_work_events (
        event_id, person_id, invite_id, event_type,
        actor_type, record_json, persisted_at
      )
      VALUES (
        ${eventId}, ${worker.personId}, NULL, 'AVAILABILITY_UPDATED',
        'WORKER', ${eventRecord}::jsonb, now()
      )
    `,
  ]);
  const agencies = await connectedAgencies(sql, worker.personId);
  return json({
    schema: "nosmo-worker-status-updated/v1",
    persisted: true,
    status,
    availableFrom,
    updatedAt: new Date().toISOString(),
    connectedAgencies: agencies,
  });
}

async function inviteFromToken(sql: Sql, token: string) {
  const tokenDigest = await sha256(token);
  const rows = await sql`
    SELECT
      invite.invite_id AS "inviteId",
      invite.agency_id AS "agencyId",
      invite.suggested_trade AS "suggestedTrade",
      invite.suggested_location AS "suggestedLocation",
      invite.status,
      invite.expires_at AS "expiresAt",
      agency.name AS "agencyName"
    FROM nexus_person_onboarding_invites AS invite
    INNER JOIN nexus_person_agencies AS agency
      ON agency.agency_id = invite.agency_id
     AND agency.status = 'ACTIVE'
    WHERE invite.token_digest = ${tokenDigest}
    LIMIT 1
  `;
  if (!rows.length) throw new WorkerHttpError(404, "NEXUS_INVITE_NOT_FOUND");
  const row = rows[0]!;
  if (String(row.status) !== "ACTIVE") {
    throw new WorkerHttpError(409, "NEXUS_INVITE_ALREADY_USED");
  }
  const expiresAt = new Date(String(row.expiresAt));
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
    throw new WorkerHttpError(410, "NEXUS_INVITE_EXPIRED");
  }
  return {
    tokenDigest,
    inviteId: String(row.inviteId),
    agencyId: String(row.agencyId),
    agencyName: String(row.agencyName),
    suggestedTrade: clean(row.suggestedTrade, 160) ?? null,
    suggestedLocation: clean(row.suggestedLocation, 160) ?? null,
    expiresAt: expiresAt.toISOString(),
  };
}

async function previewConnection(request: Request): Promise<Response> {
  requireIdentity(request);
  const body = asRecord(await request.json().catch(() => null));
  const token = clean(body.token, 300);
  if (!token) throw new WorkerHttpError(400, "NEXUS_INVITE_TOKEN_REQUIRED");
  const invite = await inviteFromToken(getSql(), token);
  return json({
    schema: "nosmo-worker-connection-preview/v1",
    agency: { agencyId: invite.agencyId, name: invite.agencyName },
    suggestedTrade: invite.suggestedTrade,
    suggestedLocation: invite.suggestedLocation,
    expiresAt: invite.expiresAt,
    scope: "RECRUITER_SAFE",
  });
}

async function acceptConnection(request: Request): Promise<Response> {
  const sql = getSql();
  const identity = requireIdentity(request);
  const body = asRecord(await request.json().catch(() => null));
  const token = clean(body.token, 300);
  if (!token) throw new WorkerHttpError(400, "NEXUS_INVITE_TOKEN_REQUIRED");
  const invite = await inviteFromToken(sql, token);
  const worker = await ensureWorker(sql, identity, body);
  const grantRecord = JSON.stringify({
    schema: "nexus-worker-consent/v1",
    scope: "RECRUITER_SAFE",
    agencyId: invite.agencyId,
    acceptedBy: "worker",
    acceptedAt: new Date().toISOString(),
  });

  const claimed = await sql`
    WITH claimed_invite AS (
      UPDATE nexus_person_onboarding_invites
      SET
        status = 'CLAIMED',
        claimed_at = now(),
        claimed_person_id = ${worker.personId}
      WHERE invite_id = ${invite.inviteId}
        AND status = 'ACTIVE'
      RETURNING invite_id
    )
    INSERT INTO nexus_person_agency_access_grants (
        agency_id, person_id, source_invite_id, scope, status,
        consent_source, record_json, granted_at, revoked_at, updated_at
      )
      SELECT
        ${invite.agencyId}, ${worker.personId}, ${invite.inviteId},
        'RECRUITER_SAFE', 'ACTIVE', 'WORKER_INVITE_ACCEPTED',
        ${grantRecord}::jsonb, now(), NULL, now()
      FROM claimed_invite
      ON CONFLICT (agency_id, person_id) DO UPDATE SET
        source_invite_id = EXCLUDED.source_invite_id,
        scope = 'RECRUITER_SAFE',
        status = 'ACTIVE',
        consent_source = 'WORKER_INVITE_ACCEPTED',
        record_json = EXCLUDED.record_json,
        granted_at = now(),
        revoked_at = NULL,
        updated_at = now()
      RETURNING agency_id AS "agencyId"
  `;
  if (!claimed.length) {
    throw new WorkerHttpError(409, "NEXUS_INVITE_ALREADY_USED");
  }

  return json({
    schema: "nosmo-worker-connection-accepted/v1",
    connected: true,
    agency: { agencyId: invite.agencyId, name: invite.agencyName },
    scope: "RECRUITER_SAFE",
  });
}

function assertSameOrigin(request: Request) {
  if (request.method === "GET" || request.method === "HEAD") return;
  const origin = request.headers.get("origin");
  if (!origin) throw new WorkerHttpError(403, "NEXUS_ORIGIN_DENIED");
  let originUrl: URL;
  try {
    originUrl = new URL(origin);
  } catch {
    throw new WorkerHttpError(403, "NEXUS_ORIGIN_DENIED");
  }
  if (originUrl.origin !== new URL(request.url).origin) {
    throw new WorkerHttpError(403, "NEXUS_ORIGIN_DENIED");
  }
}

export async function handleWorkerRequest(
  request: Request,
  path: string[],
): Promise<Response> {
  try {
    assertSameOrigin(request);
    const method = request.method.toUpperCase();
    const route = path.join("/");
    if (method === "GET" && route === "status") return await getStatus(request);
    if (method === "PATCH" && route === "status") return await updateStatus(request);
    if (method === "POST" && route === "connection/preview") {
      return await previewConnection(request);
    }
    if (method === "POST" && route === "connection") {
      return await acceptConnection(request);
    }
    return json({ error: "NEXUS_WORKER_ROUTE_NOT_FOUND" }, 404);
  } catch (error) {
    if (error instanceof WorkerHttpError) {
      return json({ error: error.code }, error.status);
    }
    console.error("Worker API request failed", {
      method: request.method,
      route: path.join("/"),
      error: error instanceof Error ? error.name : "UnknownError",
    });
    return json({ error: "NEXUS_WORKER_API_UNAVAILABLE" }, 503);
  }
}
