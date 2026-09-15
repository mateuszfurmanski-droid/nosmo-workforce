# Contact help and confirmed AI blocker — 2026-09-15

Parent 35dab2515cbca4d83fc1064468616f4c1eef5414. Worker-only small stage: I don't have a contacts file button in first-login and import contacts. Device-specific instructions explain exporting existing work contacts via Apple/Samsung Contacts; no manual spreadsheet creation. Supported contact picker remains available. Guidance sources: https://support.apple.com/guide/ipad/ipada42ba52d/ipados and https://www.samsung.com/uk/support/mobile-devices/how-do-i-manage-my-contacts/ .

User screenshot IMG_0449 confirms authenticated /api/nexus-actions reports not_configured. Therefore current Preview does not have an operational AI backend; OPENAI_API_KEY absent per existing endpoint contract. Earlier builds/UI tests were not model roundtrips. No .env read. No connected secure OpenAI key provisioning tool found. Do not claim AI ready. Configuration of server-side provider credential on Worker Preview remains required, followed by signed-in test.

User wants automatic source discovery and intake, not manual exports. Next separate stages: consented source connection/selection; search those sources; recognize and import documents; shared offer/contact/call/document context. Current browser does not have unrestricted device storage/contact/inbox access. Ask Nexus alone cannot search unconnected sources. This help stage does not implement automatic document search or attachment sharing. Production, Core, Agency, Neon unchanged.

Syntax checks passed; build/browser verification pending at source commit.
