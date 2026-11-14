package tech.nosmo.addons.communications

import android.content.Context

class ArchiveSettings(context: Context) {
    private val prefs = context.getSharedPreferences("nosmo-communications-addon", Context.MODE_PRIVATE)
    var enabled: Boolean
        get() = prefs.getBoolean("enabled", false)
        set(value) { check(prefs.edit().putBoolean("enabled", value).commit()) }
    var outgoingEnabled: Boolean
        get() = prefs.getBoolean("outgoing", false)
        set(value) { check(prefs.edit().putBoolean("outgoing", value).commit()) }
    var recordingsTree: String
        get() = prefs.getString("recordingsTree", "").orEmpty()
        set(value) { check(prefs.edit().putString("recordingsTree", value).commit()) }
    var lastError: String
        get() = prefs.getString("lastError", "").orEmpty()
        set(value) { prefs.edit().putString("lastError", value).apply() }
    fun allowed(packageName: String) = enabled && ArchiveSources.label(packageName) != null && prefs.getBoolean("source:$packageName", false)
    fun sourceEnabled(packageName: String) = prefs.getBoolean("source:$packageName", false)
    fun setSource(packageName: String, value: Boolean) {
        require(ArchiveSources.label(packageName) != null)
        check(prefs.edit().putBoolean("source:$packageName", value).commit())
    }
}
