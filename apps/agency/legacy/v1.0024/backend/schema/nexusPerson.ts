import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Canonical NOSMO Person authority reused by Person Card Freeware and future Nexus integration.
 * This is the same nexus_pm_people table contract used by the Nexus Person persistence line,
 * extracted without Project/World identity claims.
 */
export const nexusPmPeopleTable = pgTable("nexus_pm_people", {
  personId: text("person_id").primaryKey(),
  displayName: text("display_name").notNull(),
  personType: text("person_type").notNull(),
  status: text("status").notNull(),
  recordJson: jsonb("record_json").$type<Record<string, unknown>>().notNull(),
  persistedAt: timestamp("persisted_at", { withTimezone: true }).notNull(),
});

export type NexusPmPersonRow = typeof nexusPmPeopleTable.$inferSelect;
