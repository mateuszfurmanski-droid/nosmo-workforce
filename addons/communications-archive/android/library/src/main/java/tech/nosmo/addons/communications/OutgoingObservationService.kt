package tech.nosmo.addons.communications

import android.accessibilityservice.AccessibilityService
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

/** Experimental observation of visible UI, never a private database reader or delivery receipt. */
class OutgoingObservationService : AccessibilityService() {
    private val observer = SendObservation()
    private val handler = Handler(Looper.getMainLooper())
    private var lastComposer: SendObservation.Snapshot? = null
    private var composerAt = 0L
    private val expire = Runnable { observer.cancel(); lastComposer = null }
    override fun onServiceConnected() { connected = true }
    override fun onInterrupt() { observer.cancel(); lastComposer = null }
    override fun onDestroy() { connected = false; handler.removeCallbacksAndMessages(null); observer.cancel(); super.onDestroy() }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        event ?: return
        val packageName = event.packageName?.toString().orEmpty()
        val settings = ArchiveSettings(this)
        if (!settings.outgoingEnabled || !settings.allowed(packageName)) { observer.cancel(); lastComposer = null; return }
        val root = rootInActiveWindow ?: return
        if (root.packageName?.toString() != packageName) { observer.cancel(); lastComposer = null; return }
        if (event.eventType == AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED) {
            val current = snapshot(root, packageName) ?: return
            if (current.composer.isNotBlank() && current.composer.length <= ArchiveEvent.MAX_TEXT) {
                // Only the latest value lives briefly in RAM; no keystroke history is retained.
                lastComposer = current.copy(occurrences = mapOf(current.composer to current.occurrences.getOrDefault(current.composer, 0)))
                composerAt = SystemClock.elapsedRealtime()
                handler.removeCallbacks(expire); handler.postDelayed(expire, 10000)
            }
            return
        }
        if (event.eventType == AccessibilityEvent.TYPE_VIEW_CLICKED && isSend(event.source)) {
            val current = snapshot(root, packageName) ?: run { observer.cancel(); lastComposer = null; return }
            val cached = lastComposer?.takeIf {
                SystemClock.elapsedRealtime() - composerAt in 0L..10000L && it.packageName == current.packageName && it.conversation == current.conversation
            }
            val before = current.takeIf { it.composer.isNotBlank() } ?: cached ?: return
            observer.clicked(before, SystemClock.elapsedRealtime(), System.currentTimeMillis())
            lastComposer = null
            handler.removeCallbacks(expire); handler.postDelayed(expire, 10000)
            observer.changed(current, SystemClock.elapsedRealtime())?.let(::save)
        } else if (event.eventType == AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED || event.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            val after = snapshot(root, packageName) ?: run { observer.cancel(); return }
            val observed = observer.changed(after, SystemClock.elapsedRealtime()) ?: return
            save(observed)
        }
    }
    private fun save(observed: SendObservation.Observed) {
            CommunicationsArchive.record(this, ArchiveEvent(
                ArchiveEvent.digest(observed.packageName, observed.conversation, observed.text, observed.clickedAt.toString(), "visible_after_send"),
                ArchiveSources.label(observed.packageName) ?: return, observed.packageName, observed.conversation, "self", "outgoing_observed",
                observed.text, observed.clickedAt, System.currentTimeMillis(), "visible_after_send",
                "send_click_then_new_visible_text_not_delivery_confirmation",
            ))
    }
    private fun isSend(source: AccessibilityNodeInfo?): Boolean {
        var node = source
        repeat(3) {
            val current = node ?: return false
            val labels = listOf(current.contentDescription?.toString().orEmpty(), current.text?.toString().orEmpty())
            if (labels.any { it.trim().lowercase(java.util.Locale.ROOT) in sendLabels }) return true
            node = current.parent
        }
        return false
    }
    private fun snapshot(root: AccessibilityNodeInfo, packageName: String): SendObservation.Snapshot? {
        val nodes = mutableListOf<AccessibilityNodeInfo>()
        fun visit(node: AccessibilityNodeInfo, depth: Int) {
            if (nodes.size >= 2000 || depth > 40 || !node.isVisibleToUser || node.isPassword) return
            nodes.add(node)
            for (i in 0 until node.childCount) node.getChild(i)?.let { visit(it, depth + 1) }
        }
        visit(root, 0)
        val composers = nodes.filter { it.isEditable && !it.isPassword }
        if (composers.size != 1) return null
        val composer = composers.single()
        val titles = nodes.filter {
            val id = it.viewIdResourceName.orEmpty().substringAfter(":id/")
            id in setOf("conversation_contact_name", "thread_title", "thread_name", "action_bar_title") ||
                (Build.VERSION.SDK_INT >= 28 && it.isHeading)
        }.mapNotNull { it.text?.toString()?.takeIf(String::isNotBlank) }.distinct()
        // An unknown/ambiguous chat title stops capture rather than assigning the wrong recipient.
        if (titles.size != 1) return null
        val counts = nodes.filter { it !== composer && !it.isEditable }.mapNotNull { it.text?.toString() }
            .groupingBy { it }.eachCount()
        return SendObservation.Snapshot(packageName, titles.single(), composer.text?.toString().orEmpty(), counts)
    }
    companion object {
        private val sendLabels = setOf("send", "send message", "wyślij", "wyslij", "wyślij wiadomość", "wyslij wiadomosc")
        @Volatile var connected = false; private set
    }
}
