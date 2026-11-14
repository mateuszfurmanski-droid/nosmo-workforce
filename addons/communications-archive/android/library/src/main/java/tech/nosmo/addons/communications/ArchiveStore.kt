package tech.nosmo.addons.communications

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import org.json.JSONObject
import java.io.File
import java.io.OutputStream
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream
import javax.crypto.CipherInputStream

/** Separate device-local archive. No account tokens, network client or automatic cloud upload. */
class ArchiveStore(context: Context, private val cipher: ArchiveCipher = ArchiveCipher()) :
    SQLiteOpenHelper(context, "nosmo-communications-archive.db", null, 1) {
    val audioDirectory = File(context.noBackupFilesDir, "communications-audio").apply { mkdirs() }
    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL("CREATE TABLE events (id TEXT PRIMARY KEY, observed_at INTEGER NOT NULL, payload BLOB NOT NULL)")
    }
    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) = Unit
    fun append(event: ArchiveEvent): Boolean {
        val values = ContentValues().apply {
            put("id", event.id); put("observed_at", event.observedAt)
            put("payload", cipher.encrypt(event.json().toString().toByteArray(Charsets.UTF_8)))
        }
        return writableDatabase.insertWithOnConflict("events", null, values, SQLiteDatabase.CONFLICT_IGNORE) != -1L
    }
    fun contains(id: String): Boolean = readableDatabase.rawQuery("SELECT 1 FROM events WHERE id=?", arrayOf(id)).use { it.moveToFirst() }
    fun count(): Long = readableDatabase.rawQuery("SELECT COUNT(*) FROM events", null).use { it.moveToFirst(); it.getLong(0) }
    fun latest(): Long = readableDatabase.rawQuery("SELECT COALESCE(MAX(observed_at),0) FROM events", null).use { it.moveToFirst(); it.getLong(0) }
    fun clear() {
        writableDatabase.delete("events", null, null)
        audioDirectory.listFiles().orEmpty().forEach { check(it.delete()) }
    }
    /** Caller owns the output stream. ZIP is decrypted only into the user-selected destination. */
    fun export(output: OutputStream) {
        ZipOutputStream(output).use { zip ->
            zip.putNextEntry(ZipEntry("messages-and-recordings.jsonl"))
            val audio = linkedMapOf<String, String>()
            readableDatabase.rawQuery("SELECT payload FROM events ORDER BY observed_at,id", null).use { rows ->
                while (rows.moveToNext()) {
                    val plain = cipher.decrypt(rows.getBlob(0))
                    val record = JSONObject(String(plain, Charsets.UTF_8))
                    record.optString("audioFile").takeIf { it.matches(Regex("[a-f0-9]{64}\\.bin")) }?.let { name ->
                        val extension = when (record.optString("attachmentMime")) {
                            "audio/mp4", "audio/x-m4a" -> "m4a"
                            "audio/mpeg" -> "mp3"
                            "audio/wav", "audio/x-wav" -> "wav"
                            "audio/ogg" -> "ogg"
                            "audio/3gpp" -> "3gp"
                            "audio/amr" -> "amr"
                            "audio/aac" -> "aac"
                            "audio/flac" -> "flac"
                            else -> "audio"
                        }
                        val exported = "audio/${name.removeSuffix(".bin")}.$extension"
                        audio[name] = exported
                        record.put("audioFile", exported)
                    }
                    zip.write(record.toString().toByteArray(Charsets.UTF_8)); zip.write('\n'.code)
                }
            }
            zip.closeEntry()
            for ((name, exported) in audio) {
                zip.putNextEntry(ZipEntry(exported))
                File(audioDirectory, name).inputStream().use { input ->
                    val iv = ByteArray(12)
                    java.io.DataInputStream(input).readFully(iv)
                    CipherInputStream(input, cipher.decryptionCipher(iv)).use { it.copyTo(zip) }
                }
                zip.closeEntry()
            }
        }
    }
}
