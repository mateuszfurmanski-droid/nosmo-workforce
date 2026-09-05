CREATE TABLE IF NOT EXISTS nexus_person_work_events (
  event_id text PRIMARY KEY,
  person_id text NOT NULL REFERENCES nexus_pm_people(person_id) ON DELETE RESTRICT,
  invite_id text REFERENCES nexus_person_onboarding_invites(invite_id) ON DELETE RESTRICT,
  event_type text NOT NULL,
  actor_type text NOT NULL,
  record_json jsonb NOT NULL,
  persisted_at timestamptz NOT NULL
);
