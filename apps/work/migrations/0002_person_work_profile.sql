CREATE TABLE IF NOT EXISTS nexus_person_onboarding_invites (
  invite_id text PRIMARY KEY,
  token_digest text NOT NULL,
  agency text NOT NULL,
  suggested_trade text,
  suggested_location text,
  message text,
  status text NOT NULL DEFAULT 'ACTIVE',
  expires_at timestamptz NOT NULL,
  claimed_person_id text REFERENCES nexus_pm_people(person_id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS nexus_person_onboarding_invite_token_digest_uq
  ON nexus_person_onboarding_invites(token_digest);

CREATE UNIQUE INDEX IF NOT EXISTS nexus_person_onboarding_invite_claimed_person_uq
  ON nexus_person_onboarding_invites(claimed_person_id);

CREATE TABLE IF NOT EXISTS nexus_person_work_profiles (
  person_id text PRIMARY KEY REFERENCES nexus_pm_people(person_id) ON DELETE RESTRICT,
  schema_version text NOT NULL,
  status text NOT NULL,
  source_invite_id text NOT NULL REFERENCES nexus_person_onboarding_invites(invite_id) ON DELETE RESTRICT,
  record_json jsonb NOT NULL,
  persisted_at timestamptz NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS nexus_person_work_profiles_source_invite_uq
  ON nexus_person_work_profiles(source_invite_id);
