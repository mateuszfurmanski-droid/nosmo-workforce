-- NOSMO Agency V1 finalisation E2E fixture.
-- Disposable CI-only data. No production or Neon identifiers.
\set ON_ERROR_STOP on

INSERT INTO nexus_person_agency_roster_workers (
  roster_worker_id, agency_id, display_name, name_location_key, record_json,
  connection_status, status, created_by_user_id, updated_by_user_id
)
VALUES
  ('agency-v1-e2e-alex','nosmo-ui-e2e-agency','Alex Turner V1 E2E','alex-turner-v1|leeds',
   '{"trade":"Joiner","location":"Leeds","availability":{"status":"Available","availableFrom":"2026-09-07"},"skills":["Second fix","Fire door installation"],"licences":["CSCS Blue"],"expectedRate":"GBP 22/hour","workerAppConfirmed":false}'::jsonb,
   'IMPORTED','ACTIVE','nosmo-ui-e2e-recruiter','nosmo-ui-e2e-recruiter'),
  ('agency-v1-e2e-maya','nosmo-ui-e2e-agency','Maya Collins V1 E2E','maya-collins-v1|leeds',
   '{"trade":"Joiner","location":"Leeds","availability":{"status":"Available","availableFrom":"2026-09-07"},"skills":["Second fix"],"licences":["CSCS Blue"],"expectedRate":"GBP 21/hour","workerAppConfirmed":false}'::jsonb,
   'IMPORTED','ACTIVE','nosmo-ui-e2e-recruiter','nosmo-ui-e2e-recruiter'),
  ('agency-v1-e2e-noah','nosmo-ui-e2e-agency','Noah Ward V1 E2E','noah-ward-v1|leeds',
   '{"trade":"Joiner","location":"Leeds","availability":{"status":"Available","availableFrom":"2026-09-07"},"skills":["Second fix"],"licences":["First Aid at Work"],"expectedRate":"GBP 21/hour","workerAppConfirmed":false}'::jsonb,
   'IMPORTED','ACTIVE','nosmo-ui-e2e-recruiter','nosmo-ui-e2e-recruiter');

INSERT INTO nexus_person_agency_requests (
  request_id, agency_id, role, client_name, location, status, headcount, record_json,
  created_by_user_id, updated_by_user_id, published_at
)
VALUES (
  'agency-v1-e2e-request', 'nosmo-ui-e2e-agency', 'Joiner', 'Leeds Interiors E2E',
  'Leeds', 'OPEN', 2,
  '{"startDate":"2026-09-07","requiredSkills":["Second fix","Fire door installation"],"requiredLicences":["CSCS Blue"],"matchPolicy":{"explainable":true}}'::jsonb,
  'nosmo-ui-e2e-recruiter', 'nosmo-ui-e2e-recruiter', now()
);

INSERT INTO nexus_person_agency_applications (
  application_id, agency_id, request_id, roster_worker_id, stage, readiness_status,
  owner_user_id, next_action, record_json
)
VALUES
  ('agency-v1-e2e-app-alex','nosmo-ui-e2e-agency','agency-v1-e2e-request','agency-v1-e2e-alex','SHORTLISTED','READY','nosmo-ui-e2e-recruiter','Confirm Monday start',
   '{"match":{"strength":"STRONG","reasons":["Trade matches Joiner","Leeds","Available 2026-09-07","Second fix","Fire door installation","CSCS Blue"],"gaps":[]}}'::jsonb),
  ('agency-v1-e2e-app-maya','nosmo-ui-e2e-agency','agency-v1-e2e-request','agency-v1-e2e-maya','NEW','CHECK','nosmo-ui-e2e-recruiter','Check fire-door experience',
   '{"match":{"strength":"GOOD","reasons":["Trade matches Joiner","Leeds","Second fix","CSCS Blue"],"gaps":["Fire door installation not explicitly listed"]}}'::jsonb),
  ('agency-v1-e2e-app-noah','nosmo-ui-e2e-agency','agency-v1-e2e-request','agency-v1-e2e-noah','NEW','BLOCKED','nosmo-ui-e2e-recruiter','Request CSCS evidence',
   '{"match":{"strength":"BLOCKED","reasons":["Trade matches Joiner","Leeds","Second fix"],"gaps":["Required CSCS Blue not present"]}}'::jsonb);

-- Separate authenticated tenant and canary record.
INSERT INTO users (id, first_name, last_name)
VALUES ('agency-v1-isolation-user','Isolation','Recruiter');

INSERT INTO sessions (sid, sess, expire)
VALUES (
  'agency-v1-isolation-session',
  '{"user":{"id":"agency-v1-isolation-user","firstName":"Isolation","lastName":"Recruiter","profileImageUrl":null}}'::jsonb,
  now() + interval '1 hour'
);

INSERT INTO nexus_person_agencies (
  agency_id, name, location, status, verification_status, created_by_user_id
)
VALUES (
  'agency-v1-isolation-tenant','TENANT B QA ISOLATION','Manchester','ACTIVE','UNVERIFIED','agency-v1-isolation-user'
);

INSERT INTO nexus_person_agency_members (auth_user_id, agency_id, role, status)
VALUES ('agency-v1-isolation-user','agency-v1-isolation-tenant','OWNER','ACTIVE');

INSERT INTO nexus_person_agency_recruiter_profiles (
  auth_user_id, agency_id, display_name, job_title, verification_status
)
VALUES ('agency-v1-isolation-user','agency-v1-isolation-tenant','Isolation Recruiter','QA','UNVERIFIED');

INSERT INTO nexus_person_agency_roster_workers (
  roster_worker_id, agency_id, display_name, name_location_key, record_json,
  connection_status, status, created_by_user_id, updated_by_user_id
)
VALUES (
  'agency-v1-isolation-canary','agency-v1-isolation-tenant','TENANT B CANARY MUST NOT LEAK','tenant-b-canary|manchester',
  '{"trade":"Joiner","location":"Manchester","availability":{"status":"Available","availableFrom":"2026-09-07"},"skills":["Second fix"],"licences":["CSCS Blue"],"workerAppConfirmed":false,"qaIsolationCanary":true}'::jsonb,
  'IMPORTED','ACTIVE','agency-v1-isolation-user','agency-v1-isolation-user'
);
