# NOSMO Work V1.0100

- Adds a native Android Share Target for text, HTML, vCards and images shared
  from WhatsApp, Messages, Gmail and other apps.
- Parses contact and job details locally and shows an editable native review
  before anything can be saved.
- Uses bundled on-device ML Kit OCR for shared screenshots and does not retain
  the original image.
- Sends only confirmed items to the existing Jobs or Contact register through
  a bounded private queue with web acknowledgement.
- Detects contact duplicates by normalized phone first and email second; job
  duplicates use the direct application link or employer plus role.
- Requires an explicit choice between updating the existing record, saving a
  separate record or discarding the shared item.
- Extends private contact exports with company, role and note fields.

Web build and automated source tests are covered in this release. A clean
Android SDK build and real-device verification remain required before producing
a release APK.
