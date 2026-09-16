-- Run only on the explicitly isolated security QA branch. Synthetic fixtures roll back.
DO $qa$
DECLARE
 prefix text := 'security-grant-' || gen_random_uuid()::text;
 actor text; agency_a text; agency_b text; person text; invite text; n integer;
 candidate_query text := $candidate$SELECT count(*) FROM (select p.person_id as "personId",p.display_name as "displayName",p.record_json as "personRecord",w.record_json as "workRecord",w.persisted_at as "persistedAt",s.stage,s.note,s.updated_at as "stateUpdatedAt"
    from nexus_person_work_profiles w join nexus_pm_people p on p.person_id=w.person_id
    join nexus_person_agency_access_grants g on g.person_id=p.person_id and g.agency_id=$1 and g.status='ACTIVE' and g.scope='RECRUITER_SAFE'
    left join nexus_person_agency_candidate_states s on s.person_id=p.person_id and s.agency_id=$1
    where p.person_type='worker' and p.status='active' and w.status='active' order by w.persisted_at desc) AS candidates$candidate$;
BEGIN
 actor:=prefix||'-user';agency_a:=prefix||'-a';agency_b:=prefix||'-b';person:=prefix||'-person';invite:=prefix||'-invite';
 BEGIN
 INSERT INTO users(id,first_name) VALUES(actor,'Synthetic QA');
 INSERT INTO nexus_person_agencies(agency_id,name,status,created_by_user_id) VALUES(agency_a,'Synthetic A','ACTIVE',actor),(agency_b,'Synthetic B','ACTIVE',actor);
 INSERT INTO nexus_person_agency_members(auth_user_id,agency_id,role,status) VALUES(actor,agency_a,'RECRUITER','ACTIVE');
 INSERT INTO nexus_pm_people(person_id,display_name,person_type,status,record_json,persisted_at) VALUES(person,'Synthetic worker','worker','active','{}',now());
 INSERT INTO nexus_person_onboarding_invites(invite_id,token_digest,agency,agency_id,created_by_user_id,status,expires_at,claimed_person_id,claimed_at) VALUES(invite,prefix||'-token','Synthetic A',agency_a,actor,'CLAIMED',now()+interval '1 hour',person,now());
 INSERT INTO nexus_person_work_profiles(person_id,schema_version,status,source_invite_id,record_json,persisted_at) VALUES(person,'nexus-person-work-profile/v1','active',invite,'{}',now());
 INSERT INTO nexus_person_agency_access_grants(agency_id,person_id,source_invite_id,scope,status,consent_source,record_json,granted_at,updated_at) VALUES(agency_a,person,invite,'RECRUITER_SAFE','ACTIVE','WORKER_INVITE_ACCEPTED','{}',now(),now());
 EXECUTE candidate_query INTO n USING agency_a;IF n<>1 THEN RAISE EXCEPTION 'Active grant invisible';END IF;
 EXECUTE candidate_query INTO n USING agency_b;IF n<>0 THEN RAISE EXCEPTION 'Cross-tenant exposure';END IF;
 WITH revoked_grant AS (
 UPDATE nexus_person_agency_access_grants SET status='REVOKED',revoked_at=now(),updated_at=now()
 WHERE agency_id=agency_a AND person_id=person||'-other' AND scope='RECRUITER_SAFE' AND status='ACTIVE' RETURNING person_id
) SELECT count(*) INTO n FROM revoked_grant;
IF n<>0 THEN RAISE EXCEPTION 'Another Worker revoked this grant';END IF;
WITH revoked_grant AS (
 UPDATE nexus_person_agency_access_grants SET status='REVOKED',revoked_at=now(),updated_at=now()
 WHERE agency_id=agency_a AND person_id=person AND scope='RECRUITER_SAFE' AND status='ACTIVE' RETURNING person_id
)
INSERT INTO nexus_person_work_events(event_id,person_id,invite_id,event_type,actor_type,record_json,persisted_at)
SELECT prefix||'-revocation-event',person_id,NULL,'CONSENT_REVOKED','WORKER','{}'::jsonb,now() FROM revoked_grant;
SELECT count(*) INTO n FROM nexus_person_work_events WHERE event_id=prefix||'-revocation-event';
IF n<>1 THEN RAISE EXCEPTION 'Consent audit event missing';END IF;
 EXECUTE candidate_query INTO n USING agency_a;IF n<>0 THEN RAISE EXCEPTION 'Revoked grant exposure';END IF;
 UPDATE nexus_person_agency_access_grants SET status='ACTIVE',revoked_at=NULL WHERE agency_id=agency_a AND person_id=person;
 UPDATE nexus_person_work_profiles SET status='inactive' WHERE person_id=person;
 EXECUTE candidate_query INTO n USING agency_a;IF n<>0 THEN RAISE EXCEPTION 'Inactive profile exposure';END IF;
 SELECT count(*) INTO n FROM nexus_person_agency_members WHERE auth_user_id=actor AND agency_id=agency_b AND status='ACTIVE';IF n<>0 THEN RAISE EXCEPTION 'Membership crossover';END IF;
 RAISE EXCEPTION USING ERRCODE='ZQ001',MESSAGE='ROLL_BACK_SYNTHETIC_FIXTURES';
 EXCEPTION WHEN SQLSTATE 'ZQ001' THEN NULL;
 END;
 SELECT count(*) INTO n FROM users WHERE id=actor;IF n<>0 THEN RAISE EXCEPTION 'Fixture rollback failed';END IF;
END $qa$
