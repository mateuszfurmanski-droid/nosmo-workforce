-- NOSMO Person Card Freeware
-- Canonical Person Card / Agency ATS persistence for nosmo-nexus-mvp-dev.
-- Safe target: Neon project nosmo-nexus-mvp-dev / database neondb.
-- Apply only after reviewing the target DATABASE_URL.

CREATE TABLE IF NOT EXISTS nexus_person_agencies (
  agency_id text PRIMARY KEY,
  name text NOT NULL,
  website text,
  registration_number text,
  location text,
  description text,
  verification_status text NOT NULL DEFAULT 'UNVERIFIED',
  status text NOT NULL DEFAULT 'ACTIVE',
  created_by_user_id varchar NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nexus_person_onboarding_invites (
  invite_id text PRIMARY KEY,
  token_digest text NOT NULL,
  agency text NOT NULL,
  agency_id text,
  created_by_user_id varchar REFERENCES users(id) ON DELETE RESTRICT,
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

CREATE TABLE IF NOT EXISTS nexus_person_work_events (
  event_id text PRIMARY KEY,
  person_id text NOT NULL REFERENCES nexus_pm_people(person_id) ON DELETE RESTRICT,
  invite_id text REFERENCES nexus_person_onboarding_invites(invite_id) ON DELETE RESTRICT,
  event_type text NOT NULL,
  actor_type text NOT NULL,
  record_json jsonb NOT NULL,
  persisted_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS nexus_person_agency_members (
  auth_user_id varchar PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  agency_id text NOT NULL REFERENCES nexus_person_agencies(agency_id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'OWNER',
  status text NOT NULL DEFAULT 'ACTIVE',
  joined_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nexus_person_agency_recruiter_profiles (
  auth_user_id varchar PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  agency_id text NOT NULL REFERENCES nexus_person_agencies(agency_id) ON DELETE CASCADE,
  display_name text NOT NULL,
  job_title text,
  phone text,
  email text,
  bio text,
  photo_url text,
  verification_status text NOT NULL DEFAULT 'UNVERIFIED',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nexus_person_agency_access_grants (
  agency_id text NOT NULL REFERENCES nexus_person_agencies(agency_id) ON DELETE CASCADE,
  person_id text NOT NULL REFERENCES nexus_pm_people(person_id) ON DELETE RESTRICT,
  source_invite_id text REFERENCES nexus_person_onboarding_invites(invite_id) ON DELETE RESTRICT,
  scope text NOT NULL DEFAULT 'RECRUITER_SAFE',
  status text NOT NULL DEFAULT 'ACTIVE',
  consent_source text NOT NULL,
  record_json jsonb NOT NULL,
  granted_at timestamptz,
  revoked_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nexus_person_agency_access_grants_pk PRIMARY KEY (agency_id, person_id)
);

CREATE TABLE IF NOT EXISTS nexus_person_agency_candidate_states (
  agency_id text NOT NULL REFERENCES nexus_person_agencies(agency_id) ON DELETE CASCADE,
  person_id text NOT NULL REFERENCES nexus_pm_people(person_id) ON DELETE RESTRICT,
  stage text NOT NULL DEFAULT 'NEW',
  note text,
  updated_by_user_id varchar NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nexus_person_agency_candidate_states_pk PRIMARY KEY (agency_id, person_id)
);

CREATE TABLE IF NOT EXISTS nexus_person_agency_actions (
  action_id text PRIMARY KEY,
  agency_id text NOT NULL REFERENCES nexus_person_agencies(agency_id) ON DELETE CASCADE,
  person_id text NOT NULL REFERENCES nexus_pm_people(person_id) ON DELETE RESTRICT,
  actor_user_id varchar NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  action_type text NOT NULL,
  record_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS nexus_person_agency_actions_id_agency_uq
  ON nexus_person_agency_actions(action_id, agency_id);
