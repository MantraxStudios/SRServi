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

class PanelActivity : AppCompatActivity() {

    private val ui = CoroutineScope(Dispatchers.Main + SupervisorJob())
    private lateinit var settings: Settings
    private var web: WebView? = null
    private var overlay: TextView? = null
    private var spinner: ProgressBar? = null

    private val base by lazy { settings.serverUrl.trimEnd('/') }
    private val panelUrl by lazy { "$base/admin/people-counter" }

    private var token: String? = null
    private var userJson: String? = null
    private var injected = false

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        try {
            setupUI()
        } catch (e: Throwable) {
            showFatalError("Error al abrir el panel:\n${e::class.simpleName}: ${e.message}")
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupUI() {
        supportActionBar?.hide()
        settings = Settings(this)

        val root = FrameLayout(this).apply {
            layoutParams = FrameLayout.LayoutParams(MATCH, MATCH)
            setBackgroundColor(Color.parseColor("#121212"))
        }

        val wv: WebView
        try {
            wv = WebView(this).apply {
                layoutParams = FrameLayout.LayoutParams(MATCH, MATCH)
            }
            wv.settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                @Suppress("DEPRECATION")
                databaseEnabled = true
                useWideViewPort = true
                loadWithOverviewMode = true
                mediaPlaybackRequiresUserGesture = false
            }
            try {
                CookieManager.getInstance().setAcceptThirdPartyCookies(wv, true)
            } catch (_: Throwable) { }
        } catch (e: Throwable) {
            showFatalError("No se pudo abrir el navegador.\nActualiza Android System WebView desde la Play Store.\n\n${e::class.simpleName}: ${e.message}")
            return
        }
        web = wv

        wv.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                try { runOnUiThread { request.grant(request.resources) } } catch (_: Throwable) { }
            }
        }

        wv.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView, url: String?) {
                try {
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
                } catch (_: Throwable) {
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

        root.addView(wv)
        root.addView(overlay)
        root.addView(spinner)
        setContentView(root)

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                val w = web
                if (w != null && w.canGoBack() && w.url?.contains("/admin/people-counter") == false) {
                    w.goBack()
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })

        authenticateAndLoad()
    }

    private fun showFatalError(msg: String) {
        val root = FrameLayout(this).apply {
            layoutParams = FrameLayout.LayoutParams(MATCH, MATCH)
            setBackgroundColor(Color.parseColor("#121212"))
        }
        val tv = TextView(this).apply {
            text = msg
            setTextColor(Color.parseColor("#D4AF37"))
            textSize = 15f
            gravity = Gravity.CENTER
            setPadding(dp(24), dp(24), dp(24), dp(24))
        }
        root.addView(tv)
        setContentView(root)
    }

    private fun authenticateAndLoad() {
        ui.launch {
            try {
                val api = Api(settings.serverUrl)
                val res = api.login(settings.email, settings.password)
                token = res.token
                userJson = res.userJson
                if (!isFinishing && !isDestroyed) web?.loadUrl(base)
            } catch (e: Exception) {
                if (!isFinishing && !isDestroyed) {
                    overlay?.text = "No se pudo iniciar sesión automáticamente.\nInicia sesión en el panel."
                    injected = true
                    web?.loadUrl(panelUrl)
                }
            }
        }
    }

    private fun hideOverlay() {
        overlay?.visibility = ViewGroup.GONE
        spinner?.visibility = ViewGroup.GONE
    }

    override fun onDestroy() {
        super.onDestroy()
        ui.cancel()
        val wv = web
        if (wv != null) {
            (wv.parent as? ViewGroup)?.removeView(wv)
            runCatching { wv.stopLoading() }
            runCatching { wv.destroy() }
        }
        web = null
    }

    private val MATCH = ViewGroup.LayoutParams.MATCH_PARENT
    private val WRAP = ViewGroup.LayoutParams.WRAP_CONTENT
    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()
}
