package tech.nosmo.addons.communications

import org.junit.Assert.*
import org.junit.Test

class SendObservationTest {
    private fun snapshot(composer: String = "Hello", count: Int = 0, chat: String = "Andre", app: String = "com.whatsapp") =
        SendObservation.Snapshot(app, chat, composer, mapOf("Hello" to count))
    @Test fun clickAloneDoesNotPersistAnything() {
        val observation = SendObservation()
        observation.clicked(snapshot(), 100, 12345)
        assertNull(observation.changed(snapshot(), 200))
    }
    @Test fun emptiedComposerWithoutNewBubbleDoesNotCountAsSent() {
        val observation = SendObservation(); observation.clicked(snapshot(), 100, 12345)
        assertNull(observation.changed(snapshot(composer = ""), 200))
    }
    @Test fun exactNewTextInSameChatCreatesOneObservation() {
        val observation = SendObservation(); observation.clicked(snapshot(), 100, 12345)
        val after = snapshot(composer = "", count = 1)
        assertEquals("Hello", observation.changed(after, 200)?.text)
        assertNull(observation.changed(after, 300))
    }
    @Test fun repeatedTextRequiresAnAdditionalOccurrence() {
        val observation = SendObservation(); observation.clicked(snapshot(count = 1), 100, 12345)
        assertNull(observation.changed(snapshot(composer = "", count = 1), 200))
        assertNotNull(observation.changed(snapshot(composer = "", count = 2), 300))
    }
    @Test fun changingChatCancelsTheCandidate() {
        val observation = SendObservation(); observation.clicked(snapshot(), 100, 12345)
        assertNull(observation.changed(snapshot(composer = "", count = 1, chat = "Someone else"), 200))
        assertNull(observation.changed(snapshot(composer = "", count = 1), 300))
    }
    @Test fun timeoutAndPauseDiscardTheCandidate() {
        val observation = SendObservation(); observation.clicked(snapshot(), 100, 12345)
        assertNull(observation.changed(snapshot(composer = "", count = 1), 10101))
        observation.clicked(snapshot(), 20000, 12346); observation.cancel()
        assertNull(observation.changed(snapshot(composer = "", count = 1), 20001))
    }
    @Test fun unknownConversationAndOversizedDraftAreNeverCaptured() {
        val observation = SendObservation(); observation.clicked(snapshot(chat = ""), 100, 12345)
        assertNull(observation.changed(snapshot(composer = "", count = 1, chat = ""), 200))
        observation.clicked(snapshot(composer = "x".repeat(ArchiveEvent.MAX_TEXT + 1)), 100, 12345)
        assertNull(observation.changed(snapshot(composer = "", count = 1), 200))
    }
}
