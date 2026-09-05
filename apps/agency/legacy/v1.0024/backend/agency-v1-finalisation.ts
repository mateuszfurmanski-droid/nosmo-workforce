import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { Router, type IRouter, type Request } from "express";
import { db } from "@workspace/db";

const router: IRouter = Router();

const REQUEST_STATUSES = new Set(["DRAFT", "OPEN", "PAUSED", "FILLED", "CANCELLED"]);
const APPLICATION_STAGES = new Set([
  "NEW",
  "SHORTLISTED",
  "CONTACTED",
  "INTERESTED",
  "SUBMITTED",
  "INTERVIEW",
  "OFFERED",
  "PLACED",
  "REJECTED",
  "WITHDRAWN",
]);
const READINESS_STATUSES = new Set(["READY", "CHECK", "BLOCKED"]);
const PLACEMENT_STATUSES = new Set(["PLACED", "STARTED", "COMPLETED", "CANCELLED"]);
const RATE_UNITS = new Set(["HOURLY", "DAILY", "WEEKLY", "FIXED"]);

const clean = (value: unknown, max: number): string | undefined => {
  if (typeof value !== "string") return undefined;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, max) : undefined;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const asStringArray = (value: unknown, maxItems = 24): string[] =>
  Array.isArray(value)
    ? value
        .map((item) => clean(item, 180))
        .filter((item): item is string => Boolean(item))
        .slice(0, maxItems)
    : [];

const asPositiveInteger = (value: unknown, fallback = 1): number => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const asNullableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const requireAuthUserId = (req: Request): string | null =>
  req.isAuthenticated() ? req.user.id : null;

type AgencyContext = {
  agencyId: string;
  agencyName: string;
  authUserId: string;
  role: string;
};

async function loadAgencyContext(authUserId: string): Promise<AgencyContext | null> {
  const result = await db.execute(sql`
    select
      a.agency_id as "agencyId",
      a.name as "agencyName",
      m.role as "role"
    from nexus_person_agency_members m
    join nexus_person_agencies a on a.agency_id = m.agency_id
    where m.auth_user_id = ${authUserId}
      and m.status = 'ACTIVE'
      and a.status = 'ACTIVE'
    limit 2
  `);
  const rows = (result.rows ?? []) as Array<Record<string, unknown>>;
  if (rows.length !== 1) return null;
  return {
    agencyId: String(rows[0]!.agencyId),
    agencyName: String(rows[0]!.agencyName),
    authUserId,
    role: String(rows[0]!.role),
  };
}

async function requireAgency(req: Request): Promise<AgencyContext | null> {
  const authUserId = requireAuthUserId(req);
  if (!authUserId) return null;
  return loadAgencyContext(authUserId);
}

function rowsOf(result: { rows?: unknown[] }): Array<Record<string, unknown>> {
  return (result.rows ?? []) as Array<Record<string, unknown>>;
}

router.get("/person-card/agency/v1/_health", async (req, res) => {
  const requiredTables = [
    "nexus_person_agencies",
    "nexus_person_agency_members",
    "nexus_person_agency_recruiter_profiles",
    "nexus_person_agency_access_grants",
    "nexus_person_agency_candidate_states",
    "nexus_person_agency_actions",
    "nexus_person_agency_roster_workers",
    "nexus_person_agency_roster_events",
    "nexus_person_agency_requests",
    "nexus_person_agency_applications",
    "nexus_person_agency_pipeline_events",
    "nexus_person_agency_placements",
    "nexus_person_work_profiles",
    "nexus_pm_people",
  ];

  try {
    const result = await db.execute(sql`
      select unnest(array[
        to_regclass('public.nexus_person_agencies')::text,
        to_regclass('public.nexus_person_agency_members')::text,
        to_regclass('public.nexus_person_agency_recruiter_profiles')::text,
        to_regclass('public.nexus_person_agency_access_grants')::text,
        to_regclass('public.nexus_person_agency_candidate_states')::text,
        to_regclass('public.nexus_person_agency_actions')::text,
        to_regclass('public.nexus_person_agency_roster_workers')::text,
        to_regclass('public.nexus_person_agency_roster_events')::text,
        to_regclass('public.nexus_person_agency_requests')::text,
        to_regclass('public.nexus_person_agency_applications')::text,
        to_regclass('public.nexus_person_agency_pipeline_events')::text,
        to_regclass('public.nexus_person_agency_placements')::text,
        to_regclass('public.nexus_person_work_profiles')::text,
        to_regclass('public.nexus_pm_people')::text
      ]) as table_name
    `);
    const present = new Set(
      rowsOf(result)
        .map((row) => row.table_name)
        .filter((value): value is string => typeof value === "string"),
    );
    const missingTables = requiredTables.filter((name) => !present.has(name));
    res.status(missingTables.length ? 503 : 200).json({
      schema: "nosmo-agency-v1-health/v1",
      status: missingTables.length ? "database-migration-required" : "ok",
      databaseReady: missingTables.length === 0,
      missingTables,
      tenantScopeSource: "authenticated-agency-membership",
      recruiterSafeConsentGate: true,
      importedRosterSupported: true,
      jobsPipelineSupported: true,
      placementsSupported: true,
      askNexusTenantContextSupported: true,
    });
  } catch (error) {
    req.log?.error?.({ err: error }, "NOSMO Agency V1 health check failed");
    res.status(503).json({
      schema: "nosmo-agency-v1-health/v1",
      status: "database-unavailable",
      databaseReady: false,
      missingTables: requiredTables,
    });
  }
});

router.get("/person-card/agency/v1/dashboard", async (req, res) => {
  const authUserId = requireAuthUserId(req);
  if (!authUserId) {
    res.status(401).json({ error: "NEXUS_AUTH_REQUIRED" });
    return;
  }
  const agency = await loadAgencyContext(authUserId);
  if (!agency) {
    res.status(403).json({ error: "NEXUS_AGENCY_ACCOUNT_REQUIRED" });
    return;
  }

  const result = await db.execute(sql`
    select
      (select count(*)::int from nexus_person_agency_roster_workers r
        where r.agency_id = ${agency.agencyId} and r.status = 'ACTIVE') as "rosterWorkers",
      (select count(*)::int from nexus_person_agency_access_grants g
        where g.agency_id = ${agency.agencyId} and g.status = 'ACTIVE' and g.scope = 'RECRUITER_SAFE') as "consentedWorkers",
      (select count(*)::int from nexus_person_agency_requests q
        where q.agency_id = ${agency.agencyId} and q.status = 'OPEN') as "openRequests",
      (select count(*)::int from nexus_person_agency_applications a
        where a.agency_id = ${agency.agencyId}
          and a.stage not in ('PLACED','REJECTED','WITHDRAWN')) as "candidatesInPipeline",
      (select count(*)::int from nexus_person_agency_applications a
        where a.agency_id = ${agency.agencyId}
          and a.readiness_status in ('CHECK','BLOCKED')) as "readinessAttention",
      (select count(*)::int from nexus_person_agency_placements p
        where p.agency_id = ${agency.agencyId} and p.status in ('PLACED','STARTED')) as "livePlacements"
  `);

  const stageResult = await db.execute(sql`
    select stage, count(*)::int as count
    from nexus_person_agency_applications
    where agency_id = ${agency.agencyId}
    group by stage
    order by stage
  `);

  res.json({
    schema: "nosmo-agency-dashboard/v1",
    agency: { agencyId: agency.agencyId, name: agency.agencyName, role: agency.role },
    summary: rowsOf(result)[0] ?? {},
    pipeline: rowsOf(stageResult),
    privacy: {
      workerOwnedDataRequiresConsent: true,
      recruiterSafeScope: "RECRUITER_SAFE",
      importedRosterIsAgencyOwned: true,
    },
  });
});

router.get("/person-card/agency/v1/roster", async (req, res) => {
  const authUserId = requireAuthUserId(req);
  if (!authUserId) {
    res.status(401).json({ error: "NEXUS_AUTH_REQUIRED" });
    return;
  }
  const agency = await loadAgencyContext(authUserId);
  if (!agency) {
    res.status(403).json({ error: "NEXUS_AGENCY_ACCOUNT_REQUIRED" });
    return;
  }

  const limit = Math.min(200, asPositiveInteger(req.query.limit, 100));
  const q = clean(req.query.q, 120)?.toLowerCase();
  const pattern = q ? `%${q}%` : null;

  const result = pattern
    ? await db.execute(sql`
        select
          roster_worker_id as "rosterWorkerId",
          display_name as "displayName",
          record_json->>'trade' as trade,
          record_json->>'location' as location,
          record_json->'availability'->>'status' as "availabilityStatus",
          record_json->'availability'->>'availableFrom' as "availableFrom",
          record_json->'skills' as skills,
          record_json->'licences' as licences,
          record_json->>'expectedRate' as "expectedRate",
          connection_status as "connectionStatus",
          coalesce((record_json->>'workerAppConfirmed')::boolean, false) as "workerAppConfirmed",
          (normalized_email is not null) as "hasEmail",
          (normalized_phone is not null) as "hasPhone",
          updated_at as "updatedAt"
        from nexus_person_agency_roster_workers
        where agency_id = ${agency.agencyId}
          and status = 'ACTIVE'
          and lower(concat_ws(' ', display_name, record_json->>'trade', record_json->>'location', record_json->'skills', record_json->'licences')) like ${pattern}
        order by updated_at desc, display_name asc
        limit ${limit}
      `)
    : await db.execute(sql`
        select
          roster_worker_id as "rosterWorkerId",
          display_name as "displayName",
          record_json->>'trade' as trade,
          record_json->>'location' as location,
          record_json->'availability'->>'status' as "availabilityStatus",
          record_json->'availability'->>'availableFrom' as "availableFrom",
          record_json->'skills' as skills,
          record_json->'licences' as licences,
          record_json->>'expectedRate' as "expectedRate",
          connection_status as "connectionStatus",
          coalesce((record_json->>'workerAppConfirmed')::boolean, false) as "workerAppConfirmed",
          (normalized_email is not null) as "hasEmail",
          (normalized_phone is not null) as "hasPhone",
          updated_at as "updatedAt"
        from nexus_person_agency_roster_workers
        where agency_id = ${agency.agencyId} and status = 'ACTIVE'
        order by updated_at desc, display_name asc
        limit ${limit}
      `);

  const workers = rowsOf(result);
  res.json({
    schema: "nosmo-agency-roster-list/v1",
    agency: { agencyId: agency.agencyId, name: agency.agencyName },
    workers,
    count: workers.length,
    contactValuesIncluded: false,
    importedRosterIsAgencyOwned: true,
  });
});

router.get("/person-card/agency/v1/requests", async (req, res) => {
  const authUserId = requireAuthUserId(req);
  if (!authUserId) {
    res.status(401).json({ error: "NEXUS_AUTH_REQUIRED" });
    return;
  }
  const agency = await loadAgencyContext(authUserId);
  if (!agency) {
    res.status(403).json({ error: "NEXUS_AGENCY_ACCOUNT_REQUIRED" });
    return;
  }

  const status = clean(req.query.status, 24)?.toUpperCase();
  const result = status && REQUEST_STATUSES.has(status)
    ? await db.execute(sql`
        select request_id as "requestId", role, client_name as "clientName", location,
          status, headcount, record_json as "details", published_at as "publishedAt",
          created_at as "createdAt", updated_at as "updatedAt"
        from nexus_person_agency_requests
        where agency_id = ${agency.agencyId} and status = ${status}
        order by updated_at desc
        limit 200
      `)
    : await db.execute(sql`
        select request_id as "requestId", role, client_name as "clientName", location,
          status, headcount, record_json as "details", published_at as "publishedAt",
          created_at as "createdAt", updated_at as "updatedAt"
        from nexus_person_agency_requests
        where agency_id = ${agency.agencyId}
        order by updated_at desc
        limit 200
      `);

  res.json({
    schema: "nosmo-agency-request-list/v1",
    agency: { agencyId: agency.agencyId, name: agency.agencyName },
    requests: rowsOf(result),
  });
});

router.post("/person-card/agency/v1/requests", async (req, res) => {
  const authUserId = requireAuthUserId(req);
  if (!authUserId) {
    res.status(401).json({ error: "NEXUS_AUTH_REQUIRED" });
    return;
  }
  const agency = await loadAgencyContext(authUserId);
  if (!agency) {
    res.status(403).json({ error: "NEXUS_AGENCY_ACCOUNT_REQUIRED" });
    return;
  }

  const role = clean(req.body?.role, 160);
  const clientName = clean(req.body?.clientName, 180);
  const location = clean(req.body?.location, 180);
  const status = clean(req.body?.status, 24)?.toUpperCase() ?? "DRAFT";
  const headcount = Math.min(10000, asPositiveInteger(req.body?.headcount, 1));
  if (!role || !clientName || !location || !REQUEST_STATUSES.has(status)) {
    res.status(400).json({ error: "NEXUS_AGENCY_REQUEST_INVALID" });
    return;
  }

  const details = {
    schema: "nosmo-agency-request/v1",
    startDate: clean(req.body?.startDate, 32) ?? null,
    requiredSkills: asStringArray(req.body?.requiredSkills),
    requiredLicences: asStringArray(req.body?.requiredLicences),
    preferences: asRecord(req.body?.preferences),
    rates: asRecord(req.body?.rates),
    matchPolicy: {
      explainable: true,
      factors: ["trade", "skills", "licences", "location", "availability", "experience", "preferences"],
    },
  };
  const requestId = `agency-request-${randomUUID()}`;
  const now = new Date();
  const publishedAt = status === "OPEN" ? now : null;
  const detailsJson = JSON.stringify(details);

  await db.execute(sql`
    insert into nexus_person_agency_requests
      (request_id, agency_id, role, client_name, location, status, headcount,
       record_json, created_by_user_id, updated_by_user_id, published_at, created_at, updated_at)
    values
      (${requestId}, ${agency.agencyId}, ${role}, ${clientName}, ${location}, ${status}, ${headcount},
       ${detailsJson}::jsonb, ${authUserId}, ${authUserId}, ${publishedAt}, ${now}, ${now})
  `);

  res.status(201).json({
    schema: "nosmo-agency-request-created/v1",
    request: { requestId, role, clientName, location, status, headcount, details, publishedAt },
  });
});

router.get("/person-card/agency/v1/requests/:requestId/applications", async (req, res) => {
  const authUserId = requireAuthUserId(req);
  if (!authUserId) {
    res.status(401).json({ error: "NEXUS_AUTH_REQUIRED" });
    return;
  }
  const agency = await loadAgencyContext(authUserId);
  if (!agency) {
    res.status(403).json({ error: "NEXUS_AGENCY_ACCOUNT_REQUIRED" });
    return;
  }
  const requestId = clean(req.params.requestId, 180);
  if (!requestId) {
    res.status(400).json({ error: "NEXUS_AGENCY_REQUEST_ID_REQUIRED" });
    return;
  }

  const requestResult = await db.execute(sql`
    select request_id from nexus_person_agency_requests
    where agency_id = ${agency.agencyId} and request_id = ${requestId}
    limit 1
  `);
  if (rowsOf(requestResult).length !== 1) {
    res.status(404).json({ error: "NEXUS_AGENCY_REQUEST_NOT_FOUND" });
    return;
  }

  const result = await db.execute(sql`
    select
      a.application_id as "applicationId",
      a.person_id as "personId",
      a.roster_worker_id as "rosterWorkerId",
      coalesce(r.display_name, p.display_name, 'Candidate') as "displayName",
      a.stage,
      a.readiness_status as "readinessStatus",
      a.next_action as "nextAction",
      a.last_contact_at as "lastContactAt",
      a.record_json->'match'->>'strength' as "matchStrength",
      a.record_json->'match'->'reasons' as "matchReasons",
      a.record_json->'match'->'gaps' as "matchGaps",
      a.updated_at as "updatedAt"
    from nexus_person_agency_applications a
    left join nexus_person_agency_roster_workers r
      on r.roster_worker_id = a.roster_worker_id and r.agency_id = a.agency_id
    left join nexus_pm_people p on p.person_id = a.person_id
    where a.agency_id = ${agency.agencyId} and a.request_id = ${requestId}
    order by
      case a.readiness_status when 'READY' then 1 when 'CHECK' then 2 else 3 end,
      a.updated_at desc
  `);

  res.json({
    schema: "nosmo-agency-application-list/v1",
    requestId,
    applications: rowsOf(result),
    explainableMatching: true,
  });
});

router.patch("/person-card/agency/v1/applications/:applicationId", async (req, res) => {
  const authUserId = requireAuthUserId(req);
  if (!authUserId) {
    res.status(401).json({ error: "NEXUS_AUTH_REQUIRED" });
    return;
  }
  const agency = await loadAgencyContext(authUserId);
  if (!agency) {
    res.status(403).json({ error: "NEXUS_AGENCY_ACCOUNT_REQUIRED" });
    return;
  }
  const applicationId = clean(req.params.applicationId, 180);
  const stage = clean(req.body?.stage, 32)?.toUpperCase();
  const readinessStatus = clean(req.body?.readinessStatus, 24)?.toUpperCase();
  const nextAction = clean(req.body?.nextAction, 400);
  if (!applicationId) {
    res.status(400).json({ error: "NEXUS_AGENCY_APPLICATION_ID_REQUIRED" });
    return;
  }
  if (stage && !APPLICATION_STAGES.has(stage)) {
    res.status(400).json({ error: "NEXUS_AGENCY_APPLICATION_STAGE_INVALID" });
    return;
  }
  if (readinessStatus && !READINESS_STATUSES.has(readinessStatus)) {
    res.status(400).json({ error: "NEXUS_AGENCY_READINESS_INVALID" });
    return;
  }

  const currentResult = await db.execute(sql`
    select application_id as "applicationId", request_id as "requestId", stage,
      readiness_status as "readinessStatus"
    from nexus_person_agency_applications
    where agency_id = ${agency.agencyId} and application_id = ${applicationId}
    limit 1
  `);
  const current = rowsOf(currentResult)[0];
  if (!current) {
    res.status(404).json({ error: "NEXUS_AGENCY_APPLICATION_NOT_FOUND" });
    return;
  }

  const nextStage = stage ?? String(current.stage);
  const nextReadiness = readinessStatus ?? String(current.readinessStatus);
  const now = new Date();
  await db.execute(sql`
    update nexus_person_agency_applications
    set stage = ${nextStage}, readiness_status = ${nextReadiness},
        next_action = ${nextAction ?? null}, updated_at = ${now}
    where agency_id = ${agency.agencyId} and application_id = ${applicationId}
  `);

  const eventId = `agency-pipeline-event-${randomUUID()}`;
  const eventJson = JSON.stringify({
    schema: "nosmo-agency-pipeline-event/v1",
    fromStage: current.stage,
    toStage: nextStage,
    fromReadiness: current.readinessStatus,
    toReadiness: nextReadiness,
    nextAction: nextAction ?? null,
  });
  await db.execute(sql`
    insert into nexus_person_agency_pipeline_events
      (event_id, agency_id, request_id, application_id, actor_user_id, event_type, record_json, created_at)
    values
      (${eventId}, ${agency.agencyId}, ${String(current.requestId)}, ${applicationId},
       ${authUserId}, 'APPLICATION_UPDATED', ${eventJson}::jsonb, ${now})
  `);

  res.json({
    schema: "nosmo-agency-application-updated/v1",
    applicationId,
    stage: nextStage,
    readinessStatus: nextReadiness,
    nextAction: nextAction ?? null,
    updatedAt: now,
  });
});

router.post("/person-card/agency/v1/placements", async (req, res) => {
  const authUserId = requireAuthUserId(req);
  if (!authUserId) {
    res.status(401).json({ error: "NEXUS_AUTH_REQUIRED" });
    return;
  }
  const agency = await loadAgencyContext(authUserId);
  if (!agency) {
    res.status(403).json({ error: "NEXUS_AGENCY_ACCOUNT_REQUIRED" });
    return;
  }

  const applicationId = clean(req.body?.applicationId, 180);
  const status = clean(req.body?.status, 24)?.toUpperCase() ?? "PLACED";
  const startDate = clean(req.body?.startDate, 32);
  const endDate = clean(req.body?.endDate, 32);
  const rateUnit = clean(req.body?.rateUnit, 24)?.toUpperCase();
  const payRateAmount = asNullableNumber(req.body?.payRateAmount);
  const billRateAmount = asNullableNumber(req.body?.billRateAmount);
  const currency = clean(req.body?.currency, 12)?.toUpperCase() ?? "GBP";
  if (!applicationId || !PLACEMENT_STATUSES.has(status) || (rateUnit && !RATE_UNITS.has(rateUnit))) {
    res.status(400).json({ error: "NEXUS_AGENCY_PLACEMENT_INVALID" });
    return;
  }

  const applicationResult = await db.execute(sql`
    select application_id as "applicationId", request_id as "requestId"
    from nexus_person_agency_applications
    where agency_id = ${agency.agencyId} and application_id = ${applicationId}
    limit 1
  `);
  const application = rowsOf(applicationResult)[0];
  if (!application) {
    res.status(404).json({ error: "NEXUS_AGENCY_APPLICATION_NOT_FOUND" });
    return;
  }

  const placementId = `agency-placement-${randomUUID()}`;
  const now = new Date();
  const recordJson = JSON.stringify({
    schema: "nosmo-agency-placement/v1",
    notes: clean(req.body?.notes, 600) ?? null,
  });
  await db.execute(sql`
    insert into nexus_person_agency_placements
      (placement_id, agency_id, request_id, application_id, status, start_date, end_date,
       currency, rate_unit, pay_rate_amount, bill_rate_amount, record_json,
       created_by_user_id, updated_by_user_id, created_at, updated_at)
    values
      (${placementId}, ${agency.agencyId}, ${String(application.requestId)}, ${applicationId}, ${status},
       ${startDate ?? null}, ${endDate ?? null}, ${currency}, ${rateUnit ?? null}, ${payRateAmount}, ${billRateAmount},
       ${recordJson}::jsonb, ${authUserId}, ${authUserId}, ${now}, ${now})
  `);
  await db.execute(sql`
    update nexus_person_agency_applications
    set stage = 'PLACED', updated_at = ${now}
    where agency_id = ${agency.agencyId} and application_id = ${applicationId}
  `);

  res.status(201).json({
    schema: "nosmo-agency-placement-created/v1",
    placement: {
      placementId,
      applicationId,
      requestId: String(application.requestId),
      status,
      startDate: startDate ?? null,
      endDate: endDate ?? null,
      currency,
      rateUnit: rateUnit ?? null,
      payRateAmount,
      billRateAmount,
    },
  });
});

router.post("/person-card/agency/v1/ask-nexus/query", async (req, res) => {
  const authUserId = requireAuthUserId(req);
  if (!authUserId) {
    res.status(401).json({ error: "NEXUS_AUTH_REQUIRED" });
    return;
  }
  const agency = await loadAgencyContext(authUserId);
  if (!agency) {
    res.status(403).json({ error: "NEXUS_AGENCY_ACCOUNT_REQUIRED" });
    return;
  }
  const question = clean(req.body?.question, 500);
  if (!question) {
    res.status(400).json({ error: "NEXUS_AGENCY_QUESTION_REQUIRED" });
    return;
  }
  const q = question.toLowerCase();

  let answer = "I can answer this from the current agency-scoped worker, request and pipeline data, but this question needs a more specific filter.";
  let evidence: Array<Record<string, unknown>> = [];
  let answerType = "NEEDS_FILTER";

  if (q.includes("not connected") || q.includes("worker app")) {
    const result = await db.execute(sql`
      select display_name as "displayName", record_json->>'trade' as trade,
        record_json->>'location' as location, connection_status as "connectionStatus"
      from nexus_person_agency_roster_workers
      where agency_id = ${agency.agencyId} and status = 'ACTIVE'
        and coalesce((record_json->>'workerAppConfirmed')::boolean, false) = false
      order by display_name
      limit 100
    `);
    evidence = rowsOf(result);
    answerType = "IMPORTED_NOT_CONNECTED";
    answer = `${evidence.length} imported worker${evidence.length === 1 ? " is" : "s are"} not yet confirmed through Worker App recruiter-safe sharing.`;
  } else if (q.includes("cscs")) {
    const result = await db.execute(sql`
      select display_name as "displayName", record_json->>'trade' as trade,
        record_json->>'location' as location, record_json->'licences' as licences
      from nexus_person_agency_roster_workers r
      where agency_id = ${agency.agencyId} and status = 'ACTIVE'
        and exists (
          select 1 from jsonb_array_elements_text(coalesce(r.record_json->'licences','[]'::jsonb)) item
          where item ilike 'CSCS %'
        )
      order by display_name
      limit 100
    `);
    evidence = rowsOf(result);
    answerType = "CSCS_WORKERS";
    answer = `${evidence.length} agency roster worker${evidence.length === 1 ? " has" : "s have"} a CSCS entry in the current imported data.`;
  } else if (q.includes("available") || q.includes("ready from")) {
    const result = await db.execute(sql`
      select display_name as "displayName", record_json->>'trade' as trade,
        record_json->>'location' as location,
        record_json->'availability'->>'status' as "availabilityStatus",
        record_json->'availability'->>'availableFrom' as "availableFrom"
      from nexus_person_agency_roster_workers
      where agency_id = ${agency.agencyId} and status = 'ACTIVE'
        and record_json->'availability'->>'status' in ('Available','Ready on date')
      order by nullif(record_json->'availability'->>'availableFrom','')::date nulls last, display_name
      limit 100
    `);
    evidence = rowsOf(result);
    answerType = "AVAILABLE_WORKERS";
    answer = `${evidence.length} roster worker${evidence.length === 1 ? " is" : "s are"} currently marked Available or Ready on date.`;
  } else if (q.includes("strongest") || q.includes("match")) {
    const result = await db.execute(sql`
      select coalesce(r.display_name, p.display_name, 'Candidate') as "displayName",
        req.role, req.location, a.stage, a.readiness_status as "readinessStatus",
        a.record_json->'match'->>'strength' as "matchStrength",
        a.record_json->'match'->'reasons' as reasons,
        a.record_json->'match'->'gaps' as gaps
      from nexus_person_agency_applications a
      join nexus_person_agency_requests req
        on req.request_id = a.request_id and req.agency_id = a.agency_id
      left join nexus_person_agency_roster_workers r
        on r.roster_worker_id = a.roster_worker_id and r.agency_id = a.agency_id
      left join nexus_pm_people p on p.person_id = a.person_id
      where a.agency_id = ${agency.agencyId}
      order by case a.readiness_status when 'READY' then 1 when 'CHECK' then 2 else 3 end,
        a.updated_at desc
      limit 20
    `);
    evidence = rowsOf(result);
    answerType = "EXPLAINABLE_MATCHES";
    answer = evidence.length
      ? "Here are the strongest current matches, ordered by readiness. Reasons and gaps are included rather than an unexplained AI percentage."
      : "There are no candidate matches recorded for this agency yet.";
  } else if (q.includes("follow-up") || q.includes("waiting for a response") || q.includes("need follow")) {
    const result = await db.execute(sql`
      select coalesce(r.display_name, p.display_name, 'Candidate') as "displayName",
        req.role, a.stage, a.readiness_status as "readinessStatus",
        a.next_action as "nextAction", a.last_contact_at as "lastContactAt"
      from nexus_person_agency_applications a
      join nexus_person_agency_requests req
        on req.request_id = a.request_id and req.agency_id = a.agency_id
      left join nexus_person_agency_roster_workers r
        on r.roster_worker_id = a.roster_worker_id and r.agency_id = a.agency_id
      left join nexus_pm_people p on p.person_id = a.person_id
      where a.agency_id = ${agency.agencyId}
        and a.stage not in ('PLACED','REJECTED','WITHDRAWN')
        and a.next_action is not null
      order by a.updated_at asc
      limit 100
    `);
    evidence = rowsOf(result);
    answerType = "FOLLOW_UP";
    answer = `${evidence.length} candidate${evidence.length === 1 ? " needs" : "s need"} a recorded follow-up action.`;
  } else if (q.includes("open request") && q.includes("no ready")) {
    const result = await db.execute(sql`
      select req.request_id as "requestId", req.role, req.client_name as "clientName", req.location
      from nexus_person_agency_requests req
      where req.agency_id = ${agency.agencyId} and req.status = 'OPEN'
        and not exists (
          select 1 from nexus_person_agency_applications a
          where a.agency_id = req.agency_id and a.request_id = req.request_id
            and a.readiness_status = 'READY'
        )
      order by req.updated_at desc
      limit 100
    `);
    evidence = rowsOf(result);
    answerType = "OPEN_REQUESTS_WITHOUT_READY";
    answer = `${evidence.length} open request${evidence.length === 1 ? " has" : "s have"} no READY candidate recorded.`;
  } else if (q.includes("documents") && q.includes("expir")) {
    answerType = "DOCUMENT_EXPIRY_NOT_AVAILABLE";
    answer = "The current Agency projection does not contain trustworthy certificate expiry dates, so I will not infer or invent document-expiry results.";
  } else if (q.includes("worked in")) {
    answerType = "WORK_HISTORY_NOT_AVAILABLE";
    answer = "The current agency-safe dataset contains current/preferred locations, not verified work-history locations. I will not treat preferred location as proof that someone worked there.";
  }

  res.json({
    schema: "nosmo-agency-ask-nexus-answer/v1",
    agency: { agencyId: agency.agencyId, name: agency.agencyName },
    question,
    answerType,
    answer,
    evidence,
    evidenceCount: evidence.length,
    tenantScoped: true,
    privateWorkerFieldsIncluded: false,
    generatedFromAgencyDataOnly: true,
  });
});

export default router;
