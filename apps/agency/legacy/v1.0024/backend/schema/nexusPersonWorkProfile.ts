import { jsonb, pgTable, text, timestamp, unique, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";
import { nexusPmPeopleTable } from "./nexusPerson";

export const nexusPersonOnboardingInvitesTable = pgTable(
  "nexus_person_onboarding_invites",
  {
    inviteId: text("invite_id").primaryKey(),
    tokenDigest: text("token_digest").notNull(),
    agency: text("agency").notNull(),
    agencyId: text("agency_id"),
    createdByUserId: varchar("created_by_user_id").references(() => usersTable.id, {
      onDelete: "restrict",
    }),
    suggestedTrade: text("suggested_trade"),
    suggestedLocation: text("suggested_location"),
    message: text("message"),
    status: text("status").notNull().default("ACTIVE"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    claimedPersonId: text("claimed_person_id").references(
      () => nexusPmPeopleTable.personId,
      { onDelete: "restrict" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
  },
  (table) => [
    unique("nexus_person_onboarding_invite_token_digest_uq").on(table.tokenDigest),
    unique("nexus_person_onboarding_invite_claimed_person_uq").on(
      table.claimedPersonId,
    ),
  ],
);

export const nexusPersonWorkProfilesTable = pgTable(
  "nexus_person_work_profiles",
  {
    personId: text("person_id")
      .primaryKey()
      .references(() => nexusPmPeopleTable.personId, { onDelete: "restrict" }),
    schemaVersion: text("schema_version").notNull(),
    status: text("status").notNull(),
    sourceInviteId: text("source_invite_id")
      .notNull()
      .references(() => nexusPersonOnboardingInvitesTable.inviteId, {
        onDelete: "restrict",
      }),
    recordJson: jsonb("record_json").$type<Record<string, unknown>>().notNull(),
    persistedAt: timestamp("persisted_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    unique("nexus_person_work_profiles_source_invite_uq").on(table.sourceInviteId),
  ],
);

export const nexusPersonWorkEventsTable = pgTable("nexus_person_work_events", {
  eventId: text("event_id").primaryKey(),
  personId: text("person_id")
    .notNull()
    .references(() => nexusPmPeopleTable.personId, { onDelete: "restrict" }),
  inviteId: text("invite_id").references(
    () => nexusPersonOnboardingInvitesTable.inviteId,
    { onDelete: "restrict" },
  ),
  eventType: text("event_type").notNull(),
  actorType: text("actor_type").notNull(),
  recordJson: jsonb("record_json").$type<Record<string, unknown>>().notNull(),
  persistedAt: timestamp("persisted_at", { withTimezone: true }).notNull(),
});

export type NexusPersonWorkEventRow =
  typeof nexusPersonWorkEventsTable.$inferSelect;

export type NexusPersonOnboardingInviteRow =
  typeof nexusPersonOnboardingInvitesTable.$inferSelect;
export type NexusPersonWorkProfileRow =
  typeof nexusPersonWorkProfilesTable.$inferSelect;
