# ADDON: WhatsApp Integration Paths

Status: Track A intake implemented in V1.0100; real-device verification and the
approved return-to-WhatsApp flow remain open. Track B is still architecture
backlog only.

## Product problem

Opening WhatsApp with a prepared message is useful, but it is not the complete communication layer. NOSMO needs a deeper route without pretending it can silently read or control a worker's private WhatsApp account.

## What Meta currently exposes

Meta's published developer platform is the WhatsApp Business Platform / Cloud API. It supports sending and receiving messages for an onboarded business phone number, with incoming events delivered to a business webhook. Embedded Signup is the route for a solution provider to onboard a business and obtain the approved permissions.

This does not grant an app access to an arbitrary private consumer WhatsApp inbox or its full history. Meta AI or a Llama model can analyse content that NOSMO lawfully receives, but an AI model does not create access to private WhatsApp chats.

Official starting points:

- https://developers.facebook.com/docs/whatsapp/cloud-api/
- https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/
- https://developers.facebook.com/docs/whatsapp/embedded-signup/
- https://developers.facebook.com/docs/whatsapp/guides/interactive-messages/

## Recommended two-track architecture

### Track A: personal WhatsApp companion

- Native Android Share Target receives only the chat export, message, image or document the worker explicitly shares.
- Nexus analyses that selected content on demand.
- NOSMO prepares the recipient, document checklist and reply.
- Android shares the approved text/files back to WhatsApp.
- The worker verifies the chat and presses Send.

This is the correct default for a worker using a personal WhatsApp account. It preserves end-to-end user control and avoids fragile screen automation.

### Track B: WhatsApp Business connection

- Offer an optional Business connection only to a worker or agency willing to use an onboarded WhatsApp Business number.
- Use Meta Embedded Signup and the Cloud API.
- Receive new messages through a secured webhook and route them to the correct worker-owned inbox.
- Let Nexus classify agency replies and prepare responses.
- Enforce Meta messaging rules, recipient consent, template requirements and the current customer-service window.
- Keep document release behind the same explicit approval checklist used in NOSMO.

Before building Track B, validate whether Meta's current WhatsApp Business App coexistence flow is available for the target country, account type and solution-provider status. Do not promise coexistence until that onboarding test passes.

## Non-options

- Do not use Android Accessibility Services to impersonate taps or scrape chats.
- Do not bulk-message agencies from a personal account.
- Do not store document images, share codes, addresses or IDs in message logs without explicit worker action.
- Do not claim that Meta AI can read a user's WhatsApp history through an undocumented API.

## Proof-of-concept gate

The first native proof should demonstrate: share a recruiter screenshot into NOSMO, recognise the request, approve a one-agency pack, return a message and selected files to WhatsApp, and keep Send under the worker's control. In parallel, run a separate Meta Business onboarding spike with a test number and webhook.


## Add-on decision: Apps visible first, prepare inside NOSMO (2026-09-15)

Status: accepted product requirement, recorded for implementation; not deployed or runtime-verified by this documentation change. Applies to the existing Worker Apps screen. This does not start a new launcher application or change Agency, Emergency or Nexus Core.

### Apps screen

- Put the app tiles first at the top of Apps, visible immediately on entry on phone and desktop.
- Do not hide these tiles in a collapsed section or require the worker to expand a menu.
- Place advanced integration configuration, imports and other secondary sections below the app tiles.
- Retain existing NOSMO branding, angular controls and theme colours.

### Prepare before leaving NOSMO

Selecting an app tile opens an in-app preparation screen for that app. It must not immediately launch the external app.

Each screen presents the relevant actions rather than the same generic launcher:
- WhatsApp: choose a work contact, prepare or edit a message, review any document selection.
- SMS: choose recipient and prepare the message.
- Email: choose recipient, subject and body; review selected attachments.
- Other apps: show the relevant task, information or files to prepare before opening the destination. Implement only capabilities verified for that app.

NOSMO should carry forward an already selected contact and task context, show them clearly, and let the worker correct them. If the recipient is missing or ambiguous, require a selection; never guess. Nexus may draft text from the worker-approved context. The worker sees the full editable text before continuing.

### WhatsApp target experience

1. Tap WhatsApp in Apps.
2. Stay inside NOSMO: choose or confirm the contact by name and full number.
3. Select the purpose, such as asking for work, replying to an agency or confirming availability.
4. Prepare the complete message; optionally select documents for a separate supported handoff.
5. Review recipient, full message and selected files together.
6. Tap "Open this conversation in WhatsApp".
7. Target result: WhatsApp opens the intended recipient's conversation with the complete text already in the composer. The worker presses Send in WhatsApp.

The target experience should not require manual copy/paste when recipient-plus-text handoff is supported. Verify the supported mechanism and current official app documentation during implementation for each platform. If direct handoff is unavailable, explain the limitation and offer a deliberate copy/share fallback without losing the draft. Do not report the fallback as a successful direct handoff.

Text handoff and attachment handoff are separate capabilities: do not assume that one mechanism can prefill the intended recipient, full text and arbitrary files together. Explicitly show any file that still requires attaching and require the worker to verify the recipient if the system share sheet asks them to select one.

### Draft and action state

- Preserve edits when going back from preparation or returning from the external app.
- Keep drafts private to the active account; do not carry a previous account's contact, message or files into another account.
- Opening the external app is not proof that a message was sent or delivered. Use an "Opened in WhatsApp" state unless actual confirmation exists.
- Only the selected content is handed off after the worker presses Continue/Open. Preparing a draft never sends it.
- Keep document selection and consent explicit; do not attach the entire document pack by default.

### Acceptance checks before calling this complete

- Phone and desktop: tiles are first and expanded on the initial Apps view.
- Tapping a tile stays in NOSMO until the explicit external-app action.
- WhatsApp: the chosen contact and complete edited message arrive together in the intended chat/composer on tested devices.
- Test multiple numbers for one contact, missing/invalid recipient, multiline text, special characters, unavailable WhatsApp, cancelled handoff and return navigation.
- Test attachments independently; no silent recipient or file substitutions.
- Verify the relevant SMS/email/app-specific preparation screens against each platform's actual supported capabilities.
- Nothing is sent automatically, and opening an app does not mark the message sent.
- This requirement extends Track A above; it does not imply access to private message history.


## User decision: chat-first mini Nexus for every app (2026-09-15)

Default preparation is a natural-language conversation, not a task/recipient form. Example: "wyslij dokumenty do tej agencji co mi przyslala oferte". Applies to all 12 apps. Keep forms under optional Edit details. App tiles remain expanded at the top.

Use actual available worker context: saved contacts, imported document metadata, imported agency-reply analysis. Never treat seed jobs or a contact alone as a received offer. Resolve a unique agency and relevant documents; ask one short question when evidence is missing or ambiguous. No silent inbox access and no invented recipients/documents. Show recipient, full draft and document checklist before the worker continues. Actual document attachment remains manual until a separately verified integration supports it.

This stage adds an authenticated server-side OpenAI Responses planner with structured output, grounded ID validation, origin/body guards, bounded context, timeout and per-instance rate limits. It executes no external actions. Missing configuration, login, timeout and provider errors must be visible; no canned answer impersonating AI. Conversation context is limited to this workspace and the last nine messages, with up to 50 contacts and 50 document metadata records. No raw file upload by this planner. Review API configuration and signed-in model roundtrip before claiming AI operational acceptance.

Tablet UX: prominent multiline composer, smaller headings, optional forms, full available content width. The ChatGPT/iPad browser sheet size is host-controlled; open in Safari for a larger host viewport. No claim that CSS resizes that sheet.

Remaining product work: consented inbox/offer ingestion, durable context retrieval, attachment handoff and per-provider action execution. These are separate stages, not completed by the planner UI. Nexus Core, Agency, production and Security Gate unchanged.
