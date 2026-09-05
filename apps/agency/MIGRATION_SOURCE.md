# NOSMO Agency migration source

Target repository: `mateuszfurmanski-droid/nosmo-workforce`
Target path: `apps/agency/`

Canonical migration baseline: NOSMO Agency V1.0024.

Source preservation lineage:

- existing Sites project: `appgprj_6a967b267b348191904db8faca122765`
- known Sites version: `24`
- known public baseline: `V1.0023`
- migration baseline: `V1.0024`
- known baseline commit: `70883401530b0f686f3c1e8a66daa4906d1c9c1e`
- source repository used for the preserved Agency backend / recruiter-safe flow: `mateuszfurmanski-droid/nosmo-nexus-mvp`
- source branch: `codex/nosmo-agency-v1-finalisation`
- source branch head at migration start: `2d9110354e6084a3f5922e0acafc9f9a31ad1934`
- parent Agency/Person Card source branch: `codex/person-card-freeware`

Migration rules:

1. Preserve existing Agency V1 behavior before redesign.
2. Do not copy or modify NOSMO Work frontend code in this migration.
3. Do not copy Nexus Core or e-SAFE implementation into this repository.
4. Worker consent and recruiter-safe projection remain authoritative.
5. Imported agency roster data and consented NOSMO worker data remain distinct data classes.
6. V1.0025 functional changes start only after migration parity is demonstrated.
