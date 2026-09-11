# NOSMO Work — Android app

This directory is the native Android companion for NOSMO Work. The website in
this repository remains the product prototype; Android-only integrations belong
here and must not be presented as working until they are implemented and tested
on a real device.

## Contact intake from Android Share

NOSMO Work must register as an Android Share Target for:

- plain text shared from WhatsApp, Messages, Gmail and other apps;
- contact cards (`text/vcard`, `text/x-vcard`, `.vcf`);
- screenshots and other supported images (`image/*`).

The intake flow is always:

1. Receive the shared item without reading the source app in the background.
2. Parse locally when possible.
3. Show an editable preview.
4. Ask the worker to confirm.
5. Save to the app contact/employer database only after confirmation.

For text and vCards, extract where available:

- contact name;
- company or recruitment agency;
- UK/international telephone number;
- email address;
- WhatsApp availability;
- source app and original note.

Normalize phone numbers before duplicate detection. Match existing records by
normalized phone number first and email second. If a match exists, offer
`Update existing` or `Save separately`; never silently overwrite it.

## Screenshot contact import

The Share Target and an in-app `Import screenshot` action must accept a job or
conversation screenshot. Use on-device OCR by default. Detect:

- telephone numbers, including UK formats such as `07...`, `+44...` and spaced
  landline numbers;
- email addresses;
- person, company and agency names when confidence is sufficient;
- job title, rate, location and reference number when visible.

OCR results must be treated as suggestions. Highlight uncertain fields and let
the user correct them before saving. Never call, message, apply, upload or add a
device contact automatically.

If cloud OCR is ever introduced, it must be opt-in for each image, clearly say
where the image is sent, and delete the uploaded image after processing under a
documented retention policy. The default remains local processing.

## Privacy and permissions

- Do not scan WhatsApp, messages, contacts, gallery or installed apps in the
  background.
- Ask only for the specific shared file/image URI supplied by Android.
- Do not require full address-book permission for app-owned contacts.
- Keep NOSMO Work contacts separate from the phone address book unless the user
  explicitly chooses `Add to phone contacts`.
- Do not save the original screenshot after confirmed extraction unless the
  user selects `Keep source image`.
- Store provenance: manual, WhatsApp share, message share, email share, vCard or
  screenshot OCR.

## Required Android integration

- `ACTION_SEND` intent filters for text, vCard and image MIME types.
- `ACTION_SEND_MULTIPLE` may be added later for bounded batch import.
- Android Photo Picker for manual screenshot import.
- On-device OCR (Google ML Kit Text Recognition or an equivalent maintained
  on-device library).
- A confirmation screen that works without network access.
- Tests for number normalization, duplicate detection, malformed vCards,
  rotated screenshots and low-confidence OCR.

## Current status

Implementation is present in this repository:

- the manifest registers NOSMO Work for shared text, HTML, vCards and images;
- a native offline review screen requires confirmation before saving;
- screenshots use bundled Google ML Kit text recognition on-device and the
  original image is not retained;
- confirmed items are queued privately until the NOSMO Work web layer stores
  them;
- the web layer checks contact duplicates by normalized phone first and email
  second, and job duplicates by direct link or employer plus role;
- a duplicate always offers `Update existing`, `Save separately` or `Discard`.

The Android module now includes a Gradle 8.9 wrapper and passes a clean Android
SDK build. `testDebugUnitTest` passes all four parser tests and `assembleDebug`
produces a valid v2-signed debug APK for `tech.nosmo.work` version `1.0101`.
Manifest inspection confirms the text, vCard and image Share Target filters and
no broad contacts, gallery or installed-app permissions.

Real-device testing is still required before the APK can be called
release-ready. The public Sites URL alone cannot appear in Android's system
Share menu; the native app must be installed.
