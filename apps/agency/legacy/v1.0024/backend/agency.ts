import { randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { Router, type IRouter, type Request } from "express";
import {
  db,
  nexusPersonAgenciesTable,
  nexusPersonAgencyAccessGrantsTable,
  nexusPersonAgencyActionsTable,
  nexusPersonAgencyCandidateStatesTable,
  nexusPersonAgencyMembersTable,
  nexusPersonAgencyRecruiterProfilesTable,
  nexusPersonWorkProfilesTable,
  nexusPmPeopleTable,
} from "@workspace/db";

const router: IRouter = Router();

const PIPELINE_STAGES = new Set([
  "NEW",
  "SHORTLISTED",
  "CONTACTED",
  "REQUESTED",
  "OFFERED",
  "PLACED",
  "REJECTED",
]);

const ACTION_TYPES = new Set([
  "PROFILE_VIEWED",
  "SHORTLISTED",
  "REMOVED_FROM_SHORTLIST",
  "REQUEST_PACK_DRAFTED",
  "OFFER_DRAFTED",
  "CONTACTED",
  "SHARED",
]);

const clean = (value: unknown, max: number): string | undefined => {
  if (typeof value !== "string") return undefined;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, max) : undefined;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const asStringArray = (value: unknown, maxItems = 12): string[] =>
  Array.isArray(value)
    ? value
        .map((item) => clean(item, 160))
        .filter((item): item is string => Boolean(item))
        .slice(0, maxItems)
    : [];

const asNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const readinessState = (value: unknown): string => {
  const record = asRecord(value);
  return clean(record.state, 40) ?? "unknown";
};

const requireAuthUserId = (req: Request): string | null =>
  req.isAuthenticated() ? req.user.id : null;

type AgencyContext = {
  agencyId: string;
  agencyName: string;
  website: string | null;
  registrationNumber: string | null;
  location: string | null;
  description: string | null;
  verificationStatus: string;
  authUserId: string;
  role: string;
};

async function loadAgencyContext(
  authUserId: string,
): Promise<AgencyContext | null> {
  const rows = await db
    .select({
      agencyId: nexusPersonAgenciesTable.agencyId,
      agencyName: nexusPersonAgenciesTable.name,
      agencyStatus: nexusPersonAgenciesTable.status,
      website: nexusPersonAgenciesTable.website,
      registrationNumber: nexusPersonAgenciesTable.registrationNumber,
      location: nexusPersonAgenciesTable.location,
      description: nexusPersonAgenciesTable.description,
      verificationStatus: nexusPersonAgenciesTable.verificationStatus,
      memberRole: nexusPersonAgencyMembersTable.role,
      memberStatus: nexusPersonAgencyMembersTable.status,
    })
    .from(nexusPersonAgencyMembersTable)
    .innerJoin(
      nexusPersonAgenciesTable,
      eq(
        nexusPersonAgenciesTable.agencyId,
        nexusPersonAgencyMembersTable.agencyId,
      ),
    )
    .where(eq(nexusPersonAgencyMembersTable.authUserId, authUserId))
    .limit(2);

  if (
    rows.length !== 1 ||
    rows[0]!.agencyStatus !== "ACTIVE" ||
    rows[0]!.memberStatus !== "ACTIVE"
  ) {
    return null;
  }

  return {
    agencyId: rows[0]!.agencyId,
    agencyName: rows[0]!.agencyName,
    website: rows[0]!.website,
    registrationNumber: rows[0]!.registrationNumber,
    location: rows[0]!.location,
    description: rows[0]!.description,
    verificationStatus: rows[0]!.verificationStatus,
    authUserId,
    role: rows[0]!.memberRole,
  };
}

function recruiterSafeCandidate(row: {
  personId: string;
  displayName: string;
  personRecord: Record<string, unknown>;
  workProfileRecord: Record<string, unknown>;
  persistedAt: Date;
  stage: string | null;
  note: string | null;
  stateUpdatedAt: Date | null;
}) {
  const person = asRecord(row.personRecord);
  const work = asRecord(row.workProfileRecord);
  const availability = asRecord(work.availability);
  const preferences = asRecord(work.preferences);
  const rate = asRecord(preferences.rate);
  const readiness = asRecord(work.readiness);

  const primaryTrade =
    clean(preferences.primaryTrade, 160) ??
    clean(person.primaryRole, 160) ??
    "Not set";

  const locations = asStringArray(preferences.locations, 8);
  const personLocation = clean(person.location, 160);
  if (locations.length === 0 && personLocation) locations.push(personLocation);

  return {
    schema: "nexus-agency-candidate-safe/v1",
    personId: row.personId,
    displayName: row.displayName,
    primaryTrade,
    locations,
    experienceYears: asNumber(person.experienceYears),
    verification: clean(person.verification, 80) ?? "unverified",
    availability: {
      status: clean(availability.status, 60) ?? "unknown",
      label: clean(availability.label, 80) ?? "Unknown",
      availableFrom: clean(availability.availableFrom, 40) ?? null,
      preferredRadiusKm: asNumber(availability.preferredRadiusKm),
      workAway: availability.workAway === true,
      ownTransport: availability.ownTransport === true,
      shifts: asStringArray(availability.shifts, 8),
    },
    preferences: {
      targetRoles: asStringArray(preferences.targetRoles, 12),
      employmentTypes: asStringArray(preferences.employmentTypes, 12),
      rate: {
        display: clean(rate.display, 120) ?? "Not set",
        currency: clean(rate.currency, 12) ?? null,
        unit: clean(rate.unit, 24) ?? null,
      },
    },
    readiness: {
      cv: readinessState(readiness.cv),
      certificates: readinessState(readiness.certificates),
      references: readinessState(readiness.references),
    },
    pipeline: {
      stage: row.stage ?? "NEW",
      note: row.note,
      updatedAt: row.stateUpdatedAt?.toISOString() ?? null,
    },
    profileUpdatedAt: row.persistedAt.toISOString(),
    privateFieldsIncluded: false,
  };
}

async function activeCandidateRows(
  agencyId: string,
  options: { personId?: string; limit?: number; offset?: number } = {},
) {
  const where = [
    eq(nexusPmPeopleTable.personType, "worker"),
    eq(nexusPmPeopleTable.status, "active"),
    eq(nexusPersonWorkProfilesTable.status, "active"),
  ];
  if (options.personId) {
    where.push(eq(nexusPmPeopleTable.personId, options.personId));
  }

  return db
    .select({
      personId: nexusPmPeopleTable.personId,
      displayName: nexusPmPeopleTable.displayName,
      personRecord: nexusPmPeopleTable.recordJson,
      workProfileRecord: nexusPersonWorkProfilesTable.recordJson,
      persistedAt: nexusPersonWorkProfilesTable.persistedAt,
      stage: nexusPersonAgencyCandidateStatesTable.stage,
      note: nexusPersonAgencyCandidateStatesTable.note,
      stateUpdatedAt: nexusPersonAgencyCandidateStatesTable.updatedAt,
    })
    .from(nexusPersonWorkProfilesTable)
    .innerJoin(
      nexusPmPeopleTable,
      eq(nexusPmPeopleTable.personId, nexusPersonWorkProfilesTable.personId),
    )
    .innerJoin(
      nexusPersonAgencyAccessGrantsTable,
      and(
        eq(
          nexusPersonAgencyAccessGrantsTable.personId,
          nexusPmPeopleTable.personId,
        ),
        eq(nexusPersonAgencyAccessGrantsTable.agencyId, agencyId),
        eq(nexusPersonAgencyAccessGrantsTable.status, "ACTIVE"),
        eq(nexusPersonAgencyAccessGrantsTable.scope, "RECRUITER_SAFE"),
      ),
    )
    .leftJoin(
      nexusPersonAgencyCandidateStatesTable,
      and(
        eq(
          nexusPersonAgencyCandidateStatesTable.personId,
          nexusPmPeopleTable.personId,
        ),
        eq(nexusPersonAgencyCandidateStatesTable.agencyId, agencyId),
      ),
    )
    .where(and(...where))
    .orderBy(desc(nexusPersonWorkProfilesTable.persistedAt))
    .limit(options.limit ?? 100)
    .offset(options.offset ?? 0);
}

async function assertCandidateVisible(
  agencyId: string,
  personId: string,
): Promise<boolean> {
  const rows = await activeCandidateRows(agencyId, {
    personId,
    limit: 2,
    offset: 0,
  });
  return rows.length === 1;
}

async function setCandidateStage(input: {
  agencyId: string;
  personId: string;
  authUserId: string;
  stage: string;
  note?: string;
}) {
  const now = new Date();
  await db
    .insert(nexusPersonAgencyCandidateStatesTable)
    .values({
      agencyId: input.agencyId,
      personId: input.personId,
      stage: input.stage,
      note: input.note,
      updatedByUserId: input.authUserId,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        nexusPersonAgencyCandidateStatesTable.agencyId,
        nexusPersonAgencyCandidateStatesTable.personId,
      ],
      set: {
        stage: input.stage,
        note: input.note,
        updatedByUserId: input.authUserId,
        updatedAt: now,
      },
    });
  return now;
}

router.get("/person-card/agency/_health", async (req, res) => {
  const requiredTables = [
    "nexus_person_agencies",
    "nexus_person_onboarding_invites",
    "nexus_person_work_profiles",
    "nexus_person_work_events",
    "nexus_person_agency_members",
    "nexus_person_agency_recruiter_profiles",
    "nexus_person_agency_access_grants",
    "nexus_person_agency_candidate_states",
    "nexus_person_agency_actions",
  ];

  try {
    const result = await db.execute(sql`
      select
        to_regclass('public.nexus_person_agencies')::text as agencies,
        to_regclass('public.nexus_person_onboarding_invites')::text as invites,
        to_regclass('public.nexus_person_work_profiles')::text as work_profiles,
        to_regclass('public.nexus_person_work_events')::text as work_events,
        to_regclass('public.nexus_person_agency_members')::text as members,
        to_regclass('public.nexus_person_agency_recruiter_profiles')::text as recruiter_profiles,
        to_regclass('public.nexus_person_agency_access_grants')::text as access_grants,
        to_regclass('public.nexus_person_agency_candidate_states')::text as candidate_states,
        to_regclass('public.nexus_person_agency_actions')::text as actions
    `);

    const row = result.rows?.[0] as Record<string, unknown> | undefined;
    const keys = [
      "agencies",
      "invites",
      "work_profiles",
      "work_events",
      "members",
      "recruiter_profiles",
      "access_grants",
      "candidate_states",
      "actions",
    ];
    const missingTables = requiredTables.filter(
      (_table, index) => !row?.[keys[index]!],
    );
    const databaseReady = missingTables.length === 0;

    res.status(databaseReady ? 200 : 503).json({
      schema: "nexus-person-agency-ats-health/v1",
      status: databaseReady ? "ok" : "database-migration-required",
      databaseReady,
      missingTables,
      recruiterSafeProjection: true,
      multiWorkerPersistence: true,
      agencyScopedPipeline: true,
      explicitWorkerConsentGate: true,
      recruiterProfiles: true,
    });
  } catch (error) {
    req.log?.error?.({ err: error }, "Agency ATS DB health check failed");
    res.status(503).json({
      schema: "nexus-person-agency-ats-health/v1",
      status: "database-unavailable",
      databaseReady: false,
      missingTables: requiredTables,
    });
  }
});

router.get("/person-card/agency/account", async (req, res) => {
  const authUserId = requireAuthUserId(req);
  if (!authUserId) {
    res.status(401).json({ error: "NEXUS_AUTH_REQUIRED" });
    return;
  }

  const agency = await loadAgencyContext(authUserId);
  if (!agency) {
    res.status(404).json({
      error: "NEXUS_AGENCY_ACCOUNT_REQUIRED",
      canCreate: true,
    });
    return;
  }

  res.json({
    schema: "nexus-person-agency-account/v1",
    agency: {
      agencyId: agency.agencyId,
      name: agency.agencyName,
      website: agency.website,
      registrationNumber: agency.registrationNumber,
      location: agency.location,
      description: agency.description,
      verificationStatus: agency.verificationStatus,
      role: agency.role,
      status: "ACTIVE",
    },
  });
});

router.post("/person-card/agency/account", async (req, res) => {
  const authUserId = requireAuthUserId(req);
  const authUser = req.user;
  if (!authUserId || !authUser) {
    res.status(401).json({ error: "NEXUS_AUTH_REQUIRED" });
    return;
  }

  const name = clean(req.body?.agencyName, 160);
  if (!name) {
    res.status(400).json({ error: "NEXUS_AGENCY_NAME_REQUIRED" });
    return;
  }

  const existing = await loadAgencyContext(authUserId);
  if (existing) {
    await db
      .update(nexusPersonAgenciesTable)
      .set({ name, updatedAt: new Date() })
      .where(eq(nexusPersonAgenciesTable.agencyId, existing.agencyId));

    res.json({
      schema: "nexus-person-agency-account/v1",
      agency: {
        agencyId: existing.agencyId,
        name,
        role: existing.role,
        status: "ACTIVE",
      },
      created: false,
    });
    return;
  }

  const agencyId = "agency-" + randomUUID();
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx.insert(nexusPersonAgenciesTable).values({
      agencyId,
      name,
      status: "ACTIVE",
      createdByUserId: authUserId,
      createdAt: now,
      updatedAt: now,
    });
    await tx.insert(nexusPersonAgencyMembersTable).values({
      authUserId,
      agencyId,
      role: "OWNER",
      status: "ACTIVE",
      joinedAt: now,
    });
    const authDisplayName =
      [authUser.firstName, authUser.lastName].filter(Boolean).join(" ").trim() ||
      authUser.email ||
      "Recruiter";
    await tx.insert(nexusPersonAgencyRecruiterProfilesTable).values({
      authUserId,
      agencyId,
      displayName: authDisplayName,
      jobTitle: "Recruiter",
      phone: null,
      email: authUser.email ?? null,
      bio: null,
      photoUrl: authUser.profileImageUrl ?? null,
      verificationStatus: "UNVERIFIED",
      updatedAt: now,
    });
  });

  res.status(201).json({
    schema: "nexus-person-agency-account/v1",
    agency: {
      agencyId,
      name,
      role: "OWNER",
      status: "ACTIVE",
    },
    created: true,
  });
});

router.get("/person-card/agency/profile", async (req, res) => {
  const authUserId = requireAuthUserId(req);
  const authUser = req.user;
  if (!authUserId || !authUser) {
    res.status(401).json({ error: "NEXUS_AUTH_REQUIRED" });
    return;
  }
  const agency = await loadAgencyContext(authUserId);
  if (!agency) {
    res.status(404).json({ error: "NEXUS_AGENCY_ACCOUNT_REQUIRED" });
    return;
  }

  const rows = await db
    .select({
      displayName: nexusPersonAgencyRecruiterProfilesTable.displayName,
      jobTitle: nexusPersonAgencyRecruiterProfilesTable.jobTitle,
      phone: nexusPersonAgencyRecruiterProfilesTable.phone,
      email: nexusPersonAgencyRecruiterProfilesTable.email,
      bio: nexusPersonAgencyRecruiterProfilesTable.bio,
      photoUrl: nexusPersonAgencyRecruiterProfilesTable.photoUrl,
      verificationStatus:
        nexusPersonAgencyRecruiterProfilesTable.verificationStatus,
      updatedAt: nexusPersonAgencyRecruiterProfilesTable.updatedAt,
    })
    .from(nexusPersonAgencyRecruiterProfilesTable)
    .where(
      and(
        eq(nexusPersonAgencyRecruiterProfilesTable.authUserId, authUserId),
        eq(nexusPersonAgencyRecruiterProfilesTable.agencyId, agency.agencyId),
      ),
    )
    .limit(2);

  const recruiter = rows[0] ?? {
    displayName:
      [authUser.firstName, authUser.lastName].filter(Boolean).join(" ").trim() ||
      authUser.email ||
      "Recruiter",
    jobTitle: null,
    phone: null,
    email: authUser.email ?? null,
    bio: null,
    photoUrl: authUser.profileImageUrl ?? null,
    verificationStatus: "UNVERIFIED",
    updatedAt: null,
  };

  res.json({
    schema: "nexus-person-agency-profile/v1",
    agency: {
      agencyId: agency.agencyId,
      name: agency.agencyName,
      website: agency.website,
      registrationNumber: agency.registrationNumber,
      location: agency.location,
      description: agency.description,
      verificationStatus: agency.verificationStatus,
      role: agency.role,
    },
    recruiter: {
      ...recruiter,
      profileComplete: Boolean(
        clean(recruiter.displayName, 160) && clean(recruiter.jobTitle, 120),
      ),
    },
  });
});

router.patch("/person-card/agency/profile", async (req, res) => {
  const authUserId = requireAuthUserId(req);
  const authUser = req.user;
  if (!authUserId || !authUser) {
    res.status(401).json({ error: "NEXUS_AUTH_REQUIRED" });
    return;
  }
  const agency = await loadAgencyContext(authUserId);
  if (!agency) {
    res.status(404).json({ error: "NEXUS_AGENCY_ACCOUNT_REQUIRED" });
    return;
  }

  const agencyInput = asRecord(req.body?.agency);
  const recruiterInput = asRecord(req.body?.recruiter);
  const now = new Date();

  if (agency.role === "OWNER" || agency.role === "ADMIN") {
    const agencyName = clean(agencyInput.name, 160);
    await db
      .update(nexusPersonAgenciesTable)
      .set({
        name: agencyName ?? agency.agencyName,
        website: clean(agencyInput.website, 240) ?? null,
        registrationNumber: clean(agencyInput.registrationNumber, 120) ?? null,
        location: clean(agencyInput.location, 180) ?? null,
        description: clean(agencyInput.description, 800) ?? null,
        updatedAt: now,
      })
      .where(eq(nexusPersonAgenciesTable.agencyId, agency.agencyId));
  }

  const displayName =
    clean(recruiterInput.displayName, 160) ??
    ([authUser.firstName, authUser.lastName].filter(Boolean).join(" ").trim() ||
      authUser.email ||
      "Recruiter");

  await db
    .insert(nexusPersonAgencyRecruiterProfilesTable)
    .values({
      authUserId,
      agencyId: agency.agencyId,
      displayName,
      jobTitle: clean(recruiterInput.jobTitle, 120) ?? null,
      phone: clean(recruiterInput.phone, 80) ?? null,
      email: clean(recruiterInput.email, 160) ?? authUser.email ?? null,
      bio: clean(recruiterInput.bio, 800) ?? null,
      photoUrl:
        clean(recruiterInput.photoUrl, 500) ?? authUser.profileImageUrl ?? null,
      verificationStatus: "UNVERIFIED",
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: nexusPersonAgencyRecruiterProfilesTable.authUserId,
      set: {
        agencyId: agency.agencyId,
        displayName,
        jobTitle: clean(recruiterInput.jobTitle, 120) ?? null,
        phone: clean(recruiterInput.phone, 80) ?? null,
        email: clean(recruiterInput.email, 160) ?? authUser.email ?? null,
        bio: clean(recruiterInput.bio, 800) ?? null,
        photoUrl:
          clean(recruiterInput.photoUrl, 500) ??
          authUser.profileImageUrl ??
          null,
        updatedAt: now,
      },
    });

  const refreshed = await loadAgencyContext(authUserId);
  res.json({
    schema: "nexus-person-agency-profile-updated/v1",
    agency: {
      agencyId: refreshed!.agencyId,
      name: refreshed!.agencyName,
      website: refreshed!.website,
      registrationNumber: refreshed!.registrationNumber,
      location: refreshed!.location,
      description: refreshed!.description,
      verificationStatus: refreshed!.verificationStatus,
      role: refreshed!.role,
    },
    recruiter: {
      displayName,
      jobTitle: clean(recruiterInput.jobTitle, 120) ?? null,
      phone: clean(recruiterInput.phone, 80) ?? null,
      email: clean(recruiterInput.email, 160) ?? authUser.email ?? null,
      bio: clean(recruiterInput.bio, 800) ?? null,
      photoUrl:
        clean(recruiterInput.photoUrl, 500) ?? authUser.profileImageUrl ?? null,
      verificationStatus: "UNVERIFIED",
      updatedAt: now.toISOString(),
    },
  });
});

router.get("/person-card/agency/candidates", async (req, res) => {
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

  const limit = Math.max(
    1,
    Math.min(200, Number.parseInt(String(req.query.limit ?? "100"), 10) || 100),
  );
  const offset = Math.max(
    0,
    Number.parseInt(String(req.query.offset ?? "0"), 10) || 0,
  );
  const query = clean(req.query.q, 120)?.toLowerCase();

  const rows = await activeCandidateRows(agency.agencyId, { limit, offset });
  const candidates = rows.map(recruiterSafeCandidate).filter((candidate) => {
    if (!query) return true;
    return [
      candidate.displayName,
      candidate.primaryTrade,
      ...candidate.locations,
      ...candidate.preferences.targetRoles,
    ]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });

  res.json({
    schema: "nexus-person-agency-candidate-list/v1",
    agency: { agencyId: agency.agencyId, name: agency.agencyName },
    candidates,
    count: candidates.length,
    limit,
    offset,
    recruiterSafeProjection: true,
  });
});

router.get("/person-card/agency/candidates/:personId", async (req, res) => {
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

  const personId = clean(req.params.personId, 180);
  if (!personId) {
    res.status(400).json({ error: "NEXUS_PERSON_ID_REQUIRED" });
    return;
  }

  const rows = await activeCandidateRows(agency.agencyId, {
    personId,
    limit: 2,
    offset: 0,
  });
  if (rows.length !== 1) {
    res.status(404).json({ error: "NEXUS_AGENCY_CANDIDATE_NOT_FOUND" });
    return;
  }

  res.json({
    schema: "nexus-person-agency-candidate-detail/v1",
    candidate: recruiterSafeCandidate(rows[0]!),
  });
});

router.patch("/person-card/agency/candidates/:personId", async (req, res) => {
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

  const personId = clean(req.params.personId, 180);
  const stage = clean(req.body?.stage, 40)?.toUpperCase();
  const note = clean(req.body?.note, 500);
  if (!personId || !stage || !PIPELINE_STAGES.has(stage)) {
    res.status(400).json({ error: "NEXUS_AGENCY_PIPELINE_STAGE_INVALID" });
    return;
  }
  if (!(await assertCandidateVisible(agency.agencyId, personId))) {
    res.status(404).json({ error: "NEXUS_AGENCY_CANDIDATE_NOT_FOUND" });
    return;
  }

  const updatedAt = await setCandidateStage({
    agencyId: agency.agencyId,
    personId,
    authUserId,
    stage,
    note,
  });

  res.json({
    schema: "nexus-person-agency-candidate-stage/v1",
    personId,
    stage,
    note: note ?? null,
    updatedAt: updatedAt.toISOString(),
  });
});

router.post(
  "/person-card/agency/candidates/:personId/actions",
  async (req, res) => {
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

    const personId = clean(req.params.personId, 180);
    const actionType = clean(req.body?.actionType, 60)?.toUpperCase();
    if (!personId || !actionType || !ACTION_TYPES.has(actionType)) {
      res.status(400).json({ error: "NEXUS_AGENCY_ACTION_INVALID" });
      return;
    }
    if (!(await assertCandidateVisible(agency.agencyId, personId))) {
      res.status(404).json({ error: "NEXUS_AGENCY_CANDIDATE_NOT_FOUND" });
      return;
    }

    const inputDetails = asRecord(req.body?.details);
    const details: Record<string, string> = {};
    for (const key of [
      "channel",
      "purpose",
      "role",
      "location",
      "rate",
      "duration",
      "start",
      "summary",
    ]) {
      const value = clean(inputDetails[key], 240);
      if (value) details[key] = value;
    }

    const actionId = "agency-action-" + randomUUID();
    const createdAt = new Date();
    await db.insert(nexusPersonAgencyActionsTable).values({
      actionId,
      agencyId: agency.agencyId,
      personId,
      actorUserId: authUserId,
      actionType,
      recordJson: {
        schema: "nexus-person-agency-action/v1",
        ...details,
        privateDocumentsIncluded: false,
      },
      createdAt,
    });

    const nextStage =
      actionType === "SHORTLISTED"
        ? "SHORTLISTED"
        : actionType === "REMOVED_FROM_SHORTLIST"
          ? "NEW"
          : actionType === "CONTACTED"
            ? "CONTACTED"
            : actionType === "REQUEST_PACK_DRAFTED"
              ? "REQUESTED"
              : actionType === "OFFER_DRAFTED"
                ? "OFFERED"
                : null;

    if (nextStage) {
      await setCandidateStage({
        agencyId: agency.agencyId,
        personId,
        authUserId,
        stage: nextStage,
      });
    }

    res.status(201).json({
      schema: "nexus-person-agency-action-created/v1",
      actionId,
      personId,
      actionType,
      nextStage,
      createdAt: createdAt.toISOString(),
      privateDocumentsIncluded: false,
    });
  },
);

router.get("/person-card/agency/activity", async (req, res) => {
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

  const limit = Math.max(
    1,
    Math.min(100, Number.parseInt(String(req.query.limit ?? "50"), 10) || 50),
  );

  const rows = await db
    .select({
      actionId: nexusPersonAgencyActionsTable.actionId,
      personId: nexusPersonAgencyActionsTable.personId,
      displayName: nexusPmPeopleTable.displayName,
      actionType: nexusPersonAgencyActionsTable.actionType,
      recordJson: nexusPersonAgencyActionsTable.recordJson,
      createdAt: nexusPersonAgencyActionsTable.createdAt,
    })
    .from(nexusPersonAgencyActionsTable)
    .innerJoin(
      nexusPmPeopleTable,
      eq(
        nexusPmPeopleTable.personId,
        nexusPersonAgencyActionsTable.personId,
      ),
    )
    .where(eq(nexusPersonAgencyActionsTable.agencyId, agency.agencyId))
    .orderBy(desc(nexusPersonAgencyActionsTable.createdAt))
    .limit(limit);

  res.json({
    schema: "nexus-person-agency-activity/v1",
    agency: { agencyId: agency.agencyId, name: agency.agencyName },
    activity: rows.map((row) => ({
      actionId: row.actionId,
      personId: row.personId,
      displayName: row.displayName,
      actionType: row.actionType,
      details: row.recordJson,
      createdAt: row.createdAt.toISOString(),
    })),
  });
});

export default router;
