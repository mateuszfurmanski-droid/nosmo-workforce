-- Isolated CI fixture for the Agency Desk browser -> API -> Postgres story.
-- The GitHub Actions Postgres service is disposable; this never targets Neon or production.
\set ON_ERROR_STOP on

CREATE TABLE users (
  id varchar PRIMARY KEY,
  email varchar UNIQUE,
  first_name varchar,
  last_name varchar,
  profile_image_url varchar,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  sid varchar PRIMARY KEY,
  sess jsonb NOT NULL,
  expire timestamp NOT NULL
);

CREATE INDEX "IDX_session_expire" ON sessions(expire);

CREATE TABLE nexus_pm_people (
  person_id text PRIMARY KEY,
  display_name text NOT NULL,
  person_type text NOT NULL,
  status text NOT NULL,
  record_json jsonb NOT NULL,
  persisted_at timestamptz NOT NULL
);

\ir ../../../artifacts/api-server/src/person-card-freeware/sql/001-person-card-agency-persistence.sql

INSERT INTO users (id, email, first_name, last_name)
VALUES (
  'nosmo-ui-e2e-recruiter',
  'recruiter@nosmo-e2e.invalid',
  'E2E',
  'Recruiter'
);

INSERT INTO sessions (sid, sess, expire)
VALUES (
  'nosmo-ui-e2e-session',
  '{
    "user": {
      "id": "nosmo-ui-e2e-recruiter",
      "email": "recruiter@nosmo-e2e.invalid",
      "firstName": "E2E",
      "lastName": "Recruiter",
      "profileImageUrl": null
    },
    "access_token": "nosmo-ui-e2e-token"
  }'::jsonb,
  now() + interval '1 hour'
);

INSERT INTO nexus_person_agencies (
  agency_id,
  name,
  location,
  status,
  verification_status,
  created_by_user_id
)
VALUES (
  'nosmo-ui-e2e-agency',
  'NorthBuild E2E Agency',
  'Leeds',
  'ACTIVE',
  'UNVERIFIED',
  'nosmo-ui-e2e-recruiter'
);

INSERT INTO nexus_person_agency_members (
  auth_user_id,
  agency_id,
  role,
  status
)
VALUES (
  'nosmo-ui-e2e-recruiter',
  'nosmo-ui-e2e-agency',
  'OWNER',
  'ACTIVE'
);

INSERT INTO nexus_person_agency_recruiter_profiles (
  auth_user_id,
  agency_id,
  display_name,
  job_title,
  email,
  verification_status
)
VALUES (
  'nosmo-ui-e2e-recruiter',
  'nosmo-ui-e2e-agency',
  'E2E Recruiter',
  'Recruiter',
  'recruiter@nosmo-e2e.invalid',
  'UNVERIFIED'
);

INSERT INTO nexus_person_onboarding_invites (
  invite_id,
  token_digest,
  agency,
  agency_id,
  created_by_user_id,
  status,
  expires_at
)
VALUES
  (
    'nosmo-ui-e2e-invite-alice',
    'nosmo-ui-e2e-digest-alice',
    'NorthBuild E2E Agency',
    'nosmo-ui-e2e-agency',
    'nosmo-ui-e2e-recruiter',
    'CLAIMED',
    now() + interval '1 day'
  ),
  (
    'nosmo-ui-e2e-invite-charlie',
    'nosmo-ui-e2e-digest-charlie',
    'NorthBuild E2E Agency',
    'nosmo-ui-e2e-agency',
    'nosmo-ui-e2e-recruiter',
    'CLAIMED',
    now() + interval '1 day'
  ),
  (
    'nosmo-ui-e2e-invite-bob',
    'nosmo-ui-e2e-digest-bob',
    'NorthBuild E2E Agency',
    'nosmo-ui-e2e-agency',
    'nosmo-ui-e2e-recruiter',
    'CLAIMED',
    now() + interval '1 day'
  );

INSERT INTO nexus_pm_people (
  person_id,
  display_name,
  person_type,
  status,
  record_json,
  persisted_at
)
VALUES
  (
    'nosmo-ui-e2e-worker-alice',
    'Alice Joiner',
    'worker',
    'active',
    '{
      "primaryRole": "Joiner",
      "location": "Leeds",
      "experienceYears": 8,
      "verification": "verified",
      "phone": "07000000001",
      "email": "alice-private@nosmo-e2e.invalid",
      "cvText": "PRIVATE_ALICE_CV_MUST_NOT_LEAK"
    }'::jsonb,
    now() - interval '2 minutes'
  ),
  (
    'nosmo-ui-e2e-worker-charlie',
    'Charlie Electrician',
    'worker',
    'active',
    '{
      "primaryRole": "Electrician",
      "location": "Bradford",
      "experienceYears": 6,
      "verification": "verified",
      "phone": "07000000002",
      "email": "charlie-private@nosmo-e2e.invalid",
      "cvText": "PRIVATE_CHARLIE_CV_MUST_NOT_LEAK"
    }'::jsonb,
    now() - interval '1 minute'
  ),
  (
    'nosmo-ui-e2e-worker-bob',
    'Bob Revoked',
    'worker',
    'active',
    '{
      "primaryRole": "Painter",
      "location": "York",
      "experienceYears": 4,
      "verification": "verified",
      "phone": "07000000003",
      "email": "bob-private@nosmo-e2e.invalid",
      "cvText": "PRIVATE_BOB_CV_MUST_NOT_LEAK"
    }'::jsonb,
    now()
  );

INSERT INTO nexus_person_work_profiles (
  person_id,
  schema_version,
  status,
  source_invite_id,
  record_json,
  persisted_at
)
VALUES
  (
    'nosmo-ui-e2e-worker-alice',
    'nexus-person-work-profile/v1',
    'active',
    'nosmo-ui-e2e-invite-alice',
    '{
      "availability": {
        "status": "AVAILABLE_NOW",
        "label": "Available now",
        "workAway": true,
        "ownTransport": true,
        "shifts": ["Days"]
      },
      "preferences": {
        "primaryTrade": "Joiner",
        "locations": ["Leeds"],
        "targetRoles": ["Site Joiner"],
        "employmentTypes": ["CIS"],
        "rate": {"display": "GBP 25/hour", "currency": "GBP", "unit": "hour"}
      },
      "readiness": {
        "cv": {"state": "ready"},
        "certificates": {"state": "verified"},
        "references": {"state": "ready"}
      },
      "privateDocuments": ["PRIVATE_ALICE_DOCUMENT"]
    }'::jsonb,
    now() - interval '2 minutes'
  ),
  (
    'nosmo-ui-e2e-worker-charlie',
    'nexus-person-work-profile/v1',
    'active',
    'nosmo-ui-e2e-invite-charlie',
    '{
      "availability": {
        "status": "AVAILABLE_SOON",
        "label": "Available in 1 week",
        "workAway": false,
        "ownTransport": true,
        "shifts": ["Days", "Nights"]
      },
      "preferences": {
        "primaryTrade": "Electrician",
        "locations": ["Bradford", "Leeds"],
        "targetRoles": ["Electrician"],
        "employmentTypes": ["PAYE", "CIS"],
        "rate": {"display": "GBP 27/hour", "currency": "GBP", "unit": "hour"}
      },
      "readiness": {
        "cv": {"state": "ready"},
        "certificates": {"state": "verified"},
        "references": {"state": "ready"}
      },
      "privateDocuments": ["PRIVATE_CHARLIE_DOCUMENT"]
    }'::jsonb,
    now() - interval '1 minute'
  ),
  (
    'nosmo-ui-e2e-worker-bob',
    'nexus-person-work-profile/v1',
    'active',
    'nosmo-ui-e2e-invite-bob',
    '{
      "availability": {
        "status": "AVAILABLE_NOW",
        "label": "Available now"
      },
      "preferences": {
        "primaryTrade": "Painter",
        "locations": ["York"],
        "targetRoles": ["Painter"],
        "employmentTypes": ["CIS"],
        "rate": {"display": "GBP 22/hour", "currency": "GBP", "unit": "hour"}
      },
      "readiness": {
        "cv": {"state": "ready"},
        "certificates": {"state": "ready"},
        "references": {"state": "ready"}
      },
      "privateDocuments": ["PRIVATE_BOB_DOCUMENT"]
    }'::jsonb,
    now()
  );

INSERT INTO nexus_person_agency_access_grants (
  agency_id,
  person_id,
  source_invite_id,
  scope,
  status,
  consent_source,
  record_json,
  granted_at,
  revoked_at
)
VALUES
  (
    'nosmo-ui-e2e-agency',
    'nosmo-ui-e2e-worker-alice',
    'nosmo-ui-e2e-invite-alice',
    'RECRUITER_SAFE',
    'ACTIVE',
    'WORKER_INVITE_ONBOARDING',
    '{"privateDocumentsIncluded":false,"contactDetailsIncluded":false,"cvTextIncluded":false}'::jsonb,
    now(),
    null
  ),
  (
    'nosmo-ui-e2e-agency',
    'nosmo-ui-e2e-worker-charlie',
    'nosmo-ui-e2e-invite-charlie',
    'RECRUITER_SAFE',
    'ACTIVE',
    'WORKER_INVITE_ONBOARDING',
    '{"privateDocumentsIncluded":false,"contactDetailsIncluded":false,"cvTextIncluded":false}'::jsonb,
    now(),
    null
  ),
  (
    'nosmo-ui-e2e-agency',
    'nosmo-ui-e2e-worker-bob',
    'nosmo-ui-e2e-invite-bob',
    'RECRUITER_SAFE',
    'REVOKED',
    'WORKER_INVITE_ONBOARDING',
    '{"privateDocumentsIncluded":false,"contactDetailsIncluded":false,"cvTextIncluded":false}'::jsonb,
    now() - interval '1 hour',
    now()
  );
