package com.mantraxstudios.srservi.ui

import android.app.admin.DevicePolicyManager
import android.content.Context
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.webkit.CookieManager
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.ProgressBar
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import com.google.android.material.appbar.MaterialToolbar
import com.mantraxstudios.srservi.R
import com.mantraxstudios.srservi.admin.SRServiDeviceAdminReceiver

class WorkerLoginActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var progressBar: ProgressBar
    private lateinit var toolbar: MaterialToolbar
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private var inKiosk = false

    private val fileChooserLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            val uris: Array<Uri>? = if (result.resultCode == RESULT_OK) {
                result.data?.let { data ->
                    data.clipData?.let { clip ->
                        Array(clip.itemCount) { i -> clip.getItemAt(i).uri }
                    } ?: data.data?.let { arrayOf(it) }
                }
            } else null
            filePathCallback?.onReceiveValue(uris)
            filePathCallback = null
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_worker_login)

        toolbar = findViewById(R.id.toolbar)
        toolbar.setNavigationIcon(androidx.appcompat.R.drawable.abc_ic_ab_back_material)
        toolbar.setNavigationOnClickListener { finish() }

        progressBar = findViewById(R.id.progressBar)
        webView = findViewById(R.id.webView)

        // Cookies persistentes
        val cookieManager = CookieManager.getInstance()
        cookieManager.setAcceptCookie(true)
        cookieManager.setAcceptThirdPartyCookies(webView, true)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true          // localStorage y sessionStorage
            databaseEnabled = true            // Web SQL (algunos sitios lo usan)
            cacheMode = WebSettings.LOAD_DEFAULT  // usa cache cuando es posible
            loadWithOverviewMode = true
            useWideViewPort = true
            setSupportZoom(false)
            // Permitir que el sitio guarde datos entre sesiones
            allowFileAccess = true
            javaScriptCanOpenWindowsAutomatically = true
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                progressBar.progress = newProgress
                progressBar.visibility = if (newProgress < 100) View.VISIBLE else View.GONE
            }

            override fun onShowFileChooser(
                webView: WebView,
                filePathCallback: ValueCallback<Array<Uri>>,
                fileChooserParams: FileChooserParams
            ): Boolean {
                this@WorkerLoginActivity.filePathCallback?.onReceiveValue(null)
                this@WorkerLoginActivity.filePathCallback = filePathCallback
                fileChooserLauncher.launch(fileChooserParams.createIntent())
                return true
            }
        }

        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView, url: String) {
                super.onPageFinished(view, url)
                // Login exitoso cuando el sitio navega fuera de /worker-login
                if (!url.contains("/worker-login") && !inKiosk) {
                    toolbar.visibility = View.GONE
                    startKioskLock()
                }
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                if (request?.isForMainFrame == true) {
                    Toast.makeText(
                        this@WorkerLoginActivity,
                        "Sin conexion a internet. Verifica tu WiFi o datos moviles.",
                        Toast.LENGTH_LONG
                    ).show()
                }
            }
        }

        webView.loadUrl("https://srservi2.srautomatic.com/worker-login")
    }

    private fun startKioskLock() {
        try {
            val dpm = getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
            if (dpm.isDeviceOwnerApp(packageName)) {
                val admin = SRServiDeviceAdminReceiver.getComponentName(this)
                dpm.setLockTaskPackages(admin, arrayOf(packageName))
            }
            webView.post {
                startLockTask()
                inKiosk = true
            }
        } catch (_: Exception) {
            inKiosk = true
        }
    }

    private fun stopKioskLock() {
        try {
            if (inKiosk) {
                stopLockTask()
                inKiosk = false
            }
        } catch (_: Exception) {
            inKiosk = false
        }
    }

    override fun onPause() {
        super.onPause()
        CookieManager.getInstance().flush()
    }

    override fun onDestroy() {
        stopKioskLock()
        super.onDestroy()
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (inKiosk) {
            // Bloqueado en modo kiosk
            return
        }
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
}
