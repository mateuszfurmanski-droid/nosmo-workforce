# NOSMO return point protocol

This protocol is mandatory for Worker, Agency and Emergency development.

## Before every meaningful change

1. Confirm the exact product, provider, project and URL.
2. Record the current source commit and immutable deployment or Sites version.
3. Create a Git branch named `return-point/<product>-<date>-<short-purpose>`.
4. Record tests, authentication mode and runtime environment variable names only. Never copy secret values.
5. Keep the accepted production version active while work continues on Preview.

## Change sequence

1. Return point.
2. One bounded change.
3. Build and automated tests.
4. Preview deployment.
5. Authentication and feature smoke test in the correct signed-in environment.
6. User acceptance.
7. Production promotion only after acceptance.

If any step fails, stop and restore the recorded deployment/version before starting another change.

## Provider boundary

ChatGPT Sites identity and Vercel Clerk/Google identity are different products and environments. Never move a release between them as a workaround for missing configuration. Runtime secrets must be configured and verified on the same provider and project that will run the feature.

## Conversation recovery

At the start of a new or recovered conversation, read the latest product checkpoint and verify the live deployment before editing. Never infer the active version from an older message.

## Current Worker return points (2026-09-17)

- accepted public Sites baseline: version 95, commit `f6027c9ff045aa3dbd201d02a6089a3b11a3b774`
- correct Clerk/Google-login Preview: Vercel deployment `dpl_8EKrX1Wnsh7BkcmUBZVcJibHYxiU`
- correct Preview source checkpoint: `return-point/worker-google-login-2026-09-17`
- inactive Sites v96 rollback trace: `return-point/sites-v96-before-rollback-2026-09-17`
