# Physical-device acceptance — not yet executed

Device model/Android/One UI: **unverified**. Record app versions and interface
languages before each test. Use synthetic conversations owned by the tester.
Do not commit real message text, numbers, screenshots, audio or export archives.

For each of WhatsApp, Messenger, Instagram and TikTok:

| Test | Required observation | Result |
| --- | --- | --- |
| Incoming with screen locked | One message record if notification exposes content | Not tested |
| Send within the app | Exactly the new text, correct conversation, outgoing_observed | Not tested |
| Send identical text twice | Two separate records | Not tested |
| Draft then cancel / switch chat | No persisted draft or attribution to another chat | Not tested |
| Multiline / Polish characters | Original text survives JSONL roundtrip | Not tested |
| Notification update / grouped summary | No duplicate from update/summary | Not tested |
| Hide previews / mute chat | Acknowledge unsupported/missing content; never claim completeness | Not tested |
| Keyboard send / voice send / another device | Establish gaps; do not assume click observer captures it | Not tested |
| Pause master / source / revoke permission | No later capture from that source | Not tested |
| Restart / battery restrictions / long idle | Establish whether service reconnects; document gaps | Not tested |

Call recording:

| Test | Required observation | Result |
| --- | --- | --- |
| Known + unsaved incoming number | Samsung records automatically, both sides audible | Not tested |
| Outgoing + Bluetooth + Wi-Fi calling | Document actual recorder coverage independently | Not tested |
| Import stable audio twice | One archived copy; original unchanged | Not tested |
| Import while audio still being written | No incomplete archived recording | Not tested |
| Folder revoked / full disk / oversized audio | Visible error or documented skip, no false success | Not tested |
| ZIP export + replay | JSON points to playable audio; both sides actually audible | Not tested |

Do not mark this feature complete until the required paths pass on the user's
actual phone. An Android library or test APK build is not physical verification.
