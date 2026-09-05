-- NOSMO Agency V1 roster, requests, applications, pipeline and placements.
-- Additive migration over 001-person-card-agency-persistence.sql.
-- Mirrors the activated nosmo-nexus-mvp-dev Agency V1 schema.

CREATE TABLE IF NOT EXISTS nexus_person_agency_roster_workers (
  roster_worker_id text PRIMARY KEY,
  agency_id text NOT NULL REFERENCES nexus_person_agencies(agency_id) ON DELETE CASCADE,
  display_name text NOT NULL,
  normalized_email text,
  normalized_phone text,
  name_location_key text NOT NULL,
  record_json jsonb NOT NULL,
  private_note text,
  connection_status text NOT NULL DEFAULT 'IMPORTED',
  invitation_sent_at timestamptz,
  invitation_expires_at timestamptz,
  status text NOT NULL DEFAULT 'ACTIVE',
  created_by_user_id varchar NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  updated_by_user_id varchar NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nexus_person_agency_roster_connection_status_ck
    CHECK (connection_status IN ('IMPORTED','INVITED','DECLINED')),
  CONSTRAINT nexus_person_agency_roster_status_ck
    CHECK (status IN ('ACTIVE','ARCHIVED'))
);

CREATE UNIQUE INDEX IF NOT EXISTS nexus_person_agency_roster_worker_agency_uq
  ON nexus_person_agency_roster_workers (roster_worker_id, agency_id);
CREATE UNIQUE INDEX IF NOT EXISTS nexus_person_agency_roster_email_uq
  ON nexus_person_agency_roster_workers (agency_id, normalized_email)
  WHERE normalized_email IS NOT NULL AND status = 'ACTIVE';
CREATE UNIQUE INDEX IF NOT EXISTS nexus_person_agency_roster_phone_uq
  ON nexus_person_agency_roster_workers (agency_id, normalized_phone)
  WHERE normalized_phone IS NOT NULL AND status = 'ACTIVE';
CREATE UNIQUE INDEX IF NOT EXISTS nexus_person_agency_roster_name_location_uq
  ON nexus_person_agency_roster_workers (agency_id, name_location_key)
  WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS nexus_person_agency_roster_agency_updated_idx
  ON nexus_person_agency_roster_workers (agency_id, updated_at DESC);

ALTER TABLE nexus_person_onboarding_invites
  ADD COLUMN IF NOT EXISTS roster_worker_id text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'nexus_person_onboarding_invites_roster_worker_id_fkey'
      AND conrelid = 'nexus_person_onboarding_invites'::regclass
  ) THEN
    ALTER TABLE nexus_person_onboarding_invites
      ADD CONSTRAINT nexus_person_onboarding_invites_roster_worker_id_fkey
      FOREIGN KEY (roster_worker_id)
      REFERENCES nexus_person_agency_roster_workers(roster_worker_id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS nexus_person_agency_roster_events (
  event_id text PRIMARY KEY,
  agency_id text NOT NULL REFERENCES nexus_person_agencies(agency_id) ON DELETE CASCADE,
  roster_worker_id text NOT NULL REFERENCES nexus_person_agency_roster_workers(roster_worker_id) ON DELETE CASCADE,
  actor_user_id varchar NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  event_type text NOT NULL,
  record_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS nexus_person_agency_roster_events_worker_idx
  ON nexus_person_agency_roster_events (agency_id, roster_worker_id, created_at DESC);

CREATE TABLE IF NOT EXISTS nexus_person_agency_requests (
  request_id text PRIMARY KEY,
  agency_id text NOT NULL REFERENCES nexus_person_agencies(agency_id) ON DELETE CASCADE,
  role text NOT NULL,
  client_name text NOT NULL,
  location text NOT NULL,
  status text NOT NULL DEFAULT 'DRAFT',
  headcount integer NOT NULL DEFAULT 1,
  record_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id varchar NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  updated_by_user_id varchar NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nexus_person_agency_requests_status_ck
    CHECK (status IN ('DRAFT','OPEN','PAUSED','FILLED','CANCELLED')),
  CONSTRAINT nexus_person_agency_requests_headcount_ck
    CHECK (headcount >= 1 AND headcount <= 10000)
);

CREATE UNIQUE INDEX IF NOT EXISTS nexus_person_agency_requests_id_agency_uq
  ON nexus_person_agency_requests (request_id, agency_id);
CREATE INDEX IF NOT EXISTS nexus_person_agency_requests_agency_status_idx
  ON nexus_person_agency_requests (agency_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS nexus_person_agency_applications (
  application_id text PRIMARY KEY,
  agency_id text NOT NULL REFERENCES nexus_person_agencies(agency_id) ON DELETE CASCADE,
  request_id text NOT NULL,
  person_id text REFERENCES nexus_pm_people(person_id) ON DELETE RESTRICT,
  roster_worker_id text,
  stage text NOT NULL DEFAULT 'NEW',
  readiness_status text NOT NULL DEFAULT 'CHECK',
  owner_user_id varchar NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  next_action text,
  last_contact_at timestamptz,
  record_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nexus_person_agency_applications_candidate_ck
    CHECK (num_nonnulls(person_id, roster_worker_id) = 1),
  CONSTRAINT nexus_person_agency_applications_stage_ck
    CHECK (stage IN ('NEW','SHORTLISTED','CONTACTED','INTERESTED','SUBMITTED','INTERVIEW','OFFERED','PLACED','REJECTED','WITHDRAWN')),
  CONSTRAINT nexus_person_agency_applications_readiness_ck
    CHECK (readiness_status IN ('READY','CHECK','BLOCKED')),
  CONSTRAINT nexus_person_agency_applications_request_fk
    FOREIGN KEY (request_id, agency_id)
    REFERENCES nexus_person_agency_requests(request_id, agency_id)
    ON DELETE CASCADE,
  CONSTRAINT nexus_person_agency_applications_roster_fk
    FOREIGN KEY (roster_worker_id, agency_id)
    REFERENCES nexus_person_agency_roster_workers(roster_worker_id, agency_id)
    ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS nexus_person_agency_applications_id_agency_uq
  ON nexus_person_agency_applications (application_id, agency_id);
CREATE UNIQUE INDEX IF NOT EXISTS nexus_person_agency_applications_person_uq
  ON nexus_person_agency_applications (agency_id, request_id, person_id)
  WHERE person_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS nexus_person_agency_applications_roster_uq
  ON nexus_person_agency_applications (agency_id, request_id, roster_worker_id)
  WHERE roster_worker_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS nexus_person_agency_applications_pipeline_idx
  ON nexus_person_agency_applications (agency_id, request_id, stage, updated_at DESC);

CREATE TABLE IF NOT EXISTS nexus_person_agency_placements (
  placement_id text PRIMARY KEY,
  agency_id text NOT NULL REFERENCES nexus_person_agencies(agency_id) ON DELETE CASCADE,
  request_id text NOT NULL,
  application_id text NOT NULL,
  status text NOT NULL DEFAULT 'PLACED',
  start_date date,
  end_date date,
  currency text NOT NULL DEFAULT 'GBP',
  rate_unit text,
  pay_rate_amount numeric,
  bill_rate_amount numeric,
  record_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id varchar NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  updated_by_user_id varchar NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nexus_person_agency_placements_status_ck
    CHECK (status IN ('PLACED','STARTED','COMPLETED','CANCELLED')),
  CONSTRAINT nexus_person_agency_placements_rate_unit_ck
    CHECK (rate_unit IS NULL OR rate_unit IN ('HOURLY','DAILY','WEEKLY','FIXED')),
  CONSTRAINT nexus_person_agency_placements_pay_rate_ck
    CHECK (pay_rate_amount IS NULL OR pay_rate_amount >= 0),
  CONSTRAINT nexus_person_agency_placements_bill_rate_ck
    CHECK (bill_rate_amount IS NULL OR bill_rate_amount >= 0),
  CONSTRAINT nexus_person_agency_placements_dates_ck
    CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date),
  CONSTRAINT nexus_person_agency_placements_request_fk
    FOREIGN KEY (request_id, agency_id)
    REFERENCES nexus_person_agency_requests(request_id, agency_id)
    ON DELETE CASCADE,
  CONSTRAINT nexus_person_agency_placements_application_fk
    FOREIGN KEY (application_id, agency_id)
    REFERENCES nexus_person_agency_applications(application_id, agency_id)
    ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS nexus_person_agency_placements_id_agency_uq
  ON nexus_person_agency_placements (placement_id, agency_id);
CREATE UNIQUE INDEX IF NOT EXISTS nexus_person_agency_placements_application_uq
  ON nexus_person_agency_placements (agency_id, application_id);
CREATE INDEX IF NOT EXISTS nexus_person_agency_placements_status_idx
  ON nexus_person_agency_placements (agency_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS nexus_person_agency_pipeline_events (
  event_id text PRIMARY KEY,
  agency_id text NOT NULL REFERENCES nexus_person_agencies(agency_id) ON DELETE CASCADE,
  request_id text,
  application_id text,
  placement_id text,
  actor_user_id varchar NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  event_type text NOT NULL,
  record_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nexus_person_agency_pipeline_events_subject_ck
    CHECK (num_nonnulls(request_id, application_id, placement_id) >= 1),
  CONSTRAINT nexus_person_agency_pipeline_events_request_fk
    FOREIGN KEY (request_id, agency_id)
    REFERENCES nexus_person_agency_requests(request_id, agency_id)
    ON DELETE CASCADE,
  CONSTRAINT nexus_person_agency_pipeline_events_application_fk
    FOREIGN KEY (application_id, agency_id)
    REFERENCES nexus_person_agency_applications(application_id, agency_id)
    ON DELETE CASCADE,
  CONSTRAINT nexus_person_agency_pipeline_events_placement_fk
    FOREIGN KEY (placement_id, agency_id)
    REFERENCES nexus_person_agency_placements(placement_id, agency_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS nexus_person_agency_pipeline_events_agency_idx
  ON nexus_person_agency_pipeline_events (agency_id, created_at DESC);
CREATE INDEX IF NOT EXISTS nexus_person_agency_pipeline_events_request_idx
  ON nexus_person_agency_pipeline_events (agency_id, request_id, created_at DESC);
