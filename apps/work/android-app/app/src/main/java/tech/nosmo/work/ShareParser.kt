package tech.nosmo.work

import java.util.Locale

enum class ShareKind { JOB, CONTACT }

data class ParsedShare(
    val id: String,
    val kind: ShareKind,
    val sourceLabel: String,
    val sourceMime: String,
    val rawText: String,
    val contactName: String = "",
    val company: String = "",
    val phone: String = "",
    val email: String = "",
    val whatsapp: Boolean = false,
    val role: String = "",
    val location: String = "",
    val pay: String = "",
    val reference: String = "",
    val applicationLink: String = "",
    val note: String = "",
    val fromOcr: Boolean = false,
)

object ShareParser {
    private const val MAX_TEXT_LENGTH = 24_000
    private val emailPattern = Regex("[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}", RegexOption.IGNORE_CASE)
    private val phonePattern = Regex("(?<!\\w)(?:(?:\\+|00)44[\\s().-]*(?:\\(0\\)[\\s().-]*)?|0)(?:\\d[\\s().-]*){9,10}(?!\\w)")
    private val urlPattern = Regex("https?://[^\\s<>]+", RegexOption.IGNORE_CASE)
    private val postcodePattern = Regex("\\b[A-Z]{1,2}\\d[A-Z\\d]?\\s*\\d[A-Z]{2}\\b", RegexOption.IGNORE_CASE)
    private val payPattern = Regex("(?:£|GBP\\s*)\\s?\\d+(?:[.,]\\d{1,2})?(?:\\s*(?:-|to)\\s*(?:£|GBP\\s*)?\\s?\\d+(?:[.,]\\d{1,2})?)?(?:\\s*(?:/|per\\s+)(?:hour|hr|day|week|annum|year))?", RegexOption.IGNORE_CASE)

    fun parse(
        input: String,
        mimeType: String = "text/plain",
        sourceLabel: String = "Android Share",
        fromOcr: Boolean = false,
    ): ParsedShare {
        val raw = input.replace("\u0000", "").trim().take(MAX_TEXT_LENGTH)
        if (mimeType.contains("vcard", ignoreCase = true) || raw.contains("BEGIN:VCARD", ignoreCase = true)) {
            return parseVCard(raw, mimeType, sourceLabel)
        }

        val phone = phonePattern.find(raw)?.value?.let(::normalisePhone).orEmpty()
        val email = emailPattern.find(raw)?.value?.lowercase(Locale.UK).orEmpty()
        val role = labelledValue(raw, "role", "job title", "position", "vacancy")
        val company = labelledValue(raw, "company", "employer", "agency", "client")
        val contactName = labelledValue(raw, "name", "contact", "recruiter")
        val location = labelledValue(raw, "location", "site", "area", "postcode")
            .ifBlank { postcodePattern.find(raw)?.value?.uppercase(Locale.UK).orEmpty() }
        val pay = labelledValue(raw, "pay", "rate", "salary")
            .ifBlank { payPattern.find(raw)?.value.orEmpty() }
        val reference = labelledValue(raw, "reference", "ref", "job ref", "job id")
        val applicationLink = urlPattern.find(raw)?.value?.trimEnd('.', ',', ')', ']').orEmpty()
        val lower = raw.lowercase(Locale.UK)
        val jobSignals = listOf(
            "job", "vacancy", "position", "role:", "job title", "rate:", "salary",
            "per hour", "per day", "start date", "shift", "apply", "site address",
        ).count(lower::contains)
        val kind = if (role.isNotBlank() || pay.isNotBlank() || jobSignals >= 2) ShareKind.JOB else ShareKind.CONTACT
        val note = when {
            raw.isBlank() -> ""
            raw.length <= 2_000 -> raw
            else -> raw.take(1_997) + "..."
        }

        return ParsedShare(
            id = shareId(raw),
            kind = kind,
            sourceLabel = sourceLabel.ifBlank { "Android Share" },
            sourceMime = mimeType.ifBlank { "text/plain" },
            rawText = raw,
            contactName = contactName,
            company = company,
            phone = phone,
            email = email,
            whatsapp = lower.contains("whatsapp") || sourceLabel.contains("whatsapp", ignoreCase = true),
            role = role,
            location = location,
            pay = pay,
            reference = reference,
            applicationLink = applicationLink,
            note = note,
            fromOcr = fromOcr,
        )
    }

    fun parseVCard(
        input: String,
        mimeType: String = "text/vcard",
        sourceLabel: String = "Android Share",
    ): ParsedShare {
        val raw = input.replace("\u0000", "").trim().take(MAX_TEXT_LENGTH)
        val unfolded = raw.replace(Regex("\\r?\\n[ \\t]"), "")
        val fields = unfolded.lineSequence()
            .mapNotNull { line ->
                val separator = line.indexOf(':')
                if (separator <= 0) return@mapNotNull null
                val key = line.substring(0, separator).substringBefore(';').uppercase(Locale.UK)
                key to unescapeVCard(line.substring(separator + 1).trim())
            }
            .groupBy({ it.first }, { it.second })
        val structuredName = fields["N"]?.firstOrNull().orEmpty().split(';')
        val fallbackName = listOfNotNull(
            structuredName.getOrNull(1),
            structuredName.getOrNull(2),
            structuredName.getOrNull(0),
            structuredName.getOrNull(3),
        ).filter(String::isNotBlank).joinToString(" ")
        val phone = fields["TEL"]?.firstNotNullOfOrNull { value ->
            normalisePhone(value).takeIf(String::isNotBlank)
        }.orEmpty()
        val email = fields["EMAIL"]?.firstOrNull()?.trim()?.lowercase(Locale.UK).orEmpty()
        val note = fields["NOTE"]?.firstOrNull().orEmpty().take(2_000)

        return ParsedShare(
            id = shareId(raw),
            kind = ShareKind.CONTACT,
            sourceLabel = sourceLabel.ifBlank { "Android Share" },
            sourceMime = mimeType.ifBlank { "text/vcard" },
            rawText = raw,
            contactName = fields["FN"]?.firstOrNull().orEmpty().ifBlank { fallbackName },
            company = fields["ORG"]?.firstOrNull().orEmpty(),
            phone = phone,
            email = email,
            whatsapp = fields["X-WHATSAPP"]?.isNotEmpty() == true,
            role = fields["TITLE"]?.firstOrNull().orEmpty(),
            note = note,
        )
    }

    fun normalisePhone(value: String): String {
        var phone = value.trim().replace(Regex("[^\\d+]"), "")
        if (phone.startsWith("0044")) phone = "+44" + phone.drop(4)
        if (phone.startsWith("+440")) phone = "+44" + phone.drop(4)
        if (phone.startsWith("0") && phone.length in 10..11) phone = "+44" + phone.drop(1)
        return phone
    }

    private fun labelledValue(text: String, vararg labels: String): String {
        val joined = labels.joinToString("|") { Regex.escape(it) }
        return Regex("(?im)^\\s*(?:$joined)\\s*[:\\-]\\s*(.+?)\\s*$")
            .find(text)?.groupValues?.getOrNull(1)?.trim().orEmpty()
    }

    private fun unescapeVCard(value: String) = value
        .replace("\\n", "\n", ignoreCase = true)
        .replace("\\,", ",")
        .replace("\\;", ";")
        .replace("\\\\", "\\")

    private fun shareId(raw: String) =
        "android-${System.currentTimeMillis()}-${Integer.toHexString(raw.hashCode())}"
}
