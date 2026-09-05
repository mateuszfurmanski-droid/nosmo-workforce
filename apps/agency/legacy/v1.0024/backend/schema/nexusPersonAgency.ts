import {
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/pg-core";
import { usersTable } from "./auth";
import { nexusPmPeopleTable } from "./nexusPerson";
import { nexusPersonOnboardingInvitesTable } from "./nexusPersonWorkProfile";

export const nexusPersonAgenciesTable = pgTable(
  "nexus_person_agencies",
  {
    agencyId: text("agency_id").primaryKey(),
    name: text("name").notNull(),
    website: text("website"),
    registrationNumber: text("registration_number"),
    location: text("location"),
    description: text("description"),
    verificationStatus: text("verification_status").notNull().default("UNVERIFIED"),
    status: text("status").notNull().default("ACTIVE"),
    createdByUserId: varchar("created_by_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

export const nexusPersonAgencyMembersTable = pgTable(
  "nexus_person_agency_members",
  {
    authUserId: varchar("auth_user_id")
      .primaryKey()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    agencyId: text("agency_id")
      .notNull()
      .references(() => nexusPersonAgenciesTable.agencyId, { onDelete: "cascade" }),
    role: text("role").notNull().default("OWNER"),
    status: text("status").notNull().default("ACTIVE"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

export const nexusPersonAgencyRecruiterProfilesTable = pgTable(
  "nexus_person_agency_recruiter_profiles",
  {
    authUserId: varchar("auth_user_id")
      .primaryKey()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    agencyId: text("agency_id")
      .notNull()
      .references(() => nexusPersonAgenciesTable.agencyId, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    jobTitle: text("job_title"),
    phone: text("phone"),
    email: text("email"),
    bio: text("bio"),
    photoUrl: text("photo_url"),
    verificationStatus: text("verification_status").notNull().default("UNVERIFIED"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

export const nexusPersonAgencyAccessGrantsTable = pgTable(
  "nexus_person_agency_access_grants",
  {
    agencyId: text("agency_id")
      .notNull()
      .references(() => nexusPersonAgenciesTable.agencyId, { onDelete: "cascade" }),
    personId: text("person_id")
      .notNull()
      .references(() => nexusPmPeopleTable.personId, { onDelete: "restrict" }),
    sourceInviteId: text("source_invite_id").references(
      () => nexusPersonOnboardingInvitesTable.inviteId,
      { onDelete: "restrict" },
    ),
    scope: text("scope").notNull().default("RECRUITER_SAFE"),
    status: text("status").notNull().default("ACTIVE"),
    consentSource: text("consent_source").notNull(),
    recordJson: jsonb("record_json").$type<Record<string, unknown>>().notNull(),
    grantedAt: timestamp("granted_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({
      name: "nexus_person_agency_access_grants_pk",
      columns: [table.agencyId, table.personId],
    }),
  ],
);

export const nexusPersonAgencyCandidateStatesTable = pgTable(
  "nexus_person_agency_candidate_states",
  {
    agencyId: text("agency_id")
      .notNull()
      .references(() => nexusPersonAgenciesTable.agencyId, { onDelete: "cascade" }),
    personId: text("person_id")
      .notNull()
      .references(() => nexusPmPeopleTable.personId, { onDelete: "restrict" }),
    stage: text("stage").notNull().default("NEW"),
    note: text("note"),
    updatedByUserId: varchar("updated_by_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({
      name: "nexus_person_agency_candidate_states_pk",
      columns: [table.agencyId, table.personId],
    }),
  ],
);

export const nexusPersonAgencyActionsTable = pgTable(
  "nexus_person_agency_actions",
  {
    actionId: text("action_id").primaryKey(),
    agencyId: text("agency_id")
      .notNull()
      .references(() => nexusPersonAgenciesTable.agencyId, { onDelete: "cascade" }),
    personId: text("person_id")
      .notNull()
      .references(() => nexusPmPeopleTable.personId, { onDelete: "restrict" }),
    actorUserId: varchar("actor_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    actionType: text("action_type").notNull(),
    recordJson: jsonb("record_json").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("nexus_person_agency_actions_id_agency_uq").on(
      table.actionId,
      table.agencyId,
    ),
  ],
);

export type NexusPersonAgencyRow = typeof nexusPersonAgenciesTable.$inferSelect;
export type NexusPersonAgencyMemberRow =
  typeof nexusPersonAgencyMembersTable.$inferSelect;
export type NexusPersonAgencyRecruiterProfileRow =
  typeof nexusPersonAgencyRecruiterProfilesTable.$inferSelect;
export type NexusPersonAgencyAccessGrantRow =
  typeof nexusPersonAgencyAccessGrantsTable.$inferSelect;
export type NexusPersonAgencyCandidateStateRow =
  typeof nexusPersonAgencyCandidateStatesTable.$inferSelect;
export type NexusPersonAgencyActionRow =
  typeof nexusPersonAgencyActionsTable.$inferSelect;
