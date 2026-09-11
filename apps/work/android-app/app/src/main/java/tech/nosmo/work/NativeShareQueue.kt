package tech.nosmo.work

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

class NativeShareQueue(context: Context) {
    private val preferences = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)

    fun enqueue(share: ParsedShare) {
        val existing = readAll().filterNot { it.optString("id") == share.id }.toMutableList()
        existing.add(toJson(share))
        writeAll(existing.takeLast(MAX_ITEMS))
    }

    fun peek(): JSONObject? = readAll().firstOrNull()

    fun acknowledge(id: String) {
        if (id.isBlank()) return
        writeAll(readAll().filterNot { it.optString("id") == id })
    }

    private fun readAll(): List<JSONObject> = runCatching {
        val array = JSONArray(preferences.getString(KEY_QUEUE, "[]"))
        (0 until array.length()).mapNotNull(array::optJSONObject)
    }.getOrDefault(emptyList())

    private fun writeAll(items: List<JSONObject>) {
        val array = JSONArray()
        items.forEach(array::put)
        preferences.edit().putString(KEY_QUEUE, array.toString()).apply()
    }

    private fun toJson(share: ParsedShare) = JSONObject().apply {
        put("id", share.id)
        put("kind", share.kind.name.lowercase())
        put("sourceLabel", share.sourceLabel)
        put("sourceMime", share.sourceMime)
        put("rawText", share.rawText)
        put("contactName", share.contactName)
        put("company", share.company)
        put("phone", share.phone)
        put("email", share.email)
        put("whatsapp", share.whatsapp)
        put("role", share.role)
        put("location", share.location)
        put("pay", share.pay)
        put("reference", share.reference)
        put("applicationLink", share.applicationLink)
        put("note", share.note)
        put("fromOcr", share.fromOcr)
    }

    companion object {
        private const val PREFERENCES = "nosmo-native-share"
        private const val KEY_QUEUE = "confirmed-items"
        private const val MAX_ITEMS = 20
    }
}
