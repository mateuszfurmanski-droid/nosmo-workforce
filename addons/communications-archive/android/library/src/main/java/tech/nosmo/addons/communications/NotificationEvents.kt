package tech.nosmo.addons.communications

import android.app.Notification
import android.service.notification.StatusBarNotification
import androidx.core.app.NotificationCompat

internal object NotificationEvents {
    fun parse(sbn: StatusBarNotification, now: Long): List<ArchiveEvent> {
        val source = ArchiveSources.label(sbn.packageName) ?: return emptyList()
        val notification = sbn.notification
        if (notification.flags and (Notification.FLAG_ONGOING_EVENT or Notification.FLAG_GROUP_SUMMARY) != 0) return emptyList()
        val result = mutableListOf<ArchiveEvent>()
        val style = NotificationCompat.MessagingStyle.extractMessagingStyleFromNotification(notification)
        if (style != null && style.messages.isNotEmpty()) {
            val thread = style.conversationTitle?.toString().orEmpty().ifBlank {
                notification.extras.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty()
            }
            // Identical text is still a separate event when its source timestamp differs.
            val ordinals = mutableMapOf<String, Int>()
            for (message in style.messages) {
                val original = message.text?.toString().orEmpty()
                if (original.isBlank() && message.dataMimeType.isNullOrEmpty()) continue
                val person = message.person
                val self = person == null || (style.user.key != null && style.user.key == person.key)
                val actor = if (self) "self" else person?.name?.toString().orEmpty()
                val direction = if (self) "outgoing_observed" else "incoming"
                val timestamp = message.timestamp.takeIf { it > 0 } ?: sbn.postTime
                val base = ArchiveEvent.digest(sbn.packageName, sbn.key, thread, actor, direction, timestamp.toString(), original, message.dataMimeType.orEmpty())
                val ordinal = ordinals.getOrDefault(base, 0)
                ordinals[base] = ordinal + 1
                result.add(ArchiveEvent(
                    ArchiveEvent.digest(base, ordinal.toString()), source, sbn.packageName, thread, actor, direction,
                    original.take(ArchiveEvent.MAX_TEXT), timestamp, now, "notification_message",
                    if (message.timestamp > 0) "source_message_timestamp" else "notification_post_timestamp",
                    original.length > ArchiveEvent.MAX_TEXT, message.dataMimeType.orEmpty(),
                ))
            }
            return result
        }
        if (notification.flags and Notification.FLAG_GROUP_SUMMARY != 0 || notification.category != Notification.CATEGORY_MESSAGE) return emptyList()
        val extras = notification.extras
        val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty()
        val original = extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString()
            ?.takeIf { it.isNotBlank() } ?: extras.getCharSequence(Notification.EXTRA_TEXT)?.toString().orEmpty()
        if (title.isBlank() || original.isBlank()) return emptyList()
        // A preview is explicitly marked unknown: it may be a summary, not one complete message.
        result.add(ArchiveEvent(
            ArchiveEvent.digest(sbn.packageName, sbn.key, title, original, sbn.postTime.toString()),
            source, sbn.packageName, title, title, "unknown", original.take(ArchiveEvent.MAX_TEXT), sbn.postTime, now,
            "notification_preview", "preview_only_not_proven_complete_message", original.length > ArchiveEvent.MAX_TEXT,
        ))
        return result
    }
}
