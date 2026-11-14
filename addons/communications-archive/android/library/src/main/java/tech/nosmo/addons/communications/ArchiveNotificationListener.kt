package tech.nosmo.addons.communications

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

/** Live events only. Collection requires master and per-source opt-in. */
class ArchiveNotificationListener : NotificationListenerService() {
    override fun onListenerConnected() { connected = true }
    override fun onListenerDisconnected() { connected = false }
    override fun onDestroy() { connected = false; super.onDestroy() }
    override fun onNotificationPosted(sbn: StatusBarNotification) {
        if (!ArchiveSettings(this).allowed(sbn.packageName)) return
        runCatching {
            NotificationEvents.parse(sbn, System.currentTimeMillis()).forEach { CommunicationsArchive.record(this, it) }
        }.onFailure { ArchiveSettings(this).lastError = "Nie udało się odczytać jednego z powiadomień. Kopia może być niepełna." }
    }
    companion object { @Volatile var connected = false; private set }
}
