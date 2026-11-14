package tech.nosmo.addons.communications

import android.content.Context
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import java.io.ByteArrayOutputStream
import java.util.zip.ZipInputStream
import javax.crypto.KeyGenerator

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class ArchiveStoreTest {
    private fun cipher() = ArchiveCipher(KeyGenerator.getInstance("AES").apply { init(256) }.generateKey())
    private fun message(at: Long, text: String = "Hello\nsecond line") = ArchiveEvent(
        ArchiveEvent.digest("com.whatsapp", "Andre", text, at.toString()), "WhatsApp", "com.whatsapp", "Andre",
        "self", "outgoing_observed", text, at, at, "notification_message", "source_message_timestamp",
    )
    @Test fun replayIsDeduplicatedButRepeatedMessagesAtDifferentTimesRemainSeparate() {
        val context: Context = RuntimeEnvironment.getApplication()
        context.deleteDatabase("nosmo-communications-archive.db")
        ArchiveStore(context, cipher()).use { store ->
            assertTrue(store.append(message(100)))
            assertFalse(store.append(message(100)))
            assertTrue(store.append(message(101)))
            assertEquals(2L, store.count())
            val output = ByteArrayOutputStream(); store.export(output)
            val text = ZipInputStream(output.toByteArray().inputStream()).use { zip -> zip.nextEntry; zip.readBytes().toString(Charsets.UTF_8) }
            val records = text.trimEnd().lines().map(::JSONObject)
            assertEquals(2, records.size)
            assertEquals("Hello\nsecond line", records.first().getString("text"))
        }
    }
    @Test fun messagePayloadIsEncryptedAndTamperingFailsAuthentication() {
        val cipher = cipher()
        val plain = "Private conversation".toByteArray()
        val encrypted = cipher.encrypt(plain)
        assertFalse(encrypted.toString(Charsets.UTF_8).contains("Private conversation"))
        assertArrayEquals(plain, cipher.decrypt(encrypted))
        encrypted[encrypted.lastIndex] = (encrypted.last().toInt() xor 1).toByte()
        assertTrue(runCatching { cipher.decrypt(encrypted) }.isFailure)
    }
    @Test fun sourceCollectionRequiresBothMasterAndPerAppOptIn() {
        val context: Context = RuntimeEnvironment.getApplication()
        context.getSharedPreferences("nosmo-communications-addon", Context.MODE_PRIVATE).edit().clear().commit()
        val settings = ArchiveSettings(context)
        assertFalse(settings.enabled); assertFalse(settings.outgoingEnabled)
        settings.setSource("com.whatsapp", true)
        assertFalse(settings.allowed("com.whatsapp"))
        settings.enabled = true
        assertTrue(settings.allowed("com.whatsapp"))
        assertFalse(settings.allowed("com.facebook.orca"))
        assertFalse(settings.allowed("com.example.bank"))
        settings.enabled = false
        assertFalse(settings.allowed("com.whatsapp"))
    }
    @Test fun identitiesAreNotAmbiguousAcrossFieldBoundaries() {
        assertNotEquals(ArchiveEvent.digest("a|b", "c"), ArchiveEvent.digest("a", "b|c"))
    }
    @Test fun exportedAudioPathResolvesToTheActualDecryptedZipEntry() {
        val context: Context = RuntimeEnvironment.getApplication()
        context.deleteDatabase("nosmo-communications-archive.db")
        val cipher = cipher()
        ArchiveStore(context, cipher).use { store ->
            val name = "a".repeat(64) + ".bin"
            val sample = "synthetic audio bytes".toByteArray()
            java.io.File(store.audioDirectory, name).writeBytes(cipher.encrypt(sample))
            assertTrue(store.append(message(200).copy(audioFile = name, attachmentMime = "audio/mp4")))
            val output = ByteArrayOutputStream(); store.export(output)
            val entries = linkedMapOf<String, ByteArray>()
            ZipInputStream(output.toByteArray().inputStream()).use { zip ->
                while (true) { val entry = zip.nextEntry ?: break; entries[entry.name] = zip.readBytes() }
            }
            val record = JSONObject(entries.getValue("messages-and-recordings.jsonl").toString(Charsets.UTF_8).trim())
            assertArrayEquals(sample, entries.getValue(record.getString("audioFile")))
            store.clear()
            assertEquals(0L, store.count())
            assertTrue(store.audioDirectory.listFiles().orEmpty().isEmpty())
        }
    }
}
