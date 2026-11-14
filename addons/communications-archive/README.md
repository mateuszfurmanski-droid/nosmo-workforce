# NOSMO SYSTEM · Communications Archive add-on

Optional native Android library for the existing Work app. The module is isolated
under `addons/communications-archive`, with no new app, account, backend, Neon
database, or automatic cloud transfer. The default Work build excludes it.

## Actual capabilities

| Source | Implementation | Limit |
| --- | --- | --- |
| WhatsApp / Business, Messenger, Instagram, TikTok | Live Android notification listener; one event per exposed MessagingStyle message | A source may omit notifications, hide text, or emit only a preview. This is not a complete conversation backup. |
| Outgoing messages | Explicit opt-in accessibility experiment: send click + emptied composer + newly visible matching text in the same titled conversation | Unverified on a physical Fold. PL/EN Send labels; selectors are heuristics, not verified app contracts. UI changes, keyboard/voice send, missing headings, other devices, and app-specific behavior can produce gaps. A visible bubble does not prove network delivery. |
| Telephone calls, including unknown callers | Open system call settings; import audio from one user-selected recording folder | System Phone app must support and actually record calls. The add-on does not enable native recording or capture call downlink itself. No caller identification is inferred from filenames. |
| Attachments in chats | MIME metadata if exposed in a notification | Does not copy images, documents, video or voice-note bytes out of another app. |
| Export | User-selected ZIP containing JSONL events plus imported audio | Export is decrypted and readable. It is initiated by the owner. |

**Not a full clone of any of these apps.** There is no promise that every sent
or received message is captured. In particular, notification access alone cannot
provide all messages sent inside another app. The screen observation path must
remain labelled experimental until the physical-device matrix is completed.
There is no private-database access, root dependency, automatic replies or
synthetic delivery confirmation. TikTok portability/API work is not implemented
and must not be represented as a live-message integration.

## Include in the existing host

From repository root:

```bash
cd apps/work/android-app
bash gradlew -PnosmoCommunicationsArchive=true :app:testDebugUnitTest :app:assembleDebug
```

Omit the property (or set it to `false`) to build the existing host without the
add-on services. Host package/signing/version are unchanged. CI APKs built from
this repository's older main baseline are integration checks, **not upgrades to
the later Lenovo 1.0176 installation**. Do not downgrade or uninstall a user's
installed app to install them. Include this module in the current signed Lenovo
build before physical testing; retain its existing signing key and version line.

The native host calls `CommunicationsArchive.install(Context)` reflectively only
when included. This registers a long-press app shortcut **Archiwum rozmów**,
usable without changing the currently deployed website. The optional native
Settings button is also present in the repository web source; it becomes visible
when that web source is separately deployed and the native module is available.
No deployment is performed by adding this code.

`CommunicationsArchive.open(Context)` opens the setup/activity directly for other
hosts. Consumer rules preserve the reflective entrypoint in minified builds.

## Setup on the phone

1. Open the archive through the app shortcut or the native-aware Settings button.
2. Enable the master switch and explicitly select each source app.
3. Grant notification access to **NOSMO SYSTEM · Kopia wiadomości**.
4. Optionally enable the outgoing experiment and its accessibility service. The
   on-device description explains the screen access and limitations. Only the
   listed packages are observed; gestures are not performed. The latest composer
   value exists only in RAM for at most 10 seconds, then is discarded. Text is
   persisted only after the observation rule succeeds. Password fields are skipped.
5. In Samsung Phone, if available, select auto recording of **all calls** so
   unsaved/unknown callers are included too. Make one test call and listen to
   both sides before relying on it. The add-on cannot verify this setting.
6. Grant read access to the recording folder. Import covers direct audio children
   only: known size, known modification time, stable for 60 seconds, at most
   256 MiB/file. Larger, nested or unstatable files are left in the original folder.
7. Review status and export a ZIP. A source timestamp, observation method and
   evidence label accompany each message; a preview is explicitly marked unknown.

Messages are observed event by event when Android exposes them. Recording-file
imports run when opening the add-on, on manual request, and through WorkManager
at a minimum 15-minute interval. Android may defer the job. Importing call audio
is therefore **not real-time**. A background/force-stopped app, unavailable
permissions, hidden notifications or unsupported screen layout can leave gaps.

## Data and lifecycle

- This first add-on is **device-scoped**, separate from the website's signed-in
  account. It never changes Work/Agency contacts, CVs, jobs or account history.
  Changing a website account does not transfer or delete this local archive.
- Message JSON and copied audio are encrypted with AES-256-GCM; the key is in
  Android Keystore. The host already has backup disabled. A new host must also
  disable backup and device-transfer backup of the archive; do not copy ciphertext
  without its device key.
- SQLite stores encrypted payloads with event ID and observation time as index
  fields. No message content or composer history is written to logs/preferences.
- Repeated notification updates with the same identity are ignored. Repeated
  messages with different source timestamps remain separate. There is no silent
  500-message retention cap or automatic deletion.
- A source may change message identity or expose the same message through both
  notifications and the screen. Cross-method deduplication is intentionally not
  guessed; duplicates may remain with distinct provenance. Notification IDs are
  not stable cross-device IDs.
- Pause stops new collection and cancels scheduled recording imports. Android
  service permissions can also be revoked. Archive deletion first pauses capture,
  then removes local copies; originals in the source apps/folder are untouched.
- ZIP export includes one JSON object per physical line (multiline text is escaped
  inside the JSON string), with original message text preserved. Imported audio
  paths in JSON refer to the corresponding actual ZIP entry. A failed export is
  reported and its partial output is deleted when the document provider permits.
- No credentials, production messages or recordings belong in the repository.

## Validation

CI workflow: `.github/workflows/communications-archive-addon.yml`.

```bash
bash apps/work/android-app/gradlew --no-daemon \
  -p addons/communications-archive/android \
  :library:testDebugUnitTest :library:lintDebug :library:assembleDebug
```

Behavior tests cover notification parsing (including self messages, multiline
text, previews and grouped summaries), replay versus genuinely repeated text,
AES-GCM authentication, opt-in gates, and send-observation failure conditions.
CI also compiles/tests the host with the property both enabled and disabled.
These checks do not prove compatibility with current proprietary app UIs or
real two-sided call recording. Record physical results in `DEVICE-TESTS.md`.

## Platform references

- [Android notification listener](https://developer.android.com/reference/android/service/notification/NotificationListenerService)
- [MessagingStyle message sender semantics](https://developer.android.com/reference/android/app/Notification.MessagingStyle.Message)
- [Accessibility service window content](https://developer.android.com/guide/topics/ui/accessibility/service)
- [VOICE_CALL requires system-only CAPTURE_AUDIO_OUTPUT](https://developer.android.com/reference/android/media/MediaRecorder.AudioSource)
- [Samsung auto recording options and regional limits](https://www.samsung.com/sa_en/support/mobile-devices/how-to-use-the-call-recording-feature-on-your-samsung-galaxy-smartphone/)
