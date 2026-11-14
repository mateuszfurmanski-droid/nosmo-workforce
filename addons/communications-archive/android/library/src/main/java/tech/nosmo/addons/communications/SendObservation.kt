package tech.nosmo.addons.communications

/** RAM-only candidate. Never persists typing, drafts, send clicks or delivery assumptions. */
class SendObservation {
    data class Snapshot(val packageName: String, val conversation: String, val composer: String, val occurrences: Map<String, Int>)
    data class Observed(val packageName: String, val conversation: String, val text: String, val clickedAt: Long)
    private data class Pending(val before: Snapshot, val started: Long, val wallTime: Long)
    private var pending: Pending? = null
    fun cancel() { pending = null }
    fun clicked(before: Snapshot, elapsed: Long, wallTime: Long) {
        pending = if (before.conversation.isNotBlank() && before.composer.isNotBlank() && before.composer.length <= ArchiveEvent.MAX_TEXT)
            Pending(before, elapsed, wallTime) else null
    }
    fun changed(after: Snapshot, elapsed: Long): Observed? {
        val value = pending ?: return null
        if (elapsed - value.started !in 0L..10000L || after.packageName != value.before.packageName || after.conversation != value.before.conversation) {
            cancel(); return null
        }
        val text = value.before.composer
        if (after.composer.isNotBlank() || after.occurrences.getOrDefault(text, 0) <= value.before.occurrences.getOrDefault(text, 0)) return null
        cancel()
        return Observed(after.packageName, after.conversation, text, value.wallTime)
    }
}
