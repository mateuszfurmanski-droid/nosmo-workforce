import { randomUUID } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import {
  db,
  nexusPersonAgencyAccessGrantsTable,
  nexusPersonOnboardingInvitesTable,
  nexusPersonWorkEventsTable,
  nexusPersonWorkProfilesTable,
  nexusPmPeopleTable,
} from "@workspace/db";

export class NexusPersonWorkProfilePersistenceError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message = code,
  ) {
    super(message);
    this.name = "NexusPersonWorkProfilePersistenceError";
  }
}

export type PersistOnboardingInviteInput = {
  inviteId: string;
  tokenDigest: string;
  agency: string;
  agencyId?: string;
  createdByUserId?: string;
  suggestedTrade?: string;
  suggestedLocation?: string;
  message?: string;
  expiresAt: Date;
  createdAt: Date;
};

export async function persistNexusOnboardingInvite(
  input: PersistOnboardingInviteInput,
): Promise<void> {
  try {
    await db.insert(nexusPersonOnboardingInvitesTable).values({
      inviteId: input.inviteId,
      tokenDigest: input.tokenDigest,
      agency: input.agency,
      agencyId: input.agencyId,
      createdByUserId: input.createdByUserId,
      suggestedTrade: input.suggestedTrade,
      suggestedLocation: input.suggestedLocation,
      message: input.message,
      status: "ACTIVE",
      expiresAt: input.expiresAt,
      createdAt: input.createdAt,
    });
  } catch (error) {
    throw new NexusPersonWorkProfilePersistenceError(
      "NEXUS_ONBOARDING_INVITE_PERSIST_FAILED",
      503,
      error instanceof Error ? error.message : "Invite persistence failed",
    );
  }
}

export type ClaimOnboardingInviteInput = {
  inviteId: string;
  tokenDigest: string;
  personId: string;
  now: Date;
  stubPersonRecord: Record<string, unknown>;
  stubWorkProfileRecord: Record<string, unknown>;
};

export async function claimNexusOnboardingInvite(
  input: ClaimOnboardingInviteInput,
): Promise<{
  personId: string;
  agency: string;
  agencyId: string | null;
  createdByUserId: string | null;
  expiresAt: Date;
}> {
  try {
    return await db.transaction(async (tx) => {
      await tx.insert(nexusPmPeopleTable).values({
        personId: input.personId,
        displayName: "Person Card Draft",
        personType: "worker",
        status: "draft",
        recordJson: input.stubPersonRecord,
        persistedAt: input.now,
      });

      const claimed = await tx
        .update(nexusPersonOnboardingInvitesTable)
        .set({
          status: "CLAIMED",
          claimedPersonId: input.personId,
          claimedAt: input.now,
        })
        .where(
          and(
            eq(nexusPersonOnboardingInvitesTable.inviteId, input.inviteId),
            eq(nexusPersonOnboardingInvitesTable.tokenDigest, input.tokenDigest),
            eq(nexusPersonOnboardingInvitesTable.status, "ACTIVE"),
            isNull(nexusPersonOnboardingInvitesTable.claimedPersonId),
            gt(nexusPersonOnboardingInvitesTable.expiresAt, input.now),
          ),
        )
        .returning({
          inviteId: nexusPersonOnboardingInvitesTable.inviteId,
          agency: nexusPersonOnboardingInvitesTable.agency,
          agencyId: nexusPersonOnboardingInvitesTable.agencyId,
          createdByUserId: nexusPersonOnboardingInvitesTable.createdByUserId,
          expiresAt: nexusPersonOnboardingInvitesTable.expiresAt,
        });

      if (claimed.length !== 1) {
        throw new NexusPersonWorkProfilePersistenceError(
          "NEXUS_ONBOARDING_INVITE_NOT_CLAIMABLE",
          409,
        );
      }

      await tx.insert(nexusPersonWorkProfilesTable).values({
        personId: input.personId,
        schemaVersion: "nexus-person-work-profile/v1",
        status: "draft",
        sourceInviteId: input.inviteId,
        recordJson: input.stubWorkProfileRecord,
        persistedAt: input.now,
      });

      await tx.insert(nexusPersonWorkEventsTable).values({
        eventId: `person-work-event-${randomUUID()}`,
        personId: input.personId,
        inviteId: input.inviteId,
        eventType: "PERSON_ONBOARDING_CLAIMED",
        actorType: "worker",
        recordJson: {
          schema: "nexus-person-work-event/v1",
          inviteId: input.inviteId,
          status: "draft",
          secretsPersisted: false,
        },
        persistedAt: input.now,
      });

      return {
        personId: input.personId,
        agency: claimed[0]!.agency,
        agencyId: claimed[0]!.agencyId,
        createdByUserId: claimed[0]!.createdByUserId,
        expiresAt: claimed[0]!.expiresAt,
      };
    });
  } catch (error) {
    if (error instanceof NexusPersonWorkProfilePersistenceError) throw error;
    throw new NexusPersonWorkProfilePersistenceError(
      "NEXUS_ONBOARDING_CLAIM_PERSIST_FAILED",
      503,
      error instanceof Error ? error.message : "Invite claim failed",
    );
  }
}

export type SavePersonWorkProfileInput = {
  inviteId: string;
  personId: string;
  now: Date;
  displayName: string;
  personStatus: "draft" | "active";
  personRecord: Record<string, unknown>;
  workProfileStatus: "draft" | "active";
  workProfileRecord: Record<string, unknown>;
  shareWithInvitingAgency: boolean;
};

export async function saveNexusPersonWorkProfile(
  input: SavePersonWorkProfileInput,
): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      const invite = await tx
        .select({
          inviteId: nexusPersonOnboardingInvitesTable.inviteId,
          status: nexusPersonOnboardingInvitesTable.status,
          claimedPersonId: nexusPersonOnboardingInvitesTable.claimedPersonId,
          agencyId: nexusPersonOnboardingInvitesTable.agencyId,
          createdByUserId: nexusPersonOnboardingInvitesTable.createdByUserId,
        })
        .from(nexusPersonOnboardingInvitesTable)
        .where(
          and(
            eq(nexusPersonOnboardingInvitesTable.inviteId, input.inviteId),
            eq(
              nexusPersonOnboardingInvitesTable.claimedPersonId,
              input.personId,
            ),
            eq(nexusPersonOnboardingInvitesTable.status, "CLAIMED"),
          ),
        )
        .limit(2);

      if (invite.length !== 1) {
        throw new NexusPersonWorkProfilePersistenceError(
          "NEXUS_ONBOARDING_DRAFT_AUTHORITY_INVALID",
          403,
        );
      }

      const people = await tx
        .update(nexusPmPeopleTable)
        .set({
          displayName: input.displayName,
          personType: "worker",
          status: input.personStatus,
          recordJson: input.personRecord,
          persistedAt: input.now,
        })
        .where(eq(nexusPmPeopleTable.personId, input.personId))
        .returning({ personId: nexusPmPeopleTable.personId });

      if (people.length !== 1) {
        throw new NexusPersonWorkProfilePersistenceError(
          "NEXUS_ONBOARDING_PERSON_NOT_FOUND",
          404,
        );
      }

      const profiles = await tx
        .update(nexusPersonWorkProfilesTable)
        .set({
          schemaVersion: "nexus-person-work-profile/v1",
          status: input.workProfileStatus,
          recordJson: input.workProfileRecord,
          persistedAt: input.now,
        })
        .where(
          and(
            eq(nexusPersonWorkProfilesTable.personId, input.personId),
            eq(nexusPersonWorkProfilesTable.sourceInviteId, input.inviteId),
          ),
        )
        .returning({ personId: nexusPersonWorkProfilesTable.personId });

      if (profiles.length !== 1) {
        throw new NexusPersonWorkProfilePersistenceError(
          "NEXUS_ONBOARDING_WORK_PROFILE_NOT_FOUND",
          404,
        );
      }

      const agencyId = invite[0]!.agencyId;
      if (input.workProfileStatus === "active" && agencyId) {
        if (input.shareWithInvitingAgency) {
          await tx
            .insert(nexusPersonAgencyAccessGrantsTable)
            .values({
              agencyId,
              personId: input.personId,
              sourceInviteId: input.inviteId,
              scope: "RECRUITER_SAFE",
              status: "ACTIVE",
              consentSource: "WORKER_INVITE_ONBOARDING",
              recordJson: {
                schema: "nexus-person-agency-access-grant/v1",
                consent: "explicit",
                scope: "RECRUITER_SAFE",
                sourceInviteId: input.inviteId,
                invitedByUserId: invite[0]!.createdByUserId ?? null,
                privateDocumentsIncluded: false,
                contactDetailsIncluded: false,
                cvTextIncluded: false,
              },
              grantedAt: input.now,
              revokedAt: null,
              updatedAt: input.now,
            })
            .onConflictDoUpdate({
              target: [
                nexusPersonAgencyAccessGrantsTable.agencyId,
                nexusPersonAgencyAccessGrantsTable.personId,
              ],
              set: {
                sourceInviteId: input.inviteId,
                scope: "RECRUITER_SAFE",
                status: "ACTIVE",
                consentSource: "WORKER_INVITE_ONBOARDING",
                recordJson: {
                  schema: "nexus-person-agency-access-grant/v1",
                  consent: "explicit",
                  scope: "RECRUITER_SAFE",
                  sourceInviteId: input.inviteId,
                  invitedByUserId: invite[0]!.createdByUserId ?? null,
                  privateDocumentsIncluded: false,
                  contactDetailsIncluded: false,
                  cvTextIncluded: false,
                },
                grantedAt: input.now,
                revokedAt: null,
                updatedAt: input.now,
              },
            });
        } else {
          await tx
            .update(nexusPersonAgencyAccessGrantsTable)
            .set({
              status: "REVOKED",
              revokedAt: input.now,
              updatedAt: input.now,
            })
            .where(
              and(
                eq(nexusPersonAgencyAccessGrantsTable.agencyId, agencyId),
                eq(nexusPersonAgencyAccessGrantsTable.personId, input.personId),
              ),
            );
        }
      }

      await tx.insert(nexusPersonWorkEventsTable).values({
        eventId: `person-work-event-${randomUUID()}`,
        personId: input.personId,
        inviteId: input.inviteId,
        eventType:
          input.workProfileStatus === "active"
            ? "PERSON_WORK_PROFILE_FINALIZED"
            : "PERSON_WORK_PROFILE_DRAFT_SAVED",
        actorType: "worker",
        recordJson: {
          schema: "nexus-person-work-event/v1",
          inviteId: input.inviteId,
          personStatus: input.personStatus,
          workProfileStatus: input.workProfileStatus,
          shareWithInvitingAgency:
            input.workProfileStatus === "active"
              ? input.shareWithInvitingAgency
              : null,
          agencyAccessScope:
            input.workProfileStatus === "active" &&
            input.shareWithInvitingAgency &&
            agencyId
              ? "RECRUITER_SAFE"
              : "NONE",
          secretsPersisted: false,
        },
        persistedAt: input.now,
      });
    });
  } catch (error) {
    if (error instanceof NexusPersonWorkProfilePersistenceError) throw error;
    throw new NexusPersonWorkProfilePersistenceError(
      "NEXUS_ONBOARDING_DRAFT_SAVE_FAILED",
      503,
      error instanceof Error ? error.message : "Draft save failed",
    );
  }
}

export async function loadNexusPersonWorkProfile(input: {
  inviteId: string;
  personId: string;
}): Promise<{
  person: Record<string, unknown>;
  workProfile: Record<string, unknown>;
  personStatus: string;
  workProfileStatus: string;
  persistedAt: Date;
}> {
  try {
    const rows = await db
      .select({
        personId: nexusPmPeopleTable.personId,
        personRecord: nexusPmPeopleTable.recordJson,
        personStatus: nexusPmPeopleTable.status,
        workProfileRecord: nexusPersonWorkProfilesTable.recordJson,
        workProfileStatus: nexusPersonWorkProfilesTable.status,
        persistedAt: nexusPersonWorkProfilesTable.persistedAt,
      })
      .from(nexusPersonWorkProfilesTable)
      .innerJoin(
        nexusPmPeopleTable,
        eq(nexusPmPeopleTable.personId, nexusPersonWorkProfilesTable.personId),
      )
      .innerJoin(
        nexusPersonOnboardingInvitesTable,
        eq(
          nexusPersonOnboardingInvitesTable.inviteId,
          nexusPersonWorkProfilesTable.sourceInviteId,
        ),
      )
      .where(
        and(
          eq(nexusPmPeopleTable.personId, input.personId),
          eq(nexusPersonWorkProfilesTable.sourceInviteId, input.inviteId),
          eq(
            nexusPersonOnboardingInvitesTable.claimedPersonId,
            input.personId,
          ),
          eq(nexusPersonOnboardingInvitesTable.status, "CLAIMED"),
        ),
      )
      .limit(2);

    if (rows.length !== 1) {
      throw new NexusPersonWorkProfilePersistenceError(
        "NEXUS_ONBOARDING_DRAFT_NOT_FOUND",
        404,
      );
    }

    return {
      person: rows[0]!.personRecord,
      workProfile: rows[0]!.workProfileRecord,
      personStatus: rows[0]!.personStatus,
      workProfileStatus: rows[0]!.workProfileStatus,
      persistedAt: rows[0]!.persistedAt,
    };
  } catch (error) {
    if (error instanceof NexusPersonWorkProfilePersistenceError) throw error;
    throw new NexusPersonWorkProfilePersistenceError(
      "NEXUS_ONBOARDING_DRAFT_LOAD_FAILED",
      503,
      error instanceof Error ? error.message : "Draft load failed",
    );
  }
}
