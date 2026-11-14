package tech.nosmo.addons.communications

import android.app.Notification
import android.content.Context
import android.service.notification.StatusBarNotification
import androidx.core.app.NotificationCompat
import androidx.core.app.Person
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class NotificationEventsTest {
    private val context: Context get() = RuntimeEnvironment.getApplication()
    private fun status(notification: Notification, packageName: String = "com.whatsapp") = StatusBarNotification(
        packageName, packageName, 1, "thread", 1000, 0, 0, notification, android.os.Process.myUserHandle(), 5000,
    )
    @Test fun capturesSeparateMessagesAndSelfMessagesWithoutFlatteningLines() {
        val self = Person.Builder().setName("Me").setKey("self").build()
        val other = Person.Builder().setName("Andre").setKey("other").build()
        val style = NotificationCompat.MessagingStyle(self).setConversationTitle("Andre")
            .addMessage("one\ntwo", 1000, other)
            .addMessage("reply", 1001, null as Person?)
            .addMessage("reply", 1002, null as Person?)
        val notification = NotificationCompat.Builder(context, "messages").setSmallIcon(android.R.drawable.ic_dialog_email).setStyle(style).build()
        val events = NotificationEvents.parse(status(notification), 6000)
        assertEquals(3, events.size)
        assertEquals("one\ntwo", events[0].text)
        assertEquals("incoming", events[0].direction)
        assertEquals("outgoing_observed", events[1].direction)
        assertNotEquals(events[1].id, events[2].id)
        assertEquals(events.map { it.id }, NotificationEvents.parse(status(notification), 7000).map { it.id })
    }
    @Test fun previewIsLabelledUnknownAndGroupSummariesAreIgnored() {
        val notification = NotificationCompat.Builder(context, "messages").setSmallIcon(android.R.drawable.ic_dialog_email)
            .setCategory(Notification.CATEGORY_MESSAGE).setContentTitle("Andre").setContentText("preview").build()
        val event = NotificationEvents.parse(status(notification), 6000).single()
        assertEquals("unknown", event.direction)
        assertEquals("notification_preview", event.method)
        notification.flags = notification.flags or Notification.FLAG_GROUP_SUMMARY
        assertTrue(NotificationEvents.parse(status(notification), 6000).isEmpty())
    }
    @Test fun nonMessageNotificationsAndNonSelectedServicesAreNotParsedAsChat() {
        val notification = NotificationCompat.Builder(context, "social").setSmallIcon(android.R.drawable.ic_dialog_email)
            .setContentTitle("New follower").setContentText("Someone followed you").build()
        assertTrue(NotificationEvents.parse(status(notification, "com.instagram.android"), 6000).isEmpty())
        assertTrue(NotificationEvents.parse(status(notification, "com.example.bank"), 6000).isEmpty())
    }
}
