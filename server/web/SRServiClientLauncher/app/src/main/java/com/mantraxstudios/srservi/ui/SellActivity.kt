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
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
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
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.mantraxstudios.srservi.R
import com.mantraxstudios.srservi.admin.SRServiDeviceAdminReceiver
import com.mantraxstudios.srservi.offline.OfflineRepository
import com.mantraxstudios.srservi.offline.StoreInfo
import com.mantraxstudios.srservi.payment.BluetoothReceiverClient
import com.mantraxstudios.srservi.payment.OfflinePaymentProcessor
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL

class SellActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var progressBar: ProgressBar
    private var inLockTask = false
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private var connectionErrorDialogShown = false
    private var currentStoreCode: String = ""

    // Sincroniza el menú/terminales en segundo plano MIENTRAS hay conexión, para
    // que el Modo Offline ya tenga datos frescos cuando el servidor se caiga
    // (si solo sincronizáramos al entrar en offline, la primera vez que se cae
    // el servidor no habría nada en caché).
    private val syncHandler = android.os.Handler(android.os.Looper.getMainLooper())
    private val syncRunnable = object : Runnable {
        override fun run() {
            if (currentStoreCode.isNotBlank()) {
                Thread { OfflineRepository.sync(this@SellActivity, currentStoreCode) }.start()
            }
            syncHandler.postDelayed(this, OFFLINE_SYNC_INTERVAL_MS)
        }
    }

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
        private const val BASE_URL = "https://srservi2.srautomatic.com"
        private const val EXIT_PIN = "1234"
        private const val REQ_MEDIA_PERMS = 4711
        private const val OFFLINE_SYNC_INTERVAL_MS = 5 * 60 * 1000L
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
        // Pide micrófono (y cámara) al iniciar para que el pedido por voz del tótem
        // funcione automáticamente sin que el cliente tenga que activarlo.
        requestMediaPermissions()
        setupWebView()

        val storeCode = getSharedPreferences("srservi_prefs", Context.MODE_PRIVATE)
            .getString("store_code", "")
        currentStoreCode = storeCode?.trim()?.uppercase() ?: ""
        val ver = com.mantraxstudios.srservi.SRServiConfig.APP_VERSION
        val sellUrl = if (!storeCode.isNullOrBlank()) "$BASE_URL/store/$storeCode?app_version=$ver" else "$BASE_URL?app_version=$ver"
        webView.loadUrl(sellUrl)

        sendHeartbeat(storeCode ?: "", ver)
        if (currentStoreCode.isNotBlank()) syncHandler.post(syncRunnable)

        // Hidden exit: long-press the top-left corner
        findViewById<View>(R.id.exitHotspot).setOnLongClickListener {
            promptExitPin()
            true
        }

        startKioskLock()
    }

    // Asegura micrófono y cámara al arrancar para que el pedido por voz del tótem
    // funcione automáticamente. Si la app es device owner (kiosco), los concede en
    // SILENCIO (sin diálogo). Si no, los pide con el diálogo estándar del sistema.
    private fun requestMediaPermissions() {
        val perms = arrayOf(Manifest.permission.RECORD_AUDIO, Manifest.permission.CAMERA)
        // 1) Device owner → auto-conceder sin molestar al cliente.
        try {
            val dpm = getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
            if (dpm.isDeviceOwnerApp(packageName)) {
                val admin = SRServiDeviceAdminReceiver.getComponentName(this)
                for (p in perms) {
                    dpm.setPermissionGrantState(admin, packageName, p, DevicePolicyManager.PERMISSION_GRANT_STATE_GRANTED)
                }
                return
            }
        } catch (_: Exception) { /* cae al pedido normal */ }

        // 2) Sin device owner → pedir con diálogo estándar.
        val needed = perms.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }.toTypedArray()
        if (needed.isNotEmpty()) {
            try { ActivityCompat.requestPermissions(this, needed, REQ_MEDIA_PERMS) } catch (_: Exception) {}
        }
    }

    private fun sendHeartbeat(storeCode: String, appVersion: String) {
        Thread {
            try {
                val conn = java.net.URL("$BASE_URL/api/app/heartbeat").openConnection() as java.net.HttpURLConnection
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json")
                conn.doOutput = true
                conn.connectTimeout = 8000
                conn.readTimeout = 8000
                val body = """{"app_name":"launcher","store_code":"$storeCode","app_version":"$appVersion","event":"open"}"""
                conn.outputStream.use { it.write(body.toByteArray()) }
                conn.responseCode
                conn.disconnect()
            } catch (_: Exception) {}
        }.start()
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

        // Puente nativo: permite que el tótem cobre con tarjeta por Bluetooth
        // (SRServiReceiver) cuando se cae internet.
        webView.addJavascriptInterface(AndroidBridge(), "AndroidBridge")

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, url: String): Boolean {
                view.loadUrl(url)
                return true
            }

            override fun onReceivedError(
                view: WebView,
                request: WebResourceRequest,
                error: WebResourceError
            ) {
                super.onReceivedError(view, request, error)
                if (request.isForMainFrame) {
                    showConnectionErrorDialog()
                }
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

    // ── Puente nativo para el cobro con la máquina ────────────────────────────
    /**
     * El tótem llama `window.AndroidBridge.processTuuPayment(amount, method, orderRef)` y
     * espera el resultado vía `window.onTuuPaymentResult(JSON.stringify({approved}))`.
     * Si hay un equipo SRServiReceiver emparejado, el cobro se reenvía por Bluetooth
     * (el receptor tiene el terminal/internet); si no, se cobra directo desde este equipo.
     */
    inner class AndroidBridge {
        @JavascriptInterface
        fun processTuuPayment(amount: Int, method: Int, orderRef: String) {
            val terminals = OfflineRepository.loadTerminals(this@SellActivity)
            val terminal = terminals.find { it.provider.equals("tuu", true) }
                ?: terminals.find { OfflinePaymentProcessor.isAutoCharge(it.provider) }

            // Sin terminal local pero con receptor Bluetooth: el receptor usa su
            // propio terminal, así que igual se puede cobrar.
            if (terminal == null && !BluetoothReceiverClient.isReceiverAvailable(this@SellActivity)) {
                sendTuuResult(false)
                runOnUiThread { Toast.makeText(this@SellActivity, "No hay terminal configurado", Toast.LENGTH_LONG).show() }
                return
            }
            val store = OfflineRepository.loadStore(this@SellActivity)?.store ?: StoreInfo()

            // 1) Receptor Bluetooth emparejado → delegar el cobro.
            if (BluetoothReceiverClient.isReceiverAvailable(this@SellActivity)) {
                Thread {
                    val r = BluetoothReceiverClient.pay(
                        ctx = this@SellActivity,
                        provider = terminal?.provider ?: "tuu",
                        amount = amount.toDouble(),
                        currency = store.currencyCode,
                        token = terminal?.apiKey,
                        deviceId = terminal?.deviceId,
                        orderRef = orderRef,
                        method = method
                    )
                    if (r.available) {
                        sendTuuResult(r.approved)
                    } else if (terminal != null) {
                        chargeDirect(store, terminal, amount)
                    } else {
                        sendTuuResult(false)
                    }
                }.start()
                return
            }

            // 2) Sin receptor → cobro directo desde este equipo (requiere internet local).
            chargeDirect(store, terminal!!, amount)
        }

        private fun chargeDirect(store: StoreInfo, terminal: com.mantraxstudios.srservi.offline.PosTerminal, amount: Int) {
            OfflinePaymentProcessor.process(store, terminal, amount.toDouble(), "pos", object : OfflinePaymentProcessor.Callback {
                override fun onProgress(message: String) { /* el tótem ya muestra su propio spinner */ }
                override fun onResult(result: OfflinePaymentProcessor.PaymentResult) {
                    sendTuuResult(result is OfflinePaymentProcessor.PaymentResult.Approved)
                }
            })
        }

        // ¿Hay un equipo SRServiReceiver emparejado? El tótem lo consulta para
        // mostrar el botón de tarjeta aunque esté offline.
        @JavascriptInterface
        fun hasReceiver(): Boolean = BluetoothReceiverClient.isReceiverAvailable(this@SellActivity)

        @JavascriptInterface
        fun isAvailable(): Boolean = true
    }

    private fun sendTuuResult(approved: Boolean) {
        runOnUiThread {
            val js = "window.onTuuPaymentResult && window.onTuuPaymentResult(JSON.stringify({approved:$approved}))"
            webView.evaluateJavascript(js, null)
        }
    }

    private fun showConnectionErrorDialog() {
        if (connectionErrorDialogShown) return
        connectionErrorDialogShown = true

        val storeCode = getSharedPreferences("srservi_prefs", Context.MODE_PRIVATE)
            .getString("store_code", "")

        AlertDialog.Builder(this)
            .setTitle("Sin conexión con el servidor")
            .setMessage("No se pudo conectar con el servidor. ¿Querés cambiar al modo offline o mantenerte esperando la conexión?")
            .setCancelable(false)
            .setPositiveButton("Cambiar a modo offline") { _, _ ->
                connectionErrorDialogShown = false
                stopKioskLock()
                if (storeCode.isNullOrBlank()) {
                    Toast.makeText(this, getString(R.string.sell_no_code), Toast.LENGTH_SHORT).show()
                } else {
                    startActivity(Intent(this, OfflinePosActivity::class.java))
                    finish()
                }
            }
            .setNegativeButton("Mantenerme") { _, _ ->
                connectionErrorDialogShown = false
                webView.reload()
            }
            .show()
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
                    if (destFile.name.endsWith(".apk")) {
                        openDownloadedFile(destFile, "application/vnd.android.package-archive")
                    } else {
                        showShareDialog(destFile, mimeType)
                    }
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
            .setPositiveButton("Abrir archivo") { _, _ ->
                openDownloadedFile(file, mimeType)
            }
            .setNegativeButton("Cerrar") { _, _ ->
                startKioskLock()
            }
            .setOnCancelListener {
                startKioskLock()
            }
            .show()
    }

    private fun openDownloadedFile(file: File, mimeType: String) {
        val fileUri = FileProvider.getUriForFile(this, "$packageName.fileprovider", file)
        val resolvedMime = mimeType.ifBlank { "*/*" }
        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(fileUri, resolvedMime)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        try {
            startActivity(intent)
        } catch (_: Exception) {
            Toast.makeText(this, "No hay app para abrir este tipo de archivo", Toast.LENGTH_LONG).show()
            startKioskLock()
        }
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
        syncHandler.removeCallbacks(syncRunnable)
        stopKioskLock()
        webView.destroy()
        super.onDestroy()
    }
}
