package com.mantraxstudios.srservitvordenes

import android.annotation.SuppressLint
import android.app.AlertDialog
import android.app.DownloadManager
import android.content.Context
import android.net.Uri
import android.os.Bundle
import android.os.Environment
import android.os.PowerManager
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.ComponentActivity

class MainActivity : ComponentActivity() {

    // Replaced at build time by the server. Falls back to /tv entry screen if not configured.
    private val storeCode = "AUTO_STORE_CODE"
    private val targetUrl get() = if (storeCode == "AUTO_STORE_CODE") "https://srservi3.srautomatic.com/tv"
                                  else "https://srservi3.srautomatic.com/tv/$storeCode"

    private val APP_VERSION = "1.0.0"

    private lateinit var webView: WebView
    private lateinit var wakeLock: PowerManager.WakeLock

    @SuppressLint("SetJavaScriptEnabled", "WakelockTimeout")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Mantener pantalla siempre encendida
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        val powerManager = getSystemService(POWER_SERVICE) as PowerManager
        wakeLock = powerManager.newWakeLock(
            PowerManager.SCREEN_BRIGHT_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP,
            "SRServi::ScreenWakeLock"
        )
        wakeLock.acquire()

        // Pantalla completa inmersiva
        window.decorView.systemUiVisibility = (
                View.SYSTEM_UI_FLAG_FULLSCREEN or
                        View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
                        View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                )

        webView = WebView(this).apply {
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                databaseEnabled = true
                cacheMode = WebSettings.LOAD_DEFAULT
                allowFileAccess = true
                allowContentAccess = true
                mediaPlaybackRequiresUserGesture = false
                mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                setSupportZoom(false)
                builtInZoomControls = false
                displayZoomControls = false
                loadWithOverviewMode = true
                useWideViewPort = true
            }

            // Habilitar cookies
            CookieManager.getInstance().setAcceptCookie(true)
            CookieManager.getInstance().setAcceptThirdPartyCookies(this, true)

            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(
                    view: WebView,
                    request: WebResourceRequest
                ): Boolean {
                    view.loadUrl(request.url.toString())
                    return true
                }

                override fun onPageFinished(view: WebView, url: String) {
                    super.onPageFinished(view, url)
                    CookieManager.getInstance().flush()
                }
            }

            webChromeClient = WebChromeClient()

            // Restaurar estado si existe, sino cargar URL
            if (savedInstanceState != null) {
                restoreState(savedInstanceState)
            } else {
                loadUrl(targetUrl)
            }
        }

        setContentView(webView)
        checkForUpdateAndHeartbeat()
    }

    private fun checkForUpdateAndHeartbeat() {
        Thread {
            try {
                val hbConn = java.net.URL("https://srservi3.srautomatic.com/api/app/heartbeat").openConnection() as java.net.HttpURLConnection
                hbConn.requestMethod = "POST"
                hbConn.setRequestProperty("Content-Type", "application/json")
                hbConn.doOutput = true
                hbConn.connectTimeout = 8000
                hbConn.readTimeout = 8000
                val sc = if (storeCode == "AUTO_STORE_CODE") "" else storeCode
                val hbBody = """{"app_name":"tvordenes","store_code":"$sc","app_version":"$APP_VERSION","event":"open"}"""
                hbConn.outputStream.use { it.write(hbBody.toByteArray()) }
                hbConn.responseCode
                hbConn.disconnect()
            } catch (_: Exception) {}
            try {
                val conn = java.net.URL("https://srservi3.srautomatic.com/api/apps/android/version/tvordenes").openConnection() as java.net.HttpURLConnection
                conn.connectTimeout = 10000
                conn.readTimeout = 10000
                if (conn.responseCode == 200) {
                    val json = org.json.JSONObject(conn.inputStream.bufferedReader().readText())
                    val serverVersion = json.optString("version")
                    conn.disconnect()
                    if (serverVersion.isNotEmpty() && serverVersion != APP_VERSION) {
                        runOnUiThread { showUpdateDialog(serverVersion) }
                    }
                } else { conn.disconnect() }
            } catch (_: Exception) {}
        }.start()
    }

    private fun showUpdateDialog(serverVersion: String) {
        AlertDialog.Builder(this)
            .setTitle("Actualización disponible")
            .setMessage("Versión $serverVersion disponible (tu versión: $APP_VERSION). Descarga la actualización.")
            .setCancelable(true)
            .setPositiveButton("Descargar") { _, _ ->
                val url = "https://srservi3.srautomatic.com/api/apps/android/download?appName=tvordenes"
                val req = DownloadManager.Request(Uri.parse(url))
                    .setTitle("SRServi TV Ordenes - Actualización")
                    .setDescription("Descargando v$serverVersion...")
                    .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                    .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, "SRServi-TVOrdenes.apk")
                    .setMimeType("application/vnd.android.package-archive")
                (getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager).enqueue(req)
                Toast.makeText(this, "Descargando... Revisa notificaciones.", Toast.LENGTH_LONG).show()
            }
            .setNegativeButton("Más tarde", null)
            .show()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    override fun onResume() {
        super.onResume()
        webView.onResume()
        CookieManager.getInstance().flush()
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        if (!wakeLock.isHeld) wakeLock.acquire()
    }

    override fun onPause() {
        super.onPause()
        webView.onPause()
        CookieManager.getInstance().flush()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = (
                View.SYSTEM_UI_FLAG_FULLSCREEN or
                View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            )
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        webView.destroy()
        if (wakeLock.isHeld) wakeLock.release()
    }

    // Manejar boton atras del control remoto
    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_BACK && webView.canGoBack()) {
            webView.goBack()
            return true
        }
        return super.onKeyDown(keyCode, event)
    }
}
