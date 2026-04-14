package com.mantraxstudios.srservi.ui

import android.app.ActivityManager
import android.app.admin.DevicePolicyManager
import android.content.Context
import android.os.Build
import android.os.Bundle
import android.text.InputType
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.EditText
import android.widget.ProgressBar
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.mantraxstudios.srservi.R
import com.mantraxstudios.srservi.admin.SRServiDeviceAdminReceiver

class SellActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var progressBar: ProgressBar
    private var inLockTask = false

    companion object {
        private const val SELL_URL = "https://srservi2.srautomatic.com/"
        private const val EXIT_PIN = "1234"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        window.addFlags(
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
        )

        setContentView(R.layout.activity_sell)

        webView = findViewById(R.id.webView)
        progressBar = findViewById(R.id.progressBar)

        applyImmersiveMode()
        setupWebView()
        webView.loadUrl(SELL_URL)

        // Hidden exit: long-press the top-left corner
        findViewById<View>(R.id.exitHotspot).setOnLongClickListener {
            promptExitPin()
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
            startLockTask()
            inLockTask = true
        } catch (_: Exception) {
            // Sin device owner: el sistema mostrara una confirmacion al usuario.
            // Si rechaza, no entramos en lock task pero el resto de bloqueos siguen activos.
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
        settings.allowFileAccess = true
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

    private fun promptExitPin() {
        val input = EditText(this)
        input.inputType = InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_VARIATION_PASSWORD
        input.hint = "PIN"

        AlertDialog.Builder(this)
            .setTitle("Salir del modo venta")
            .setMessage("Ingresa el PIN de administrador")
            .setView(input)
            .setPositiveButton("Salir") { _, _ ->
                if (input.text.toString() == EXIT_PIN) {
                    stopKioskLock()
                    finish()
                } else {
                    Toast.makeText(this, "PIN incorrecto", Toast.LENGTH_SHORT).show()
                }
            }
            .setNegativeButton("Cancelar", null)
            .show()
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        // Permite al WebView navegar hacia atras pero nunca salir de la activity.
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            if (webView.canGoBack()) {
                webView.goBack()
            }
            return true
        }
        // Bloquea volumen, menu, app switcher
        if (keyCode == KeyEvent.KEYCODE_MENU ||
            keyCode == KeyEvent.KEYCODE_APP_SWITCH ||
            keyCode == KeyEvent.KEYCODE_HOME
        ) {
            return true
        }
        return super.onKeyDown(keyCode, event)
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        }
        // Sin llamar super: no permitimos cerrar la activity
    }

    override fun onUserLeaveHint() {
        super.onUserLeaveHint()
        // Si el usuario presiona Home y logra salir, intentamos volver.
        bringTaskToFront()
    }

    override fun onPause() {
        super.onPause()
        bringTaskToFront()
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
