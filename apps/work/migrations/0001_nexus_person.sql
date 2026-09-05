CREATE TABLE IF NOT EXISTS nexus_pm_people (
  person_id text PRIMARY KEY,
  display_name text NOT NULL,
  person_type text NOT NULL,
  status text NOT NULL,
  record_json jsonb NOT NULL,
  persisted_at timestamptz NOT NULL
);
