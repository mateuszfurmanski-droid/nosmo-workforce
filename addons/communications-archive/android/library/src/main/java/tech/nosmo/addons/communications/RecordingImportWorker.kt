package tech.nosmo.addons.communications

import android.content.Context
import android.net.Uri
import androidx.documentfile.provider.DocumentFile
import androidx.work.Worker
import androidx.work.WorkerParameters
import java.io.File
import javax.crypto.CipherOutputStream

/** Imports stable audio files from one user-granted directory. Does not record the microphone. */
class RecordingImportWorker(context: Context, parameters: WorkerParameters) : Worker(context, parameters) {
    override fun doWork(): Result = synchronized(importLock) {
        val settings = ArchiveSettings(applicationContext)
        if (!settings.enabled || settings.recordingsTree.isBlank()) return@synchronized Result.success()
        val selectedTree = settings.recordingsTree
        try {
            val tree = DocumentFile.fromTreeUri(applicationContext, Uri.parse(selectedTree))
                ?: error("Recording folder unavailable")
            check(tree.canRead())
            val cipher = ArchiveCipher()
            ArchiveStore(applicationContext, cipher).use { store ->
                for (document in tree.listFiles()) {
                    if (isStopped || !settings.enabled || settings.recordingsTree != selectedTree) break
                    if (!document.isFile || !document.type.orEmpty().startsWith("audio/")) continue
                    val size = document.length()
                    val modified = document.lastModified()
                    // Unknown age, actively changing files and oversized recordings remain unimported.
                    if (size <= 0 || size > MAX_BYTES || modified <= 0 || System.currentTimeMillis() - modified < 60000) continue
                    val id = ArchiveEvent.digest("recording", document.uri.toString(), size.toString(), modified.toString())
                    if (store.contains(id)) continue
                    val target = File(store.audioDirectory, "$id.bin")
                    val temporary = File(store.audioDirectory, "$id.partial")
                    try {
                        val encryption = cipher.encryptionCipher()
                        temporary.outputStream().use { output ->
                            output.write(encryption.iv)
                            CipherOutputStream(output, encryption).use { encrypted ->
                                applicationContext.contentResolver.openInputStream(document.uri)?.use { input ->
                                    val buffer = ByteArray(65536)
                                    var readTotal = 0L
                                    while (true) {
                                        if (isStopped || !settings.enabled || settings.recordingsTree != selectedTree) error("Import paused")
                                        val read = input.read(buffer)
                                        if (read < 0) break
                                        readTotal += read
                                        check(readTotal <= size && readTotal <= MAX_BYTES)
                                        encrypted.write(buffer, 0, read)
                                    }
                                    check(readTotal == size)
                                } ?: error("Cannot open recording")
                            }
                        }
                        if (document.length() != size || document.lastModified() != modified || !settings.enabled || settings.recordingsTree != selectedTree || isStopped) continue
                        check(temporary.renameTo(target))
                        val event = ArchiveEvent(id, "System call recording", "", "", "", "call_recording",
                            document.name.orEmpty(), modified, System.currentTimeMillis(), "user_selected_recording_folder",
                            "audio_file_import_not_proof_of_two_sided_recording", attachmentMime = document.type.orEmpty(), audioFile = target.name)
                        try { if (!store.append(event)) target.delete() } catch (error: Exception) { target.delete(); throw error }
                    } finally { temporary.delete() }
                }
            }
            settings.recordingError = ""
            Result.success()
        } catch (_: SecurityException) {
            settings.recordingError = "Brak dostępu do folderu nagrań. Wybierz go ponownie."
            Result.failure()
        } catch (_: Exception) {
            if (settings.enabled && !isStopped && settings.recordingsTree == selectedTree) settings.recordingError = "Import nagrań nie powiódł się. Sprawdź folder i wolne miejsce."
            if (runAttemptCount < 2) Result.retry() else Result.failure()
        }
    }
    companion object {
        internal val importLock = Any()
        const val MAX_BYTES = 256L * 1024 * 1024
    }
}
