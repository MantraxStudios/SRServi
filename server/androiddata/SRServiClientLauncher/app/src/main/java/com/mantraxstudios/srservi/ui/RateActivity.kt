package com.mantraxstudios.srservi.ui

import android.app.ActivityManager
import android.app.admin.DevicePolicyManager
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.ProgressBar
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.mantraxstudios.srservi.R
import com.mantraxstudios.srservi.admin.SRServiDeviceAdminReceiver

class RateActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var progressBar: ProgressBar
    private var inLockTask = false

    companion object {
        const val EXTRA_URL = "rate_url"

        fun start(context: Context, url: String) {
            val intent = Intent(context, RateActivity::class.java)
            intent.putExtra(EXTRA_URL, url)
            context.startActivity(intent)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        window.addFlags(
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
        )

        setContentView(R.layout.activity_rate)

        webView = findViewById(R.id.webView)
        progressBar = findViewById(R.id.progressBar)

        applyImmersiveMode()
        setupWebView()

        val url = intent.getStringExtra(EXTRA_URL) ?: run { finish(); return }
        webView.loadUrl(url)

        // Long-press en esquina superior izquierda para volver al menú principal
        findViewById<View>(R.id.exitHotspot).setOnLongClickListener {
            stopKioskLock()
            finish()
            true
        }

        startKioskLock()
    }

    private fun applyImmersiveMode() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        val controller = WindowInsetsControllerCompat(window, window.decorView)
        controller.hide(WindowInsetsCompat.Type.systemBars())
        controller.systemBarsBehavior =
            WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
    }

    private fun startKioskLock() {
        try {
            val dpm = getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
            if (dpm.isDeviceOwnerApp(packageName)) {
                val adminComponent = SRServiDeviceAdminReceiver.getComponentName(this)
                dpm.setLockTaskPackages(adminComponent, arrayOf(packageName))
            }
            webView.post {
                startLockTask()
                inLockTask = true
            }
        } catch (_: Exception) {
        }
    }

    private fun stopKioskLock() {
        try {
            if (inLockTask) {
                stopLockTask()
                inLockTask = false
            }
        } catch (_: Exception) {
        }
    }

    private fun setupWebView() {
        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.cacheMode = WebSettings.LOAD_DEFAULT
        settings.setSupportZoom(true)
        settings.builtInZoomControls = true
        settings.displayZoomControls = false
        settings.loadWithOverviewMode = true
        settings.useWideViewPort = true
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, url: String): Boolean {
                view.loadUrl(url)
                return true
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView, newProgress: Int) {
                if (newProgress < 100) {
                    progressBar.visibility = View.VISIBLE
                    progressBar.progress = newProgress
                } else {
                    progressBar.visibility = View.GONE
                }
            }
        }
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            if (webView.canGoBack()) webView.goBack()
            return true
        }
        if (keyCode == KeyEvent.KEYCODE_MENU ||
            keyCode == KeyEvent.KEYCODE_APP_SWITCH ||
            keyCode == KeyEvent.KEYCODE_HOME
        ) return true
        return super.onKeyDown(keyCode, event)
    }

    @Suppress("OVERRIDE_DEPRECATION")
    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack()
    }

    override fun onUserLeaveHint() {
        super.onUserLeaveHint()
        bringTaskToFront()
    }

    override fun onPause() {
        super.onPause()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) applyImmersiveMode()
    }

    private fun bringTaskToFront() {
        try {
            val am = getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
            am.appTasks.firstOrNull()?.moveToFront()
        } catch (_: Exception) {
        }
    }

    override fun onDestroy() {
        stopKioskLock()
        webView.destroy()
        super.onDestroy()
    }
}
