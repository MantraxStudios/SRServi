package com.mantraxstudios.srservi.ui

import android.Manifest
import android.app.admin.DevicePolicyManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Bundle
import android.text.InputType
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.EditText
import android.widget.ProgressBar
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.mantraxstudios.srservi.R
import com.mantraxstudios.srservi.SRServiApp
import com.mantraxstudios.srservi.SRServiConfig
import com.mantraxstudios.srservi.admin.SRServiDeviceAdminReceiver
import com.mantraxstudios.srservi.offline.OfflineRepository
import com.mantraxstudios.srservi.offline.StoreInfo
import com.mantraxstudios.srservi.payment.BluetoothReceiverClient
import com.mantraxstudios.srservi.payment.OfflinePaymentProcessor

/**
 * Modo Offline = tu MISMO tótem (`Store.jsx`) dentro de un WebView → UI 100% idéntica
 * y funciona offline vía la PWA (menú cacheado + cola de ventas en efectivo).
 *
 * El cobro con máquina lo hace el nativo mediante el puente `AndroidBridge`, contrato
 * que el tótem ya soporta (`window.AndroidBridge.processTuuPayment` + callback
 * `window.onTuuPaymentResult`). Se carga con `?tuumodepay=true` para que el tótem muestre
 * los botones de cobro por terminal y delegue el cobro real al nativo, que envía el pago
 * a la máquina (TUU/MP/SumUp/Square según el terminal) y espera la aprobación.
 */
class OfflinePosActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var progressBar: ProgressBar
    private var inLockTask = false

    private companion object {
        const val BASE_URL = "https://srservi2.srautomatic.com"
        const val EXIT_PIN = "1234"
    }

    private fun storeCode(): String =
        getSharedPreferences("srservi_prefs", Context.MODE_PRIVATE)
            .getString("store_code", "")?.trim()?.uppercase() ?: ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        setContentView(R.layout.activity_sell)

        webView = findViewById(R.id.webView)
        progressBar = findViewById(R.id.progressBar)

        val code = storeCode()
        if (code.isBlank()) {
            Toast.makeText(this, getString(R.string.sell_no_code), Toast.LENGTH_LONG).show()
            finish(); return
        }

        // Pre-descarga en segundo plano de terminales/menú (para el cobro nativo y respaldo).
        Thread { OfflineRepository.sync(this, code) }.start()

        applyImmersiveMode()
        requestMediaPermissions()
        setupWebView()

        // Carga el tótem con `tuumodepay=true` → el cobro con tarjeta usa el puente nativo
        // (AndroidBridge.processTuuPayment), que envía el pago por Bluetooth al equipo
        // SRServiReceiver (o cobra directo si no hay receptor). El efectivo offline sigue
        // funcionando por la PWA (botón añadido en el modal de pago del tótem).
        val ver = SRServiConfig.APP_VERSION
        webView.loadUrl("$BASE_URL/store/$code?pos_offline=1&tuumodepay=true&app_version=$ver")

        findViewById<View>(R.id.exitHotspot).setOnLongClickListener { promptExitPin(); true }

        startKioskLock()
    }

    override fun onResume() {
        super.onResume()
        startKioskLock()
    }

    private fun setupWebView() {
        val s = webView.settings
        s.javaScriptEnabled = true
        s.domStorageEnabled = true
        s.databaseEnabled = true
        s.cacheMode = WebSettings.LOAD_DEFAULT
        s.mediaPlaybackRequiresUserGesture = false
        s.allowFileAccess = true
        s.useWideViewPort = true
        s.loadWithOverviewMode = true
        s.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW

        webView.addJavascriptInterface(AndroidBridge(), "AndroidBridge")

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, url: String): Boolean {
                view.loadUrl(url); return true
            }
        }
        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView, newProgress: Int) {
                progressBar.visibility = if (newProgress < 100) View.VISIBLE else View.GONE
                progressBar.progress = newProgress
            }
            override fun onPermissionRequest(request: PermissionRequest) {
                val granted = request.resources.filter { res ->
                    when (res) {
                        PermissionRequest.RESOURCE_VIDEO_CAPTURE ->
                            ContextCompat.checkSelfPermission(this@OfflinePosActivity, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
                        PermissionRequest.RESOURCE_AUDIO_CAPTURE ->
                            ContextCompat.checkSelfPermission(this@OfflinePosActivity, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
                        else -> true
                    }
                }.toTypedArray()
                if (granted.isNotEmpty()) request.grant(granted) else request.deny()
            }
        }
    }

    // ── Puente nativo para el cobro con la máquina ────────────────────────────
    /**
     * El tótem llama `window.AndroidBridge.processTuuPayment(amount, method, orderRef)` y
     * espera que el nativo responda vía `window.onTuuPaymentResult(JSON.stringify({approved}))`.
     * Aquí enviamos el pago al terminal configurado (TUU/MP/SumUp/Square) y esperamos.
     */
    inner class AndroidBridge {
        @JavascriptInterface
        fun processTuuPayment(amount: Int, method: Int, orderRef: String) {
            val terminals = OfflineRepository.loadTerminals(this@OfflinePosActivity)
            // Preferimos TUU (contrato original); si no hay, usamos el primer terminal con auto-cobro.
            val terminal = terminals.find { it.provider.equals("tuu", true) }
                ?: terminals.find { OfflinePaymentProcessor.isAutoCharge(it.provider) }
            if (terminal == null) {
                sendTuuResult(false)
                runOnUiThread { Toast.makeText(this@OfflinePosActivity, "No hay terminal configurado", Toast.LENGTH_LONG).show() }
                return
            }
            val store = OfflineRepository.loadStore(this@OfflinePosActivity)?.store ?: StoreInfo()

            // 1) Si hay un equipo SRServiReceiver emparejado, delegamos el cobro por Bluetooth:
            //    el tótem envía el pago + credenciales del terminal y espera el resultado.
            if (BluetoothReceiverClient.isReceiverAvailable(this@OfflinePosActivity)) {
                Thread {
                    val r = BluetoothReceiverClient.pay(
                        ctx = this@OfflinePosActivity,
                        provider = terminal.provider,
                        amount = amount.toDouble(),
                        currency = store.currencyCode,
                        token = terminal.apiKey,
                        deviceId = terminal.deviceId,
                        orderRef = orderRef,
                        method = method
                    )
                    if (r.available) {
                        sendTuuResult(r.approved)
                    } else {
                        // Receptor desapareció justo ahora → cobro directo como respaldo.
                        chargeDirect(store, terminal, amount)
                    }
                }.start()
                return
            }

            // 2) Sin receptor Bluetooth → cobro directo desde el tótem (comportamiento previo).
            chargeDirect(store, terminal, amount)
        }

        private fun chargeDirect(store: StoreInfo, terminal: com.mantraxstudios.srservi.offline.PosTerminal, amount: Int) {
            OfflinePaymentProcessor.process(store, terminal, amount.toDouble(), "pos", object : OfflinePaymentProcessor.Callback {
                override fun onProgress(message: String) { /* el tótem ya muestra su propio spinner */ }
                override fun onResult(result: OfflinePaymentProcessor.PaymentResult) {
                    sendTuuResult(result is OfflinePaymentProcessor.PaymentResult.Approved)
                }
            })
        }

        // ¿Hay un equipo SRServiReceiver emparejado? (el tótem lo consulta).
        @JavascriptInterface
        fun hasReceiver(): Boolean = BluetoothReceiverClient.isReceiverAvailable(this@OfflinePosActivity)

        // Compat: algunos flujos consultan disponibilidad del puente.
        @JavascriptInterface
        fun isAvailable(): Boolean = true
    }

    private fun sendTuuResult(approved: Boolean) {
        runOnUiThread {
            val js = "window.onTuuPaymentResult && window.onTuuPaymentResult(JSON.stringify({approved:$approved}))"
            webView.evaluateJavascript(js, null)
        }
    }

    // ── Permisos / kiosco / salida ────────────────────────────────────────────
    private fun requestMediaPermissions() {
        val perms = arrayOf(Manifest.permission.RECORD_AUDIO, Manifest.permission.CAMERA)
        try {
            val dpm = getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
            if (dpm.isDeviceOwnerApp(packageName)) {
                val admin = SRServiDeviceAdminReceiver.getComponentName(this)
                for (p in perms) dpm.setPermissionGrantState(admin, packageName, p, DevicePolicyManager.PERMISSION_GRANT_STATE_GRANTED)
            }
        } catch (_: Exception) { }
    }

    private fun applyImmersiveMode() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        val controller = WindowInsetsControllerCompat(window, window.decorView)
        controller.hide(WindowInsetsCompat.Type.systemBars())
        controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
    }

    private fun startKioskLock() {
        try {
            val dpm = getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
            if (dpm.isDeviceOwnerApp(packageName)) {
                val admin = SRServiDeviceAdminReceiver.getComponentName(this)
                dpm.setLockTaskPackages(admin, arrayOf(packageName))
                webView.post { try { startLockTask(); inLockTask = true } catch (_: Exception) {} }
            }
        } catch (_: Exception) { }
    }

    private fun stopKioskLock() {
        try { if (inLockTask) { stopLockTask(); inLockTask = false } } catch (_: Exception) { }
    }

    private fun promptExitPin() {
        val input = EditText(this)
        input.inputType = InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_VARIATION_PASSWORD
        input.hint = "PIN"
        AlertDialog.Builder(this)
            .setTitle("Salir del Modo Offline")
            .setMessage("Ingresa el PIN de administrador")
            .setView(input)
            .setPositiveButton("Salir") { _, _ ->
                if (input.text.toString() == EXIT_PIN) { stopKioskLock(); finish() }
                else Toast.makeText(this, "PIN incorrecto", Toast.LENGTH_SHORT).show()
            }
            .setNegativeButton(R.string.cancel, null)
            .show()
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            if (webView.canGoBack()) webView.goBack()
            return true
        }
        if (keyCode == KeyEvent.KEYCODE_MENU || keyCode == KeyEvent.KEYCODE_APP_SWITCH || keyCode == KeyEvent.KEYCODE_HOME) return true
        return super.onKeyDown(keyCode, event)
    }

    @Suppress("OVERRIDE_DEPRECATION")
    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) applyImmersiveMode()
    }

    override fun onDestroy() {
        stopKioskLock()
        try { webView.destroy() } catch (_: Exception) {}
        super.onDestroy()
    }
}
