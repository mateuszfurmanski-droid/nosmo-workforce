package tech.nosmo.addons.communications

import android.content.Context
import android.content.Intent
import android.content.pm.ShortcutInfo
import android.content.pm.ShortcutManager
import android.graphics.drawable.Icon
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

object CommunicationsArchive {
    internal val executor = Executors.newSingleThreadExecutor()
    /** Called by the host. Registers a settings shortcut; collection remains OFF by default. */
    @JvmStatic fun install(context: Context) {
        runCatching {
            val shortcut = ShortcutInfo.Builder(context, "nosmo-communications-archive")
                .setShortLabel("Archiwum rozmów")
                .setLongLabel("NOSMO SYSTEM · Archiwum rozmów")
                .setIcon(Icon.createWithResource(context, android.R.drawable.ic_menu_save))
                .setIntent(Intent(context, ArchiveActivity::class.java).setAction(Intent.ACTION_VIEW))
                .build()
            context.getSystemService(ShortcutManager::class.java).addDynamicShortcuts(listOf(shortcut))
        }
        schedule(context)
    }
    @JvmStatic fun open(context: Context) {
        context.startActivity(Intent(context, ArchiveActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
    internal fun schedule(context: Context) {
        val settings = ArchiveSettings(context)
        val work = WorkManager.getInstance(context)
        if (settings.enabled && settings.recordingsTree.isNotBlank()) {
            work.enqueueUniquePeriodicWork("nosmo-communications-recordings", ExistingPeriodicWorkPolicy.KEEP,
                PeriodicWorkRequestBuilder<RecordingImportWorker>(15, TimeUnit.MINUTES).build())
        } else {
            work.cancelUniqueWork("nosmo-communications-recordings")
            work.cancelUniqueWork("nosmo-communications-recordings-now")
        }
    }
    internal fun scanNow(context: Context) {
        if (ArchiveSettings(context).enabled) WorkManager.getInstance(context).enqueueUniqueWork(
            "nosmo-communications-recordings-now", ExistingWorkPolicy.KEEP, OneTimeWorkRequestBuilder<RecordingImportWorker>().build())
    }
    internal fun record(context: Context, event: ArchiveEvent) {
        executor.execute {
            val settings = ArchiveSettings(context)
            if (!settings.allowed(event.packageName)) return@execute
            if (event.method == "visible_after_send" && !settings.outgoingEnabled) return@execute
            runCatching { ArchiveStore(context).use { it.append(event) } }.onFailure {
                settings.lastError = "Nie udało się zapisać wiadomości. Sprawdź wolne miejsce i ponownie uruchom dodatek."
            }
        }
    }
}
