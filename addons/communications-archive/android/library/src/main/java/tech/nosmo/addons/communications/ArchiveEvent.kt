package tech.nosmo.addons.communications

import org.json.JSONObject
import java.security.MessageDigest

/** One observed message, never a transcript concatenated from a whole notification. */
data class ArchiveEvent(
    val id: String,
    val source: String,
    val packageName: String,
    val conversation: String,
    val actor: String,
    val direction: String,
    val text: String,
    val occurredAt: Long,
    val observedAt: Long,
    val method: String,
    val evidence: String,
    val truncated: Boolean = false,
    val attachmentMime: String = "",
    val audioFile: String = "",
) {
    fun json() = JSONObject().put("schemaVersion", 1).put("id", id).put("source", source)
        .put("packageName", packageName).put("conversation", conversation).put("actor", actor)
        .put("direction", direction).put("text", text).put("occurredAt", occurredAt)
        .put("observedAt", observedAt).put("method", method).put("evidence", evidence)
        .put("truncated", truncated).put("attachmentMime", attachmentMime).put("audioFile", audioFile)

    companion object {
        const val MAX_TEXT = 65536
        fun digest(vararg parts: String): String {
            // Length prefixes prevent delimiter ambiguity, including newlines in messages.
            val hash = MessageDigest.getInstance("SHA-256")
            for (part in parts) {
                val bytes = part.toByteArray(Charsets.UTF_8)
                hash.update(java.nio.ByteBuffer.allocate(4).putInt(bytes.size).array()); hash.update(bytes)
            }
            return hash.digest().joinToString("") { "%02x".format(it) }
        }
    }
}

object ArchiveSources {
    val packages = linkedMapOf(
        "com.whatsapp" to "WhatsApp", "com.whatsapp.w4b" to "WhatsApp Business",
        "com.facebook.orca" to "Messenger", "com.instagram.android" to "Instagram",
        "com.zhiliaoapp.musically" to "TikTok", "com.ss.android.ugc.trill" to "TikTok",
    )
    fun label(packageName: String): String? = packages[packageName]
}
