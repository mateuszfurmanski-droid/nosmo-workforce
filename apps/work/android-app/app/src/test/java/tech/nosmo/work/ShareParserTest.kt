package tech.nosmo.work

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ShareParserTest {
    @Test
    fun normalisesCommonUkPhoneFormats() {
        assertEquals("+447700900123", ShareParser.normalisePhone("07700 900123"))
        assertEquals("+447700900123", ShareParser.normalisePhone("0044 7700 900123"))
        assertEquals("+447700900123", ShareParser.normalisePhone("+44 (0)7700 900123"))
    }

    @Test
    fun extractsAJobOfferFromSharedText() {
        val result = ShareParser.parse(
            """
                Job title: Fire Door Joiner
                Company: North Build Ltd
                Location: Leeds LS10 1AB
                Rate: £22/hour
                Contact: Sarah Jones
                Call 07700 900123 or email jobs@example.co.uk
                Apply: https://example.co.uk/jobs/42
                Ref: FD-42
            """.trimIndent(),
            sourceLabel = "WhatsApp",
        )

        assertEquals(ShareKind.JOB, result.kind)
        assertEquals("Fire Door Joiner", result.role)
        assertEquals("North Build Ltd", result.company)
        assertEquals("+447700900123", result.phone)
        assertEquals("jobs@example.co.uk", result.email)
        assertEquals("FD-42", result.reference)
        assertTrue(result.whatsapp)
    }

    @Test
    fun unfoldsAndParsesVCardWithoutCrashingOnUnknownLines() {
        val result = ShareParser.parseVCard(
            """
                BEGIN:VCARD
                VERSION:3.0
                FN:Alex
                 Smith
                ORG:Build Recruitment
                TITLE:Recruiter
                TEL;TYPE=CELL:07700 900123
                EMAIL:Alex.Smith@example.com
                BROKEN LINE
                END:VCARD
            """.trimIndent(),
        )

        assertEquals(ShareKind.CONTACT, result.kind)
        assertEquals("Alex Smith", result.contactName)
        assertEquals("Build Recruitment", result.company)
        assertEquals("+447700900123", result.phone)
        assertEquals("alex.smith@example.com", result.email)
        assertEquals("Recruiter", result.role)
    }

    @Test
    fun marksOcrAsAnEditableSuggestion() {
        val result = ShareParser.parse("Phone 07700 900123", "image/png", "Android Share", fromOcr = true)
        assertTrue(result.fromOcr)
        assertEquals("+447700900123", result.phone)
    }
}
