package com.mantraxstudios.srservi.ui

import android.app.admin.DevicePolicyManager
import android.content.Context
import android.net.Uri
import android.os.Bundle
import android.os.Message
import android.print.PrintAttributes
import android.print.PrintManager
import android.view.View
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
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
    private lateinit var popupContainer: View
    private lateinit var webViewPopup: WebView
    private lateinit var toolbarPopup: MaterialToolbar
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

        progressBar = findViewById(R.id.progressBar)
        webView = findViewById(R.id.webView)
        popupContainer = findViewById(R.id.popupContainer)
        webViewPopup = findViewById(R.id.webViewPopup)
        toolbarPopup = findViewById(R.id.toolbarPopup)

        // Toolbar del popup: volver al panel del trabajador
        toolbarPopup.setNavigationIcon(androidx.appcompat.R.drawable.abc_ic_ab_back_material)
        toolbarPopup.setNavigationOnClickListener { closePopup() }

        val cookieManager = CookieManager.getInstance()
        cookieManager.setAcceptCookie(true)
        cookieManager.setAcceptThirdPartyCookies(webView, true)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            cacheMode = WebSettings.LOAD_DEFAULT
            loadWithOverviewMode = true
            useWideViewPort = true
            setSupportZoom(false)
            allowFileAccess = true
            javaScriptCanOpenWindowsAutomatically = true
            setSupportMultipleWindows(true)
        }

        // WebView del popup para informes/PDFs generados con window.open()
        webViewPopup.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            loadWithOverviewMode = true
            useWideViewPort = true
            setSupportZoom(true)
            builtInZoomControls = true
            displayZoomControls = false
        }
        webViewPopup.addJavascriptInterface(PopupPrintInterface(), "AndroidPrint")
        webViewPopup.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView, url: String) {
                // Reemplazar window.print() para usar el sistema de impresion de Android
                view.evaluateJavascript(
                    "if(typeof window.print==='function'){window.print=function(){AndroidPrint.print();}}",
                    null
                )
            }
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

            // Maneja window.open() — muestra el contenido en el overlay de popup
            override fun onCreateWindow(
                view: WebView,
                isDialog: Boolean,
                isUserGesture: Boolean,
                resultMsg: Message?
            ): Boolean {
                if (resultMsg == null) return false
                val transport = resultMsg.obj as? WebView.WebViewTransport ?: return false
                transport.webView = webViewPopup
                resultMsg.sendToTarget()
                popupContainer.visibility = View.VISIBLE
                return true
            }

            override fun onCloseWindow(window: WebView) {
                if (window === webViewPopup) closePopup()
            }
        }

        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView, url: String) {
                super.onPageFinished(view, url)
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

        startKioskLock()
        webView.loadUrl("https://srservi2.srautomatic.com/worker-login")
    }

    private fun closePopup() {
        popupContainer.visibility = View.GONE
        webViewPopup.loadUrl("about:blank")
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
        when {
            popupContainer.visibility == View.VISIBLE -> closePopup()
            inKiosk -> { /* Bloqueado en modo kiosk */ }
            webView.canGoBack() -> webView.goBack()
            else -> @Suppress("DEPRECATION") super.onBackPressed()
        }
    }

    inner class PopupPrintInterface {
        @JavascriptInterface
        fun print() {
            runOnUiThread {
                try {
                    val pm = getSystemService(Context.PRINT_SERVICE) as PrintManager
                    val adapter = webViewPopup.createPrintDocumentAdapter("Informe SRServi")
                    pm.print("Informe SRServi", adapter, PrintAttributes.Builder().build())
                } catch (_: Exception) { }
            }
        }
    }
}
