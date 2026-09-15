# Worker prompt suggestions — 2026-09-15

Continuation of mini-Nexus addon. Parent 10c3b74b7d30882dd71fa8f9144b4e0048644f52. One feature only: prior submitted requests suggested above composer in every app. Initial app-specific examples are replaced by personal history. Click inserts editable text; no automatic AI request or external action. New submitted requests move first, case/whitespace duplicates removed. Typing ranks relevant prior requests; 3 shown initially, More exposes up to 20. Clear available.

Signed-in Clerk user history is saved in this browser's localStorage under an account-specific key. Guest history stays in memory only. New Preview origins do not share browser storage. This is reusable prompt history, NOT offer/call/document case memory. Cross-device history, authentic model roundtrip and shared case memory remain pending. No Agency/Core/production or database changes.

4 focused tests pass: deduplication, corrupt/bounded data, relevant ranking, account key separation/no guest persistence. TS syntax passes. Build/browser checks pending at source commit.
