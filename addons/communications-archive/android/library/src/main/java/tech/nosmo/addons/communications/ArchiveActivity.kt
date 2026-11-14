package tech.nosmo.addons.communications

import android.app.AlertDialog
import android.content.ComponentName
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import android.telecom.TelecomManager
import android.widget.Button
import android.widget.CheckBox
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.app.NotificationManagerCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import java.text.DateFormat
import java.util.Date

class ArchiveActivity : ComponentActivity() {
    private lateinit var content: LinearLayout
    private lateinit var status: TextView
    private val settings by lazy { ArchiveSettings(this) }
    private val recordingFolder = registerForActivityResult(ActivityResultContracts.OpenDocumentTree()) { uri ->
        if (uri != null) {
            runCatching {
                val previous = settings.recordingsTree
                contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
                settings.recordingsTree = uri.toString()
                if (previous.isNotBlank() && previous != uri.toString()) runCatching {
                    contentResolver.releasePersistableUriPermission(Uri.parse(previous), Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
                CommunicationsArchive.schedule(this); CommunicationsArchive.scanNow(this)
            }.onFailure { settings.lastError = "Nie można zachować dostępu do wybranego folderu." }
            refresh()
        }
    }
    private val exporter = registerForActivityResult(ActivityResultContracts.CreateDocument("application/zip")) { uri ->
        if (uri != null) CommunicationsArchive.executor.execute {
            runCatching {
                synchronized(RecordingImportWorker.importLock) {
                    ArchiveStore(this).use { store ->
                        contentResolver.openOutputStream(uri, "w")?.use { store.export(it) } ?: error("Output unavailable")
                    }
                }
            }.onSuccess { runOnUiThread { message("Eksport zapisany.") } }.onFailure {
                // A failed ZIP must never look like a complete export.
                runCatching { android.provider.DocumentsContract.deleteDocument(contentResolver, uri) }
                runOnUiThread { message("Eksport nie został ukończony. Spróbuj ponownie.") }
            }
        }
    }
    override fun onCreate(savedInstanceState: Bundle?) { super.onCreate(savedInstanceState); render() }
    override fun onResume() {
        super.onResume()
        if (::status.isInitialized) refresh()
        CommunicationsArchive.scanNow(this)
    }
    private fun render() {
        content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL; setPadding(24, 24, 24, 40); setBackgroundColor(Color.rgb(18, 21, 25))
        }
        val scroll = ScrollView(this).apply { addView(content) }
        ViewCompat.setOnApplyWindowInsetsListener(scroll) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom); insets
        }
        setContentView(scroll)
        label("NOSMO SYSTEM · Archiwum rozmów", 24f)
        label("Opcjonalny dodatek. Dane pozostają na tym urządzeniu i są szyfrowane. Archiwum jest wspólne dla tego urządzenia, niezależne od konta w witrynie. Włączenie nie udostępnia danych agencji ani stronie internetowej.")
        toggle("Zapisuj dostępne wiadomości i importuj nagrania", settings.enabled) { enabled ->
            settings.enabled = enabled
            CommunicationsArchive.schedule(this)
            if (enabled) {
                android.service.notification.NotificationListenerService.requestRebind(ComponentName(this, ArchiveNotificationListener::class.java))
                CommunicationsArchive.scanNow(this)
            }
            refresh()
        }
        label("Wybierz aplikacje. Powiadomienia mogą zawierać tylko fragment wiadomości. Wyciszone rozmowy, ukryta treść i brak powiadomień powodują luki. Żadna aplikacja nie ma tutaj gwarancji pełnej kopii.")
        ArchiveSources.packages.forEach { (packageName, name) ->
            toggle(name + if (packageName == "com.ss.android.ugc.trill") " (wariant regionalny)" else "", settings.sourceEnabled(packageName)) {
                settings.setSource(packageName, it); refresh()
            }
        }
        action("Dostęp do powiadomień") { open(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)) }
        label("Wysłane wiadomości · tryb eksperymentalny", 20f)
        label("Opcjonalny odczyt widocznego ekranu wybranych aplikacji. Zapis dopiero po kliknięciu Wyślij, opróżnieniu pola i pojawieniu się nowego tekstu w tej samej rozmowie. Nie potwierdza dostarczenia. Zmiana interfejsu, języka lub brak dostępnego tytułu rozmowy może zatrzymać zapis. Szkice nie są zapisywane.")
        toggle("Włącz test zapisu wysłanych wiadomości", settings.outgoingEnabled) { settings.outgoingEnabled = it; refresh() }
        action("Włącz usługę w ustawieniach dostępności") { open(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)) }
        label("Rozmowy telefoniczne", 20f)
        label("Nagrywanie obu stron zapewnia funkcja telefonu, jeżeli jest dostępna. W aplikacji Telefon ustaw: Nagrywanie połączeń → Automatycznie → Wszystkie (również nieznane numery). Ten dodatek nie potrafi włączyć tej funkcji ani potwierdzić jakości nagrania.")
        action("Otwórz ustawienia połączeń") { open(Intent(TelecomManager.ACTION_SHOW_CALL_SETTINGS)) }
        action("Wybierz folder nagrań Samsunga") { recordingFolder.launch(null) }
        action("Importuj dostępne nagrania teraz") { CommunicationsArchive.scanNow(this); message("Zlecono import; odśwież status po zakończeniu.") }
        label("Automatyczny import nagrań: przy otwarciu dodatku oraz zadaniem systemowym co najmniej co 15 minut; system może go opóźnić. Plik musi być niezmieniany od minuty. Limit pojedynczego nagrania: 256 MiB. Import obejmuje pliki audio bezpośrednio w wybranym folderze.")
        status = label("Sprawdzanie statusu…")
        action("Odśwież status") { refresh() }
        action("Eksportuj ZIP: JSONL + nagrania") {
            AlertDialog.Builder(this).setTitle("Eksport odszyfrowanych danych")
                .setMessage("Wybrany plik ZIP będzie zawierać czytelne wiadomości i nagrania. Wskaż miejsce, w którym chcesz go zachować.")
                .setPositiveButton("Wybierz miejsce") { _, _ -> exporter.launch("NOSMO-communications-${System.currentTimeMillis()}.zip") }
                .setNegativeButton("Anuluj", null).show()
        }
        action("Usuń lokalne archiwum") {
            AlertDialog.Builder(this).setMessage("Usunąć zapisane kopie wiadomości i nagrań? Oryginały w aplikacjach pozostaną dostępne.")
                .setPositiveButton("Usuń") { _, _ ->
                    settings.enabled = false; settings.outgoingEnabled = false; CommunicationsArchive.schedule(this)
                    CommunicationsArchive.executor.execute {
                        runCatching { synchronized(RecordingImportWorker.importLock) { ArchiveStore(this).use { it.clear() } } }
                            .onSuccess { runOnUiThread { recreate() } }
                            .onFailure { runOnUiThread { message("Usuwanie nie zostało ukończone.") } }
                    }
                }.setNegativeButton("Anuluj", null).show()
        }
        action("Wróć do NOSMO") { finish() }
        refresh()
    }
    private fun refresh() {
        CommunicationsArchive.executor.execute {
            val countAndLatest = runCatching { ArchiveStore(this).use { it.count() to it.latest() } }
            runOnUiThread {
                if (isFinishing || isDestroyed) return@runOnUiThread
                val access = NotificationManagerCompat.getEnabledListenerPackages(this).contains(packageName)
                val latest = countAndLatest.getOrNull()?.second?.takeIf { it > 0 }?.let { DateFormat.getDateTimeInstance().format(Date(it)) } ?: "brak"
                status.text = "Zapis: ${if (settings.enabled) "włączony" else "wyłączony"}\n" +
                    "Dostęp do powiadomień aplikacji: ${if (access) "przyznany" else "brak"}\n" +
                    "Połączenie kolektora: ${ArchiveNotificationListener.connected}\n" +
                    "Obserwacja wysłanych: ${if (settings.outgoingEnabled && OutgoingObservationService.connected) "test aktywny · kompletność niepotwierdzona" else "nieaktywna"}\n" +
                    "Nagrywanie połączeń: konfiguracja i test w aplikacji Telefon\n" +
                    "Folder nagrań: ${if (settings.recordingsTree.isBlank()) "niewybrany" else "wybrany"}\n" +
                    "Zapisane zdarzenia: ${countAndLatest.getOrNull()?.first ?: "błąd odczytu"}\nOstatni zapis: $latest\n${settings.lastError}"
            }
        }
    }
    private fun label(value: String, size: Float = 16f): TextView = TextView(this).apply {
        text = value; textSize = size; setTextColor(Color.WHITE); setPadding(0, 12, 0, 12); content.addView(this)
    }
    private fun toggle(title: String, checked: Boolean, changed: (Boolean) -> Unit) {
        content.addView(CheckBox(this).apply {
            text = title; setTextColor(Color.WHITE); isChecked = checked
            setOnCheckedChangeListener { _, value -> changed(value) }
        })
    }
    private fun action(title: String, clicked: () -> Unit) {
        content.addView(Button(this).apply { text = title; setOnClickListener { clicked() } })
    }
    private fun open(intent: Intent) { runCatching { startActivity(intent) }.onFailure { message("Brak tej funkcji w ustawieniach telefonu.") } }
    private fun message(value: String) { if (!isFinishing && !isDestroyed) AlertDialog.Builder(this).setMessage(value).setPositiveButton("OK", null).show() }
}
