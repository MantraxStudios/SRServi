package com.mantraxstudios.srservi.ui

import android.Manifest
import android.app.ActivityManager
import android.app.admin.DevicePolicyManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.text.InputType
import android.view.Gravity
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.view.WindowManager
import android.webkit.DownloadListener
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.mantraxstudios.srservi.R
import com.mantraxstudios.srservi.admin.SRServiDeviceAdminReceiver
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL

class SellActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var progressBar: ProgressBar
    private var inLockTask = false
    private var filePathCallback: ValueCallback<Array<Uri>>? = null

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
            // Re-pin after returning from file chooser
            webView.post { startKioskLock() }
        }

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
            // Post to next frame so the WebView starts rendering before the system call blocks
            webView.post {
                startLockTask()
                inLockTask = true
            }
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

        webView.setDownloadListener(DownloadListener { url, userAgent, contentDisposition, mimeType, contentLength ->
            downloadFile(url, userAgent, contentDisposition, mimeType, contentLength)
        })

        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView, newProgress: Int) {
                if (newProgress < 100) {
                    progressBar.visibility = View.VISIBLE
                    progressBar.progress = newProgress
                } else {
                    progressBar.visibility = View.GONE
                }
            }

            override fun onPermissionRequest(request: PermissionRequest) {
                val granted = request.resources.filter { res ->
                    when (res) {
                        PermissionRequest.RESOURCE_VIDEO_CAPTURE ->
                            ContextCompat.checkSelfPermission(
                                this@SellActivity, Manifest.permission.CAMERA
                            ) == PackageManager.PERMISSION_GRANTED
                        PermissionRequest.RESOURCE_AUDIO_CAPTURE ->
                            ContextCompat.checkSelfPermission(
                                this@SellActivity, Manifest.permission.RECORD_AUDIO
                            ) == PackageManager.PERMISSION_GRANTED
                        else -> true
                    }
                }.toTypedArray()
                if (granted.isNotEmpty()) request.grant(granted) else request.deny()
            }

            override fun onShowFileChooser(
                webView: WebView,
                filePathCallback: ValueCallback<Array<Uri>>,
                fileChooserParams: FileChooserParams
            ): Boolean {
                this@SellActivity.filePathCallback?.onReceiveValue(null)
                this@SellActivity.filePathCallback = filePathCallback
                // Unpin temporarily so the system file chooser can open
                stopKioskLock()
                try {
                    fileChooserLauncher.launch(fileChooserParams.createIntent())
                } catch (_: Exception) {
                    this@SellActivity.filePathCallback?.onReceiveValue(null)
                    this@SellActivity.filePathCallback = null
                    webView.post { startKioskLock() }
                }
                return true
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

    // ── Descarga de archivos ─────────────────────────────────────────────────

    private fun downloadFile(
        url: String,
        userAgent: String,
        contentDisposition: String,
        mimeType: String,
        contentLength: Long
    ) {
        val fileName = parseFileName(contentDisposition, url)

        val progressBar = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            max = 100
            isIndeterminate = contentLength <= 0
        }
        val tvPercent = TextView(this).apply {
            text = "0%"
            gravity = Gravity.CENTER
            setPadding(0, 8, 0, 0)
        }
        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(64, 32, 64, 16)
            addView(progressBar, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT))
            addView(tvPercent, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT))
        }

        stopKioskLock()
        val dialog = AlertDialog.Builder(this)
            .setTitle("Descargando $fileName…")
            .setView(container)
            .setCancelable(false)
            .create()
        dialog.show()

        Thread {
            try {
                val destFile = File(cacheDir, fileName)
                val connection = URL(url).openConnection() as HttpURLConnection
                connection.setRequestProperty("User-Agent", userAgent)
                connection.connect()

                val total = if (contentLength > 0) contentLength else connection.contentLengthLong
                val input = connection.inputStream
                val output = FileOutputStream(destFile)
                val buffer = ByteArray(8192)
                var downloaded = 0L
                var bytes: Int

                while (input.read(buffer).also { bytes = it } != -1) {
                    output.write(buffer, 0, bytes)
                    downloaded += bytes
                    if (total > 0) {
                        val percent = (downloaded * 100 / total).toInt()
                        runOnUiThread {
                            progressBar.isIndeterminate = false
                            progressBar.progress = percent
                            tvPercent.text = "$percent%"
                        }
                    }
                }
                output.flush()
                output.close()
                input.close()

                runOnUiThread {
                    dialog.dismiss()
                    showShareDialog(destFile, mimeType)
                }
            } catch (e: Exception) {
                runOnUiThread {
                    dialog.dismiss()
                    Toast.makeText(this, "Error al descargar: ${e.message}", Toast.LENGTH_LONG).show()
                    startKioskLock()
                }
            }
        }.start()
    }

    private fun showShareDialog(file: File, mimeType: String) {
        AlertDialog.Builder(this)
            .setTitle("Descarga completada")
            .setMessage(file.name)
            .setPositiveButton("Compartir archivo") { _, _ ->
                shareViaBluetooth(file, mimeType)
            }
            .setNegativeButton("Cerrar") { _, _ ->
                startKioskLock()
            }
            .setOnCancelListener {
                startKioskLock()
            }
            .show()
    }

    private fun shareViaBluetooth(file: File, mimeType: String) {
        val fileUri = FileProvider.getUriForFile(this, "$packageName.fileprovider", file)
        val resolvedMime = mimeType.ifBlank { "*/*" }

        // Intentar abrir directamente Bluetooth OPP
        val btIntent = Intent(Intent.ACTION_SEND).apply {
            type = resolvedMime
            putExtra(Intent.EXTRA_STREAM, fileUri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            setPackage("com.android.bluetooth")
        }
        val hasBtOpp = packageManager.queryIntentActivities(btIntent, PackageManager.MATCH_DEFAULT_ONLY).isNotEmpty()
        if (hasBtOpp) {
            grantUriPermission("com.android.bluetooth", fileUri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
            try {
                startActivity(btIntent)
                return
            } catch (_: Exception) { }
        }

        // Fallback: hoja de compartir estándar (incluye Bluetooth)
        val shareIntent = Intent(Intent.ACTION_SEND).apply {
            type = resolvedMime
            putExtra(Intent.EXTRA_STREAM, fileUri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        startActivity(Intent.createChooser(shareIntent, "Compartir archivo"))
    }

    private fun parseFileName(contentDisposition: String, url: String): String {
        return try {
            if (contentDisposition.contains("filename=", ignoreCase = true)) {
                contentDisposition
                    .substringAfter("filename=", "")
                    .trim('"', '\'', ' ')
                    .substringBefore(";")
                    .trim()
                    .ifBlank { null }
            } else null
        } catch (_: Exception) { null }
            ?: Uri.parse(url).lastPathSegment?.takeIf { it.isNotBlank() }
            ?: "archivo_${System.currentTimeMillis()}"
    }

    override fun onDestroy() {
        stopKioskLock()
        webView.destroy()
        super.onDestroy()
    }
}
