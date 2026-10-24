# Smart Worker Pool — implementation scope

Baseline: `fix/agency-v1.0025-core`, Agency 1.0.25. Work only on feature branch. Production, Worker and Nexus unchanged.

## Preserve
- Existing agency tenant isolation and recruiter authorization.
- Existing worker consent and recruiter-safe visibility; never expose private documents or worker contacts without authorization.
- Existing requests, explainable matches, pipeline, and roster import. Extend, do not duplicate.

## Delivery sequence
1. Audit existing worker roster routes, filtering, pagination and UI components. Record actual gaps before implementation.
2. Add server-side, tenant-scoped filtering by trade, location, availability, verified qualifications, document expiry, and search term. Return only recruiter-authorized fields; parameterize SQL and cap page size.
3. Add stable sorting, pagination, clear filter state, empty and loading states. Persist filters only in recruiter-local preferences.
4. Add per-request shortlists using existing request and pipeline models; deduplicate worker IDs, enforce consent, and record audit events.
5. Display last-synced availability timestamp and stale/unknown state; never infer availability from missing updates.
6. Add unit/contract tests for cross-tenant access, revoked consent, missing certificates, stale availability, duplicate shortlist entries, and filter combinations.

## Definition of done
- No parallel worker database or second ATS.
- API and UI share one canonical filter contract.
- No Worker/Agency integration regression.
- `npm run check` and automated tests pass before preview deployment.
- No production release or claim of manual end-to-end verification until separately approved.
