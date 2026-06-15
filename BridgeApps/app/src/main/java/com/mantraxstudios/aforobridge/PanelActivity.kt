package com.mantraxstudios.aforobridge

import android.annotation.SuppressLint
import android.graphics.Color
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.ProgressBar
import android.widget.TextView
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import org.json.JSONObject

/**
 * Abre el panel web de SRServi (/admin/people-counter) dentro de un WebView,
 * auto-logueado: inicia sesión con las credenciales guardadas, inyecta token+usuario
 * en el localStorage del mismo origen y navega al panel. Equivale al WebView2 de la
 * app de Windows (MainForm.ApplyAuthAndNavigateAsync).
 */
class PanelActivity : AppCompatActivity() {

    private val ui = CoroutineScope(Dispatchers.Main + SupervisorJob())
    private lateinit var settings: Settings
    private lateinit var web: WebView
    private lateinit var overlay: TextView
    private lateinit var spinner: ProgressBar

    private val base by lazy { settings.serverUrl.trimEnd('/') }
    private val panelUrl by lazy { "$base/admin/people-counter" }

    private var token: String? = null
    private var userJson: String? = null
    private var injected = false

    private var webReady = false

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        supportActionBar?.hide()
        settings = Settings(this)

        val root = FrameLayout(this).apply {
            layoutParams = FrameLayout.LayoutParams(MATCH, MATCH)
            setBackgroundColor(Color.parseColor("#121212"))
        }

        try {
            web = WebView(this).apply {
                layoutParams = FrameLayout.LayoutParams(MATCH, MATCH)
            }
            web.settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                databaseEnabled = true
                useWideViewPort = true
                loadWithOverviewMode = true
                mediaPlaybackRequiresUserGesture = false
            }
            CookieManager.getInstance().setAcceptThirdPartyCookies(web, true)
            webReady = true
        } catch (_: Throwable) {
            val msg = TextView(this).apply {
                text = "No se pudo abrir el navegador.\nActualiza Android System WebView desde la Play Store."
                setTextColor(Color.parseColor("#D4AF37"))
                textSize = 16f
                gravity = Gravity.CENTER
                setPadding(dp(24), dp(24), dp(24), dp(24))
            }
            root.addView(msg)
            setContentView(root)
            return
        }

        web.webChromeClient = object : WebChromeClient() {
            // El panel pide la webcam para la vista "En Vivo"; concedemos automáticamente.
            override fun onPermissionRequest(request: PermissionRequest) {
                runOnUiThread { request.grant(request.resources) }
            }
        }

        web.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView, url: String?) {
                if (isFinishing || isDestroyed) return
                if (!injected && token != null) {
                    injected = true
                    val tk = JSONObject.quote(token)
                    val uj = JSONObject.quote(userJson ?: "")
                    view.evaluateJavascript(
                        "try{localStorage.setItem('token',$tk);" +
                            "localStorage.setItem('user',$uj);}catch(e){}"
                    ) {
                        if (!isFinishing && !isDestroyed) view.loadUrl(panelUrl)
                    }
                } else {
                    hideOverlay()
                }
            }
        }

        spinner = ProgressBar(this).apply {
            isIndeterminate = true
            layoutParams = FrameLayout.LayoutParams(WRAP, WRAP, Gravity.CENTER)
        }
        overlay = TextView(this).apply {
            text = "Abriendo tu panel…"
            setTextColor(Color.parseColor("#D4AF37"))
            textSize = 15f
            gravity = Gravity.CENTER
            setPadding(dp(24), dp(120), dp(24), dp(24))
            setBackgroundColor(Color.parseColor("#121212"))
            layoutParams = FrameLayout.LayoutParams(MATCH, MATCH)
        }

        root.addView(web)
        root.addView(overlay)
        root.addView(spinner)
        setContentView(root)

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webReady && web.canGoBack() && web.url?.contains("/admin/people-counter") == false) {
                    web.goBack()
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })

        authenticateAndLoad()
    }

    private fun authenticateAndLoad() {
        ui.launch {
            try {
                val api = Api(settings.serverUrl)
                val res = api.login(settings.email, settings.password)
                token = res.token
                userJson = res.userJson
                if (!isFinishing && !isDestroyed) web.loadUrl(base)
            } catch (e: Exception) {
                if (!isFinishing && !isDestroyed) {
                    overlay.text = "No se pudo iniciar sesión automáticamente.\nInicia sesión en el panel."
                    injected = true
                    web.loadUrl(panelUrl)
                }
            }
        }
    }

    private fun hideOverlay() {
        overlay.visibility = ViewGroup.GONE
        spinner.visibility = ViewGroup.GONE
    }

    override fun onDestroy() {
        super.onDestroy()
        ui.cancel()
        if (webReady) {
            (web.parent as? ViewGroup)?.removeView(web)
            web.stopLoading()
            web.destroy()
        }
    }

    private val MATCH = ViewGroup.LayoutParams.MATCH_PARENT
    private val WRAP = ViewGroup.LayoutParams.WRAP_CONTENT
    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()
}
