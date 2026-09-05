-- NOSMO Person Card Freeware
-- Destructive-free E2E database smoke test.
-- Runs entirely inside a transaction and finishes with ROLLBACK.
-- Requires 001-person-card-agency-persistence.sql to be applied first.

BEGIN;

-- Remove any previous committed synthetic rows if someone accidentally committed
-- an earlier copy of this smoke fixture. The final ROLLBACK restores prior state.
DELETE FROM nexus_person_agency_actions WHERE action_id LIKE 'nosmo-e2e-%';
DELETE FROM nexus_person_agency_candidate_states WHERE agency_id = 'agency-nosmo-e2e';
DELETE FROM nexus_person_agency_access_grants WHERE agency_id = 'agency-nosmo-e2e';
DELETE FROM nexus_person_agency_recruiter_profiles WHERE auth_user_id = 'user-nosmo-e2e-recruiter';
DELETE FROM nexus_person_agency_members WHERE auth_user_id = 'user-nosmo-e2e-recruiter';
DELETE FROM nexus_person_work_events WHERE person_id IN ('person-nosmo-e2e-allowed','person-nosmo-e2e-denied');
DELETE FROM nexus_person_work_profiles WHERE person_id IN ('person-nosmo-e2e-allowed','person-nosmo-e2e-denied');
DELETE FROM nexus_person_onboarding_invites WHERE invite_id IN ('invite-nosmo-e2e-allowed','invite-nosmo-e2e-denied');
DELETE FROM nexus_pm_people WHERE person_id IN ('person-nosmo-e2e-allowed','person-nosmo-e2e-denied');
DELETE FROM nexus_person_agencies WHERE agency_id = 'agency-nosmo-e2e';
DELETE FROM users WHERE id = 'user-nosmo-e2e-recruiter';

INSERT INTO users (id,email,first_name,last_name)
VALUES ('user-nosmo-e2e-recruiter','nosmo-e2e-recruiter@example.invalid','NOSMO','E2E Recruiter');

INSERT INTO nexus_person_agencies (
  agency_id,name,website,registration_number,location,description,
  verification_status,status,created_by_user_id
) VALUES (
  'agency-nosmo-e2e','NOSMO E2E Agency','https://example.invalid','E2E-001',
  'Leeds','Synthetic rollback-only agency','UNVERIFIED','ACTIVE','user-nosmo-e2e-recruiter'
);

INSERT INTO nexus_person_agency_members (
  auth_user_id,agency_id,role,status
) VALUES (
  'user-nosmo-e2e-recruiter','agency-nosmo-e2e','OWNER','ACTIVE'
);

INSERT INTO nexus_person_agency_recruiter_profiles (
  auth_user_id,agency_id,display_name,job_title,email,phone,bio,verification_status
) VALUES (
  'user-nosmo-e2e-recruiter','agency-nosmo-e2e','NOSMO E2E Recruiter',
  'Recruiter','nosmo-e2e-recruiter@example.invalid','00000000000',
  'Synthetic rollback-only recruiter','UNVERIFIED'
);

INSERT INTO nexus_pm_people (
  person_id,display_name,person_type,status,record_json,persisted_at
) VALUES
(
  'person-nosmo-e2e-allowed','Allowed Worker','worker','active',
  '{"schema":"nexus-person-draft/v1","primaryRole":"Joiner","location":"Leeds","contact":{"phone":"SECRET","email":"secret@example.invalid"}}'::jsonb,
  now()
),
(
  'person-nosmo-e2e-denied','Denied Worker','worker','active',
  '{"schema":"nexus-person-draft/v1","primaryRole":"Electrician","location":"Bradford","contact":{"phone":"SECRET2","email":"secret2@example.invalid"}}'::jsonb,
  now()
);

INSERT INTO nexus_person_onboarding_invites (
  invite_id,token_digest,agency,agency_id,created_by_user_id,status,
  expires_at,claimed_person_id,claimed_at
) VALUES
(
  'invite-nosmo-e2e-allowed','nosmo-e2e-token-allowed','NOSMO E2E Agency',
  'agency-nosmo-e2e','user-nosmo-e2e-recruiter','CLAIMED',
  now()+interval '1 day','person-nosmo-e2e-allowed',now()
),
(
  'invite-nosmo-e2e-denied','nosmo-e2e-token-denied','NOSMO E2E Agency',
  'agency-nosmo-e2e','user-nosmo-e2e-recruiter','CLAIMED',
  now()+interval '1 day','person-nosmo-e2e-denied',now()
);

INSERT INTO nexus_person_work_profiles (
  person_id,schema_version,status,source_invite_id,record_json,persisted_at
) VALUES
(
  'person-nosmo-e2e-allowed','nexus-person-work-profile/v1','active','invite-nosmo-e2e-allowed',
  '{"availability":{"status":"available","label":"Available"},"preferences":{"primaryTrade":"Joiner","locations":["Leeds"],"targetRoles":["Joiner"],"employmentTypes":["contract"],"rate":{"display":"Open to offers"}},"readiness":{"cv":{"state":"draft"},"certificates":{"state":"missing"},"references":{"state":"missing"}},"cvText":"PRIVATE CV TEXT"}'::jsonb,
  now()
),
(
  'person-nosmo-e2e-denied','nexus-person-work-profile/v1','active','invite-nosmo-e2e-denied',
  '{"availability":{"status":"available","label":"Available"},"preferences":{"primaryTrade":"Electrician","locations":["Bradford"],"targetRoles":["Electrician"],"employmentTypes":["temporary"],"rate":{"display":"Open to offers"}},"readiness":{"cv":{"state":"draft"},"certificates":{"state":"missing"},"references":{"state":"missing"}},"cvText":"PRIVATE CV TEXT 2"}'::jsonb,
  now()
);

-- Only one worker grants recruiter-safe visibility.
INSERT INTO nexus_person_agency_access_grants (
  agency_id,person_id,source_invite_id,scope,status,consent_source,record_json,
  granted_at,updated_at
) VALUES (
  'agency-nosmo-e2e','person-nosmo-e2e-allowed','invite-nosmo-e2e-allowed',
  'RECRUITER_SAFE','ACTIVE','WORKER_INVITE_ONBOARDING',
  '{"schema":"nexus-person-agency-access-grant/v1","consent":"explicit","privateDocumentsIncluded":false,"contactDetailsIncluded":false,"cvTextIncluded":false}'::jsonb,
  now(),now()
);

-- ATS query shape must expose only the explicitly granted worker.
DO $$
DECLARE visible_count integer;
DECLARE denied_count integer;
BEGIN
  SELECT count(*) INTO visible_count
  FROM nexus_person_work_profiles wp
  JOIN nexus_pm_people p ON p.person_id = wp.person_id
  JOIN nexus_person_agency_access_grants g
    ON g.person_id = p.person_id
   AND g.agency_id = 'agency-nosmo-e2e'
   AND g.status = 'ACTIVE'
   AND g.scope = 'RECRUITER_SAFE'
  WHERE p.person_type = 'worker'
    AND p.status = 'active'
    AND wp.status = 'active';

  IF visible_count <> 1 THEN
    RAISE EXCEPTION 'CONSENT_GATE_EXPECTED_1_VISIBLE_GOT_%', visible_count;
  END IF;

  SELECT count(*) INTO denied_count
  FROM nexus_person_agency_access_grants
  WHERE agency_id = 'agency-nosmo-e2e'
    AND person_id = 'person-nosmo-e2e-denied'
    AND status = 'ACTIVE';

  IF denied_count <> 0 THEN
    RAISE EXCEPTION 'DENIED_WORKER_MUST_NOT_HAVE_ACTIVE_GRANT';
  END IF;
END $$;

-- Pipeline and action log work only for the visible worker fixture.
INSERT INTO nexus_person_agency_candidate_states (
  agency_id,person_id,stage,note,updated_by_user_id,updated_at
) VALUES (
  'agency-nosmo-e2e','person-nosmo-e2e-allowed','SHORTLISTED',
  'Synthetic E2E shortlist','user-nosmo-e2e-recruiter',now()
);

INSERT INTO nexus_person_agency_actions (
  action_id,agency_id,person_id,actor_user_id,action_type,record_json,created_at
) VALUES (
  'nosmo-e2e-action-shortlist','agency-nosmo-e2e','person-nosmo-e2e-allowed',
  'user-nosmo-e2e-recruiter','SHORTLISTED',
  '{"schema":"nexus-person-agency-action/v1","privateDocumentsIncluded":false}'::jsonb,
  now()
);

-- Grant the second worker: now two are visible.
INSERT INTO nexus_person_agency_access_grants (
  agency_id,person_id,source_invite_id,scope,status,consent_source,record_json,
  granted_at,updated_at
) VALUES (
  'agency-nosmo-e2e','person-nosmo-e2e-denied','invite-nosmo-e2e-denied',
  'RECRUITER_SAFE','ACTIVE','WORKER_INVITE_ONBOARDING',
  '{"schema":"nexus-person-agency-access-grant/v1","consent":"explicit","privateDocumentsIncluded":false,"contactDetailsIncluded":false,"cvTextIncluded":false}'::jsonb,
  now(),now()
);

DO $$
DECLARE visible_count integer;
BEGIN
  SELECT count(*) INTO visible_count
  FROM nexus_person_work_profiles wp
  JOIN nexus_pm_people p ON p.person_id = wp.person_id
  JOIN nexus_person_agency_access_grants g
    ON g.person_id = p.person_id
   AND g.agency_id = 'agency-nosmo-e2e'
   AND g.status = 'ACTIVE'
   AND g.scope = 'RECRUITER_SAFE'
  WHERE p.person_type = 'worker'
    AND p.status = 'active'
    AND wp.status = 'active';

  IF visible_count <> 2 THEN
    RAISE EXCEPTION 'SECOND_CONSENT_EXPECTED_2_VISIBLE_GOT_%', visible_count;
  END IF;
END $$;

-- Revoke the first worker: only the second remains visible.
UPDATE nexus_person_agency_access_grants
SET status='REVOKED',revoked_at=now(),updated_at=now()
WHERE agency_id='agency-nosmo-e2e'
  AND person_id='person-nosmo-e2e-allowed';

DO $$
DECLARE visible_count integer;
DECLARE private_ok boolean;
BEGIN
  SELECT count(*) INTO visible_count
  FROM nexus_person_work_profiles wp
  JOIN nexus_pm_people p ON p.person_id = wp.person_id
  JOIN nexus_person_agency_access_grants g
    ON g.person_id = p.person_id
   AND g.agency_id = 'agency-nosmo-e2e'
   AND g.status = 'ACTIVE'
   AND g.scope = 'RECRUITER_SAFE'
  WHERE p.person_type = 'worker'
    AND p.status = 'active'
    AND wp.status = 'active';

  IF visible_count <> 1 THEN
    RAISE EXCEPTION 'REVOKE_EXPECTED_1_VISIBLE_GOT_%', visible_count;
  END IF;

  SELECT
    COALESCE((record_json->>'privateDocumentsIncluded')::boolean,false) = false
    AND COALESCE((record_json->>'contactDetailsIncluded')::boolean,false) = false
    AND COALESCE((record_json->>'cvTextIncluded')::boolean,false) = false
  INTO private_ok
  FROM nexus_person_agency_access_grants
  WHERE agency_id='agency-nosmo-e2e'
    AND person_id='person-nosmo-e2e-denied';

  IF private_ok IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'PRIVACY_FLAGS_NOT_FALSE';
  END IF;
END $$;

ROLLBACK;
