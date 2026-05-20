package com.mantraxstudios.srservituuorders

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.webkit.ConsoleMessage
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import org.json.JSONArray
import org.json.JSONObject

class WebViewActivity : ComponentActivity() {

    private lateinit var webView: WebView

    private val paymentLauncher: ActivityResultLauncher<Intent> =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            val data = result.data
            val obj = when (result.resultCode) {
                Activity.RESULT_OK -> {
                    val json = runCatching { JSONObject(data?.getStringExtra("transactionResult") ?: "") }.getOrDefault(JSONObject())
                    JSONObject().apply {
                        put("approved", json.optBoolean("transactionStatus", false))
                        put("sequenceNumber", json.optString("sequenceNumber", ""))
                        put("amount", json.optInt("amount", 0))
                    }
                }
                else -> JSONObject().apply {
                    put("approved", false)
                    put("errorMessage", "Pago cancelado")
                }
            }
            webView.post {
                webView.evaluateJavascript("window.onTuuPaymentResult&&window.onTuuPaymentResult($obj)", null)
            }
        }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        webView = WebView(this).also { wv ->
            wv.settings.javaScriptEnabled = true
            wv.settings.domStorageEnabled = true
            wv.settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            wv.webChromeClient = object : WebChromeClient() {
                override fun onConsoleMessage(msg: ConsoleMessage): Boolean {
                    val text = "[${msg.sourceId()}:${msg.lineNumber()}] ${msg.message()}"
                    when (msg.messageLevel()) {
                        ConsoleMessage.MessageLevel.ERROR   -> Log.e("WebView", text)
                        ConsoleMessage.MessageLevel.WARNING -> Log.w("WebView", text)
                        else                                -> Log.d("WebView", text)
                    }
                    return true
                }
            }
            wv.webViewClient = object : WebViewClient() {
                override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
                    Log.d("WebView", ">>> CARGANDO: $url")
                }
                override fun onPageFinished(view: WebView?, url: String?) {
                    Log.d("WebView", ">>> TERMINÓ: $url")
                    view?.evaluateJavascript("window.AndroidBridgeAvailable=true;", null)
                }
                override fun onReceivedHttpError(view: WebView?, request: android.webkit.WebResourceRequest?, errorResponse: android.webkit.WebResourceResponse?) {
                    Log.e("WebView", ">>> HTTP ERROR ${errorResponse?.statusCode} → ${request?.url}")
                }
                override fun onReceivedError(view: WebView?, request: android.webkit.WebResourceRequest?, error: android.webkit.WebResourceError?) {
                    Log.e("WebView", ">>> ERROR ${error?.errorCode} ${error?.description} → ${request?.url}")
                }
            }
            wv.addJavascriptInterface(Bridge(), "AndroidBridge")
            CookieManager.getInstance().setAcceptThirdPartyCookies(wv, true)
        }

        setContentView(webView)

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) webView.goBack() else moveTaskToBack(true)
            }
        })

        val prefs = getSharedPreferences("srservi_prefs", MODE_PRIVATE)
        val code  = prefs.getString("store_code", "")?.trim() ?: ""
        val url   = if (code.isNotEmpty())
            "https://srservi2.srautomatic.com/store/$code?tuumodepay=true"
        else
            "https://srservi2.srautomatic.com"
        webView.loadUrl(url)
    }

    inner class Bridge {
        @JavascriptInterface fun isAndroid() = true

        @JavascriptInterface
        fun processTuuPayment(amount: Int, method: Int, orderRef: String) {
            val payload = JSONObject().apply {
                put("amount", amount); put("tip", -1); put("cashback", -1)
                put("method", method); put("installmentsQuantity", if (method == 1) 0 else -1)
                put("printVoucherOnApp", true); put("dteType", 33)
                put("extraData", JSONObject().apply {
                    put("exemptAmount", 0); put("netAmount", amount)
                    put("sourceName", "SRServi"); put("sourceVersion", "1.0.0")
                    put("customFields", JSONArray().apply {
                        put(JSONObject().apply { put("name","Orden"); put("value",orderRef); put("print",true) })
                    })
                })
            }
            val pkg = listOf("com.haulmer.paymentapp","com.haulmer.paymentapp.dev")
                .firstOrNull { packageManager.getLaunchIntentForPackage(it) != null }
                ?: run {
                    val err = JSONObject().apply { put("approved",false); put("errorMessage","TUU no instalada") }
                    webView.post { webView.evaluateJavascript("window.onTuuPaymentResult&&window.onTuuPaymentResult($err)", null) }
                    return
                }
            val launchIntent = packageManager.getLaunchIntentForPackage(pkg) ?: run {
                val err = JSONObject().apply { put("approved",false); put("errorMessage","TUU no instalada") }
                webView.post { webView.evaluateJavascript("window.onTuuPaymentResult&&window.onTuuPaymentResult($err)", null) }
                return
            }
            launchIntent.action = Intent.ACTION_SEND
            launchIntent.flags = 0
            launchIntent.type = "text/json"
            launchIntent.putExtra(Intent.EXTRA_TEXT, payload.toString())
            launchIntent.putExtra("paymentData", payload.toString())

            // JavascriptInterface runs on a background thread — launch must be on the UI thread
            runOnUiThread {
                try {
                    paymentLauncher.launch(launchIntent)
                } catch (e: Exception) {
                    Log.e("WebView", "Error lanzando TUU: ${e.message}")
                    val err = JSONObject().apply { put("approved",false); put("errorMessage","Error al abrir TUU: ${e.message}") }
                    webView.post { webView.evaluateJavascript("window.onTuuPaymentResult&&window.onTuuPaymentResult($err)", null) }
                }
            }
        }
    }
}
