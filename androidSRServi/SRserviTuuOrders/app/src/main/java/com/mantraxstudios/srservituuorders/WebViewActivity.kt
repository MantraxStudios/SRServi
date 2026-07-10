package com.mantraxstudios.srservituuorders

import android.animation.ObjectAnimator
import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import android.util.Log
import android.view.Gravity
import android.view.View
import android.view.animation.DecelerateInterpolator
import android.webkit.ConsoleMessage
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import org.json.JSONArray
import org.json.JSONObject

class WebViewActivity : ComponentActivity() {

    private lateinit var webView: WebView
    private lateinit var loadingOverlay: LinearLayout
    private lateinit var progressBar: ProgressBar
    private lateinit var progressText: TextView

    private val paymentLauncher: ActivityResultLauncher<Intent> =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            val data = result.data
            Log.d("TUU_PAYMENT", "========== RESULTADO PAGO ==========")
            Log.d("TUU_PAYMENT", "resultCode: ${result.resultCode} (RESULT_OK=${Activity.RESULT_OK})")
            Log.d("TUU_PAYMENT", "data extras: ${data?.extras?.keySet()?.joinToString { "$it=${data.extras?.get(it)}" }}")
            val rawTransaction = data?.getStringExtra("transactionResult")
            Log.d("TUU_PAYMENT", "transactionResult RAW: $rawTransaction")
            val json = runCatching { JSONObject(rawTransaction ?: "") }.getOrNull()
            Log.d("TUU_PAYMENT", "transactionResult PARSED: $json")
            val approved = json?.optBoolean("transactionStatus", false) == true
            val obj = if (approved) {
                JSONObject().apply {
                    put("approved", true)
                    put("sequenceNumber", json!!.optString("sequenceNumber", ""))
                    put("amount", json.optInt("amount", 0))
                }
            } else {
                Log.w("TUU_PAYMENT", "Pago NO aprobado o cancelado (resultCode=${result.resultCode})")
                JSONObject().apply {
                    put("approved", false)
                    put("errorMessage", "Pago cancelado")
                }
            }
            Log.d("TUU_PAYMENT", "Objeto enviado al WebView: $obj")
            Log.d("TUU_PAYMENT", "====================================")
            webView.post {
                webView.evaluateJavascript("window.onTuuPaymentResult&&window.onTuuPaymentResult($obj)", null)
            }
        }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val gold = Color.parseColor("#D4AF37")
        val container = FrameLayout(this)

        webView = WebView(this).also { wv ->
            wv.settings.javaScriptEnabled = true
            wv.settings.domStorageEnabled = true
            wv.settings.databaseEnabled = true
            wv.settings.cacheMode = WebSettings.LOAD_DEFAULT
            wv.settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            wv.settings.allowContentAccess = true
            wv.settings.allowFileAccess = true
            wv.webChromeClient = object : WebChromeClient() {
                override fun onProgressChanged(view: WebView?, newProgress: Int) {
                    progressBar.progress = newProgress
                    progressText.text = "$newProgress%"
                    if (newProgress >= 100) hideLoadingOverlay()
                }
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
                    hideLoadingOverlay()
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

        loadingOverlay = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.BLACK)
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )

            val logo = TextView(this@WebViewActivity).apply {
                text = "SRServi"
                setTextColor(gold)
                textSize = 32f
                gravity = Gravity.CENTER
                typeface = android.graphics.Typeface.DEFAULT_BOLD
            }
            addView(logo, LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { bottomMargin = 48 })

            val subtitle = TextView(this@WebViewActivity).apply {
                text = "Cargando tienda..."
                setTextColor(Color.WHITE)
                textSize = 16f
                gravity = Gravity.CENTER
            }
            addView(subtitle, LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { bottomMargin = 32 })

            progressBar = ProgressBar(this@WebViewActivity, null, android.R.attr.progressBarStyleHorizontal).apply {
                max = 100
                progress = 0
                progressDrawable.setColorFilter(gold, android.graphics.PorterDuff.Mode.SRC_IN)
            }
            val density = resources.displayMetrics.density
            addView(progressBar, LinearLayout.LayoutParams(
                (280 * density).toInt(),
                (6 * density).toInt()
            ).apply { bottomMargin = 16 })

            progressText = TextView(this@WebViewActivity).apply {
                text = "0%"
                setTextColor(Color.WHITE)
                textSize = 14f
                gravity = Gravity.CENTER
            }
            addView(progressText)
        }

        container.addView(webView, FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ))
        container.addView(loadingOverlay)

        setContentView(container)

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

    private fun showLoadingOverlay() {
        loadingOverlay.visibility = View.VISIBLE
    }

    private fun hideLoadingOverlay() {
        if (loadingOverlay.visibility != View.VISIBLE) return
        loadingOverlay.animate()
            .alpha(0f)
            .setDuration(300)
            .withEndAction {
                loadingOverlay.visibility = View.GONE
                loadingOverlay.alpha = 1f
            }
            .start()
    }

    inner class Bridge {
        @JavascriptInterface fun isAndroid() = true

        @JavascriptInterface
        fun processTuuPayment(amount: Int, method: Int, orderRef: String) {
            Log.d("TUU_PAYMENT", "========== INICIO PAGO ==========")
            Log.d("TUU_PAYMENT", "amount: $amount | method: $method | orderRef: $orderRef")
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
            val pkg = listOf("com.haulmer.paymentapp.dev")
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
            Log.d("TUU_PAYMENT", "Payload enviado a TUU: $payload")
            Log.d("TUU_PAYMENT", "Package: $pkg")
            Log.d("TUU_PAYMENT", "===================================")
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
