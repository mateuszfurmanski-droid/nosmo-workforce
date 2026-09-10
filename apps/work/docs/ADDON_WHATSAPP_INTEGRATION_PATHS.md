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
