package tech.nosmo.work

import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.text.Html
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.ScrollView
import android.widget.Spinner
import android.widget.TextView
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.WebSettingsCompat
import androidx.webkit.WebViewFeature
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions

class MainActivity : ComponentActivity() {
    private lateinit var webView: WebView
    private lateinit var shareQueue: NativeShareQueue
    private var pendingFiles: ValueCallback<Array<Uri>>? = null
    private var awaitingAckId: String? = null
    private var showingWeb = false

    private val filePicker = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val callback = pendingFiles ?: return@registerForActivityResult
        val data = result.data
        val uris = when {
            result.resultCode != RESULT_OK -> null
            data?.clipData != null -> Array(data.clipData!!.itemCount) { data.clipData!!.getItemAt(it).uri }
            data?.data != null -> arrayOf(data.data!!)
            else -> null
        }
        callback.onReceiveValue(uris)
        pendingFiles = null
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowCompat.getInsetsController(window, window.decorView).apply {
            isAppearanceLightStatusBars = false
            isAppearanceLightNavigationBars = false
        }
        shareQueue = NativeShareQueue(this)
        webView = WebView(this).apply {
            setBackgroundColor(Color.BLACK)
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = false
            settings.allowContentAccess = true
            if (WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING)) {
                WebSettingsCompat.setAlgorithmicDarkeningAllowed(settings, false)
            }
            addJavascriptInterface(AndroidBridge(), "NosmoAndroid")
            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                    val uri = request.url
                    return if (uri.host == APP_HOST && uri.scheme == "https") {
                        false
                    } else {
                        openOutside(uri)
                        true
                    }
                }

                override fun onPageStarted(view: WebView, url: String, favicon: android.graphics.Bitmap?) {
                    awaitingAckId = null
                }

                override fun onPageFinished(view: WebView, url: String) {
                    if (Uri.parse(url).host == APP_HOST) flushPendingShares()
                }
            }
            webChromeClient = object : WebChromeClient() {
                override fun onShowFileChooser(
                    webView: WebView,
                    filePathCallback: ValueCallback<Array<Uri>>,
                    fileChooserParams: FileChooserParams,
                ): Boolean {
                    pendingFiles?.onReceiveValue(null)
                    pendingFiles = filePathCallback
                    val pickerIntent = runCatching { fileChooserParams.createIntent() }.getOrElse {
                        Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                            addCategory(Intent.CATEGORY_OPENABLE)
                            type = "*/*"
                        }
                    }
                    filePicker.launch(pickerIntent)
                    return true
                }
            }
        }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                when {
                    !showingWeb -> showWebApp()
                    webView.canGoBack() -> webView.goBack()
                    else -> finish()
                }
            }
        })

        if (!handleShareIntent(intent)) showWebApp()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        if (!handleShareIntent(intent)) showWebApp()
    }

    private fun handleShareIntent(incoming: Intent): Boolean {
        if (incoming.action != Intent.ACTION_SEND) return false
        val mimeType = incoming.type.orEmpty()
        val source = sourceLabel(incoming)
        return when {
            mimeType.startsWith("image/") -> {
                val uri = sharedStream(incoming)
                if (uri == null) {
                    Toast.makeText(this, "The shared image could not be opened.", Toast.LENGTH_LONG).show()
                    false
                } else {
                    recogniseImage(uri, mimeType, source)
                    true
                }
            }
            mimeType.contains("vcard", ignoreCase = true) -> {
                val raw = readSharedText(incoming)
                showReview(ShareParser.parseVCard(raw, mimeType, source))
                true
            }
            mimeType.startsWith("text/") || incoming.hasExtra(Intent.EXTRA_TEXT) -> {
                val raw = readSharedText(incoming)
                showReview(ShareParser.parse(raw, mimeType.ifBlank { "text/plain" }, source))
                true
            }
            else -> false
        }
    }

    private fun recogniseImage(uri: Uri, mimeType: String, source: String) {
        showOcrProgress()
        val image = runCatching { InputImage.fromFilePath(this, uri) }.getOrElse {
            Toast.makeText(this, "The shared image could not be read.", Toast.LENGTH_LONG).show()
            showWebApp()
            return
        }
        val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
        recognizer.process(image)
            .addOnSuccessListener { result ->
                showReview(ShareParser.parse(result.text, mimeType, source, fromOcr = true))
            }
            .addOnFailureListener {
                Toast.makeText(this, "No text was recognised. You can enter the details manually.", Toast.LENGTH_LONG).show()
                showReview(ShareParser.parse("", mimeType, source, fromOcr = true))
            }
            .addOnCompleteListener { recognizer.close() }
    }

    private fun showOcrProgress() {
        showingWeb = false
        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(dp(28), dp(28), dp(28), dp(28))
            setBackgroundColor(Color.rgb(247, 248, 250))
        }
        container.addView(ProgressBar(this))
        container.addView(TextView(this).apply {
            text = "Reading the selected image on this device..."
            textSize = 16f
            setTextColor(Color.rgb(31, 41, 55))
            gravity = Gravity.CENTER
            setPadding(0, dp(18), 0, 0)
        })
        setContentView(withSystemBarInsets(container))
    }

    private fun showReview(share: ParsedShare) {
        showingWeb = false
        val fields = mutableMapOf<String, EditText>()
        val content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(24), dp(20), dp(32))
            setBackgroundColor(Color.rgb(247, 248, 250))
        }
        content.addView(TextView(this).apply {
            text = "NOSMO WORK · SHARE REVIEW"
            textSize = 12f
            setTextColor(Color.rgb(47, 111, 223))
        })
        content.addView(TextView(this).apply {
            text = "Check before saving"
            textSize = 26f
            setTextColor(Color.rgb(17, 24, 39))
            setPadding(0, dp(4), 0, dp(4))
        })
        content.addView(TextView(this).apply {
            text = "Received from ${share.sourceLabel}. Nothing is saved until you press Save to NOSMO."
            textSize = 14f
            setTextColor(Color.rgb(75, 85, 99))
            setPadding(0, 0, 0, dp(18))
        })

        val kindSpinner = Spinner(this).apply {
            adapter = ArrayAdapter(
                this@MainActivity,
                android.R.layout.simple_spinner_dropdown_item,
                listOf("Job / work offer", "Work contact"),
            )
            setSelection(if (share.kind == ShareKind.JOB) 0 else 1)
        }
        addLabel(content, "Save as")
        content.addView(kindSpinner, fieldLayout())

        fun field(key: String, label: String, value: String, lines: Int = 1) {
            addLabel(content, label)
            fields[key] = EditText(this).apply {
                setText(value)
                setTextColor(Color.rgb(17, 24, 39))
                setBackgroundColor(Color.WHITE)
                setPadding(dp(12), dp(10), dp(12), dp(10))
                setSingleLine(lines == 1)
                minLines = lines
                maxLines = if (lines == 1) 1 else 8
            }
            content.addView(fields.getValue(key), fieldLayout())
        }

        field("contactName", "Contact name", share.contactName)
        field("company", "Company or agency", share.company)
        field("phone", "Phone", share.phone)
        field("email", "Email", share.email)
        field("role", "Role / job title", share.role)
        field("location", "Location", share.location)
        field("pay", "Pay / rate", share.pay)
        field("reference", "Reference", share.reference)
        field("applicationLink", "Application link", share.applicationLink)
        field("note", if (share.fromOcr) "OCR text and notes — correct anything uncertain" else "Original text and notes", share.note, 5)

        content.addView(TextView(this).apply {
            text = if (share.fromOcr) {
                "OCR suggestions can be wrong. The original image is not retained. Review every field before saving."
            } else {
                "NOSMO does not read the source app, send a reply or add anything to your phone contacts."
            }
            textSize = 12f
            setTextColor(Color.rgb(107, 114, 128))
            setPadding(0, dp(12), 0, dp(16))
        })

        val actions = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.END
        }
        actions.addView(Button(this).apply {
            text = "Cancel"
            setOnClickListener { showWebApp() }
        })
        actions.addView(Button(this).apply {
            text = "Save to NOSMO"
            setTextColor(Color.WHITE)
            setBackgroundColor(Color.rgb(47, 111, 223))
            setOnClickListener {
                val confirmed = share.copy(
                    kind = if (kindSpinner.selectedItemPosition == 0) ShareKind.JOB else ShareKind.CONTACT,
                    contactName = fields.getValue("contactName").text.toString().trim(),
                    company = fields.getValue("company").text.toString().trim(),
                    phone = ShareParser.normalisePhone(fields.getValue("phone").text.toString()),
                    email = fields.getValue("email").text.toString().trim().lowercase(),
                    role = fields.getValue("role").text.toString().trim(),
                    location = fields.getValue("location").text.toString().trim(),
                    pay = fields.getValue("pay").text.toString().trim(),
                    reference = fields.getValue("reference").text.toString().trim(),
                    applicationLink = fields.getValue("applicationLink").text.toString().trim(),
                    note = fields.getValue("note").text.toString().trim(),
                )
                val hasUsefulDetail = if (confirmed.kind == ShareKind.CONTACT) {
                    listOf(confirmed.contactName, confirmed.company, confirmed.phone, confirmed.email).any(String::isNotBlank)
                } else {
                    listOf(confirmed.role, confirmed.company, confirmed.location, confirmed.note).any(String::isNotBlank)
                }
                if (!hasUsefulDetail) {
                    Toast.makeText(this@MainActivity, "Add at least one useful detail before saving.", Toast.LENGTH_LONG).show()
                    return@setOnClickListener
                }
                shareQueue.enqueue(confirmed)
                awaitingAckId = null
                showWebApp()
            }
        }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
            marginStart = dp(10)
        })
        content.addView(actions)

        setContentView(withSystemBarInsets(ScrollView(this).apply { addView(content) }))
    }

    private fun addLabel(parent: LinearLayout, label: String) {
        parent.addView(TextView(this).apply {
            text = label
            textSize = 12f
            setTextColor(Color.rgb(55, 65, 81))
            setPadding(0, dp(11), 0, dp(5))
        })
    }

    private fun fieldLayout() = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        LinearLayout.LayoutParams.WRAP_CONTENT,
    )

    private fun showWebApp() {
        showingWeb = true
        (webView.parent as? ViewGroup)?.removeView(webView)
        setContentView(withSystemBarInsets(webView))
        if (webView.url == null) webView.loadUrl(APP_URL) else flushPendingShares()
    }

    private fun withSystemBarInsets(content: View): FrameLayout {
        return FrameLayout(this).apply {
            setBackgroundColor(Color.BLACK)
            addView(
                content,
                FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT,
                ),
            )
            ViewCompat.setOnApplyWindowInsetsListener(this) { view, windowInsets ->
                val bars = windowInsets.getInsets(
                    WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout(),
                )
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom)
                WindowInsetsCompat.CONSUMED
            }
            ViewCompat.requestApplyInsets(this)
        }
    }

    private fun flushPendingShares() {
        if (!showingWeb || awaitingAckId != null || webView.url?.let { Uri.parse(it).host } != APP_HOST) return
        val item = shareQueue.peek() ?: return
        val id = item.optString("id")
        val script = """
            (function () {
              if (typeof window.__NOSMO_RECEIVE_NATIVE_SHARE__ !== "function") return "waiting";
              window.__NOSMO_RECEIVE_NATIVE_SHARE__(${item});
              return "sent";
            })();
        """.trimIndent()
        webView.evaluateJavascript(script) { result ->
            if (result == "\"sent\"") {
                if (shareQueue.peek()?.optString("id") == id) {
                    awaitingAckId = id
                } else {
                    awaitingAckId = null
                    webView.postDelayed({ flushPendingShares() }, 400)
                }
            } else {
                webView.postDelayed({ flushPendingShares() }, 750)
            }
        }
    }

    private fun readSharedText(incoming: Intent): String {
        val subject = incoming.getStringExtra(Intent.EXTRA_SUBJECT).orEmpty().trim()
        val direct = incoming.getCharSequenceExtra(Intent.EXTRA_TEXT)?.toString().orEmpty().trim()
        val html = incoming.getStringExtra(Intent.EXTRA_HTML_TEXT).orEmpty()
        val body = direct.ifBlank {
            if (html.isBlank()) "" else Html.fromHtml(html, Html.FROM_HTML_MODE_LEGACY).toString().trim()
        }
        val sharedText = listOf(subject, body).filter(String::isNotBlank).distinct().joinToString("\n")
        if (sharedText.isNotBlank()) return sharedText.take(MAX_SHARED_TEXT)
        val uri = sharedStream(incoming) ?: return ""
        return runCatching {
            contentResolver.openInputStream(uri)?.bufferedReader()?.use { reader ->
                val buffer = CharArray(MAX_SHARED_TEXT)
                val count = reader.read(buffer)
                if (count > 0) String(buffer, 0, count) else ""
            }.orEmpty()
        }.getOrDefault("")
    }

    @Suppress("DEPRECATION")
    private fun sharedStream(incoming: Intent): Uri? =
        incoming.getParcelableExtra(Intent.EXTRA_STREAM) ?: incoming.clipData?.getItemAt(0)?.uri

    @Suppress("DEPRECATION")
    private fun sourceLabel(incoming: Intent): String {
        val explicitReferrer = incoming.getParcelableExtra<Uri>(Intent.EXTRA_REFERRER)?.host
            ?: incoming.getStringExtra(Intent.EXTRA_REFERRER_NAME)?.let { runCatching { Uri.parse(it).host }.getOrNull() }
        val packageName = explicitReferrer ?: callingPackage ?: referrer?.host
        val applicationName = packageName?.let { name ->
            runCatching {
                packageManager.getApplicationLabel(packageManager.getApplicationInfo(name, 0)).toString()
            }.getOrNull()
        }
        return applicationName ?: when {
            packageName?.contains("whatsapp", ignoreCase = true) == true -> "WhatsApp"
            packageName?.contains("gmail", ignoreCase = true) == true -> "Gmail"
            packageName?.contains("messag", ignoreCase = true) == true -> "Messages"
            else -> "Android Share"
        }
    }

    private fun openOutside(uri: Uri): Boolean {
        return try {
            startActivity(Intent(Intent.ACTION_VIEW, uri))
            true
        } catch (_: ActivityNotFoundException) {
            Toast.makeText(this, "No app is available to open this link.", Toast.LENGTH_SHORT).show()
            true
        }
    }

    inner class AndroidBridge {
        @JavascriptInterface
        fun ackShare(id: String) {
            runOnUiThread {
                shareQueue.acknowledge(id)
                if (awaitingAckId == id) awaitingAckId = null
                webView.postDelayed({ flushPendingShares() }, 400)
            }
        }
    }

    override fun onDestroy() {
        pendingFiles?.onReceiveValue(null)
        pendingFiles = null
        webView.removeJavascriptInterface("NosmoAndroid")
        webView.stopLoading()
        webView.destroy()
        super.onDestroy()
    }

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()

    companion object {
        private const val APP_HOST = "mateusz-furmanski-job-hub.mateusz-furmanski.chatgpt.site"
        private const val APP_URL = "https://$APP_HOST"
        private const val MAX_SHARED_TEXT = 24_000
    }
}
