package com.mantraxstudios.srservituuorders

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import org.json.JSONArray
import org.json.JSONObject

class WebViewActivity : ComponentActivity() {

    companion object {
        private const val TUU_PKG_PROD = "com.haulmer.paymentapp"
        private const val TUU_PKG_DEV  = "com.haulmer.paymentapp.dev"
        private const val BASE_URL = "https://srservi2.srautomatic.com"
    }

    private lateinit var webView: WebView

    private val paymentLauncher: ActivityResultLauncher<Intent> =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            val data = result.data
            val resultObj: JSONObject = when (result.resultCode) {
                Activity.RESULT_OK -> {
                    val txJson = data?.getStringExtra("transactionResult")
                    val tx = runCatching { JSONObject(txJson ?: "") }.getOrDefault(JSONObject())
                    JSONObject().apply {
                        put("approved", tx.optBoolean("transactionStatus", false))
                        put("sequenceNumber", tx.optString("sequenceNumber", ""))
                        put("responseCode", tx.optString("responseCode", ""))
                        put("cardBrand", tx.optString("cardBrand", ""))
                        put("last4", tx.optString("last4Digits", ""))
                        put("amount", tx.optInt("amount", 0))
                    }
                }
                Activity.RESULT_CANCELED -> {
                    val errJson = data?.getStringExtra("transactionResult")
                    val err = runCatching { JSONObject(errJson ?: "") }.getOrDefault(JSONObject())
                    JSONObject().apply {
                        put("approved", false)
                        put("cancelled", true)
                        put("errorCode", err.optString("errorCode", ""))
                        put("errorMessage", err.optString("errorMessage", "Pago cancelado"))
                    }
                }
                else -> JSONObject().apply {
                    put("approved", false)
                    put("errorMessage", "Resultado desconocido")
                }
            }

            webView.post {
                webView.evaluateJavascript(
                    "window.onTuuPaymentResult && window.onTuuPaymentResult($resultObj)",
                    null
                )
            }
        }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        webView = WebView(this).apply {
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                setSupportZoom(false)
                builtInZoomControls = false
                displayZoomControls = false
                useWideViewPort = true
                loadWithOverviewMode = true
                // Permite cargar contenido mixto seguro
                mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
            }

            webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView?, url: String?) {
                    // Inyectar bandera de disponibilidad del puente Android
                    view?.evaluateJavascript(
                        "window.AndroidBridgeAvailable = true;",
                        null
                    )
                }
            }

            addJavascriptInterface(TuuBridge(), "AndroidBridge")
        }

        setContentView(webView)

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) webView.goBack()
                else finish()
            }
        })

        val url = buildStoreUrl()
        webView.loadUrl(url)
    }

    private fun buildStoreUrl(): String {
        val prefs = getSharedPreferences("srservi_prefs", MODE_PRIVATE)
        val code = prefs.getString("store_code", "")?.trim() ?: ""
        return if (code.isNotEmpty())
            "$BASE_URL/store/$code?tuumodepay=true"
        else
            BASE_URL
    }

    inner class TuuBridge {

        @JavascriptInterface
        fun isAndroid(): Boolean = true

        /**
         * La web llama este método para cobrar con el terminal TUU local.
         * method: 1 = crédito, 2 = débito
         * orderRef: número/referencia de la orden para imprimir en el voucher
         */
        @JavascriptInterface
        fun processTuuPayment(amount: Int, method: Int, orderRef: String) {
            val installments = if (method == 1) 0 else -1

            val payload = JSONObject().apply {
                put("amount", amount)
                put("tip", -1)
                put("cashback", -1)
                put("method", method)
                put("installmentsQuantity", installments)
                put("printVoucherOnApp", true)
                put("dteType", 33)
                put("extraData", JSONObject().apply {
                    put("exemptAmount", 0)
                    put("netAmount", amount)
                    put("sourceName", "SRServi")
                    put("sourceVersion", "1.0.0")
                    put("customFields", JSONArray().apply {
                        put(JSONObject().apply {
                            put("name", "Orden")
                            put("value", orderRef)
                            put("print", true)
                        })
                    })
                })
            }

            val tuuPkg = listOf(TUU_PKG_PROD, TUU_PKG_DEV).firstOrNull {
                packageManager.getLaunchIntentForPackage(it) != null
            }

            if (tuuPkg == null) {
                val error = JSONObject().apply {
                    put("approved", false)
                    put("errorMessage", "App TUU no instalada en este dispositivo")
                }
                webView.post {
                    webView.evaluateJavascript(
                        "window.onTuuPaymentResult && window.onTuuPaymentResult($error)",
                        null
                    )
                }
                return
            }

            val launchIntent = packageManager.getLaunchIntentForPackage(tuuPkg)!!.apply {
                action = Intent.ACTION_SEND
                flags = 0
                type = "text/json"
                putExtra(Intent.EXTRA_TEXT, payload.toString())
                putExtra("paymentData", payload.toString())
            }

            paymentLauncher.launch(launchIntent)
        }

        @JavascriptInterface
        fun closeWebView() {
            runOnUiThread { finish() }
        }
    }
}
