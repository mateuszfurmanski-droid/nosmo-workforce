# Worker app preparation checkpoint

Single feature: all 12 external app tiles open an in-NOSMO preparation screen instead of launching directly.

Implemented:
- WhatsApp, Messages, Gmail: recipient selection or manual entry, purpose, editable full text; Gmail subject. Explicit Continue required.
- Call: confirmed number and local call notes.
- Job portals: purpose, role/location and preparation notes.
- Drive: files/folder plan and notes; Calendar: event/date/time plan; CSCS/CITB: card/training task.
- Non-communication apps explicitly use a copy/website fallback; no claim of automatic upload, search-field fill or event creation.
- Back restores tiles; per-app drafts remain in memory across tab navigation and external-app handoff, cleared on account change/reload. No additional storage or server writes.
- Full international phone number required; no guessed country code or ambiguous recipient. Multiple saved numbers listed individually.
- WhatsApp recipient-plus-text link; SMS URI; Gmail web compose URL; telephone dialler. Nothing sent automatically; opening requested is not send/delivery confirmation.
- No attachments are transferred by this feature; UI makes separate attachment handling clear.
- EN/PL copy, theme variables, angular fields/buttons, keyboard focus and responsive stacking.

Validation before deployment: 6 focused URL/recipient tests pass, including multiline/special-character preservation, recipient/header injection rejection and empty-message protection. TSX syntax checks pass. Full remote build and browser verification pending.

Reference contracts consulted: https://faq.whatsapp.com/5913398998672934 ; https://www.rfc-editor.org/info/rfc5724/ ; https://www.rfc-editor.org/info/rfc6068/ . Gmail web composer behavior and SMS device-specific behavior still require real-account/device verification. Do not claim all native-app handoffs PASS.

Next: Preview deployment, all-tile in-app entry verification, draft/back/edit checks, screenshots. Do not send messages or place calls as part of testing. Signed-in onboarding, mobile/avatar checks and Security Gate remain separate pending work.


## Preview result
- Source commit: 896ad945b4e000c0c9c427e34ab164363aa0f00d.
- Deployment dpl_6jqkwdbE8tVNNfDfNwhs7nLZH4SQ is READY, preview target=null.
- URL: https://nosmo-worker-v95-preview-irafqixdo.vercel.app/
- Browser opened the live app successfully. All 12 external tiles were individually clicked; each displayed its named in-app preparation heading without leaving NOSMO.
- WhatsApp Continue initially disabled, enabled after entering a fictional test number and complete multiline test message. Continue was NOT clicked; no messages/calls performed.
- Native handoff, attachments, signed-in account changes and mobile verification are NOT verified by these checks. User visual acceptance pending.
- Observed minor follow-up: Apps intro still says services stay folded; update this stale descriptive copy in the next small change.
- Streaming interruption recurred while deploying; deployment recovered by listing existing deployments rather than resubmitting.
