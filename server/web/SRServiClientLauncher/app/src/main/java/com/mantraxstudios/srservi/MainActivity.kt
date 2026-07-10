package com.mantraxstudios.srservi

import android.app.AlertDialog
import android.app.DownloadManager
import android.app.admin.DevicePolicyManager
import android.content.Context
import android.content.Intent
import android.content.pm.ActivityInfo
import android.net.Uri
import android.os.Bundle
import android.os.Environment
import android.view.View
import android.view.WindowManager
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.mantraxstudios.srservi.admin.SRServiDeviceAdminReceiver
import com.mantraxstudios.srservi.network.ApiService
import com.mantraxstudios.srservi.printer.BluetoothPrinterManager
import com.mantraxstudios.srservi.printer.PrinterForegroundService
import com.mantraxstudios.srservi.ui.RateActivity
import com.mantraxstudios.srservi.ui.SellActivity
import com.mantraxstudios.srservi.ui.SettingsActivity
import com.mantraxstudios.srservi.ui.WorkerLoginActivity

class MainActivity : AppCompatActivity() {

    private lateinit var printerManager: BluetoothPrinterManager
    private lateinit var tvPrinterStatus: TextView

    private var kioskModeActive = false
    private var updateDialogShown = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        applyRotationPreference()
        setContentView(R.layout.activity_main)

        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        tvPrinterStatus = findViewById(R.id.tvPrinterStatus)
        printerManager = (application as SRServiApp).printerManager

        findViewById<View>(R.id.btnStartSelling).setOnClickListener {
            val prefs = getSharedPreferences("srservi_prefs", Context.MODE_PRIVATE)
            val storeCode = prefs.getString("store_code", "")
            if (storeCode.isNullOrBlank()) {
                Toast.makeText(this, getString(R.string.sell_no_code), Toast.LENGTH_SHORT).show()
            } else {
                startActivity(Intent(this, SellActivity::class.java))
            }
        }

        findViewById<View>(R.id.btnWorkerLogin).setOnClickListener {
            startActivity(Intent(this, WorkerLoginActivity::class.java))
        }

        findViewById<View>(R.id.btnRate).setOnClickListener {
            val prefs = getSharedPreferences("srservi_prefs", Context.MODE_PRIVATE)
            val storeCode = prefs.getString("store_code", "")
            if (storeCode.isNullOrBlank()) {
                Toast.makeText(this, getString(R.string.rate_no_code), Toast.LENGTH_SHORT).show()
            } else {
                val url = "https://srservi3.srautomatic.com/rate/$storeCode"
                RateActivity.start(this, url)
            }
        }

        findViewById<View>(R.id.btnAppSettings).setOnClickListener {
            startActivity(Intent(this, SettingsActivity::class.java))
        }

        checkForUpdate()
    }

    override fun onResume() {
        super.onResume()
        applyRotationPreference()

        PrinterForegroundService.start(this)

        if (SetupWizardActivity.isSetupNeeded(this)) {
            startActivity(Intent(this, SetupWizardActivity::class.java))
            return
        }

        setupKioskMode()
        updatePrinterStatus()
    }

    @Suppress("OVERRIDE_DEPRECATION")
    override fun onBackPressed() {
        // Bloquear el botón atrás en modo kiosk.
    }

    private fun checkForUpdate() {
        Thread {
            try {
                val serverVersion = ApiService.fetchAppVersion("launcher") ?: return@Thread
                val localVersion = SRServiConfig.APP_VERSION
                if (serverVersion != localVersion) {
                    runOnUiThread { showUpdateDialog(serverVersion) }
                }
            } catch (_: Exception) {}
        }.start()
    }

    private fun showUpdateDialog(serverVersion: String) {
        if (updateDialogShown) return
        updateDialogShown = true

        val prefs = getSharedPreferences("srservi_prefs", Context.MODE_PRIVATE)
        val storeCode = prefs.getString("store_code", "") ?: ""

        AlertDialog.Builder(this)
            .setTitle("Actualización requerida")
            .setMessage("Hay una nueva versión disponible (v$serverVersion). Tu versión actual es v${SRServiConfig.APP_VERSION}.\n\nDebes actualizar para continuar usando la aplicación.")
            .setCancelable(false)
            .setPositiveButton("Descargar actualización") { _, _ ->
                downloadApk(storeCode)
            }
            .show()
    }

    private fun downloadApk(storeCode: String) {
        val progressDialog = AlertDialog.Builder(this)
            .setTitle("Compilando actualización")
            .setMessage("Iniciando compilación...")
            .setCancelable(false)
            .create()
        progressDialog.show()

        Thread {
            try {
                val buildUrl = java.net.URL("https://srservi3.srautomatic.com/api/apps/android/build")
                val conn = buildUrl.openConnection() as java.net.HttpURLConnection
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json")
                conn.doOutput = true
                val body = if (storeCode.isNotBlank())
                    """{"appName":"launcher","storeCode":"$storeCode","force":true}"""
                else
                    """{"appName":"launcher","force":true}"""
                conn.outputStream.use { it.write(body.toByteArray()) }

                if (conn.responseCode != 200) {
                    runOnUiThread {
                        progressDialog.dismiss()
                        Toast.makeText(this, "Error al iniciar compilación", Toast.LENGTH_LONG).show()
                        updateDialogShown = false
                    }
                    return@Thread
                }

                val response = conn.inputStream.bufferedReader().readText()
                conn.disconnect()
                val gson = com.google.gson.Gson()
                val buildResult = gson.fromJson(response, Map::class.java)

                val cached = buildResult["cached"] as? Boolean ?: false
                if (cached || buildResult["status"] == "done") {
                    runOnUiThread { progressDialog.dismiss() }
                    startApkDownload(storeCode)
                    return@Thread
                }

                val jobId = buildResult["jobId"] as? String
                if (jobId == null) {
                    runOnUiThread {
                        progressDialog.dismiss()
                        Toast.makeText(this, "Error: no se obtuvo jobId", Toast.LENGTH_LONG).show()
                        updateDialogShown = false
                    }
                    return@Thread
                }

                // Poll build status
                while (true) {
                    Thread.sleep(3000)
                    val statusUrl = java.net.URL("https://srservi3.srautomatic.com/api/apps/android/status/$jobId")
                    val sc = statusUrl.openConnection() as java.net.HttpURLConnection
                    sc.requestMethod = "GET"
                    if (sc.responseCode != 200) { sc.disconnect(); continue }
                    val statusResp = sc.inputStream.bufferedReader().readText()
                    sc.disconnect()
                    val statusData = gson.fromJson(statusResp, Map::class.java)
                    val status = statusData["status"] as? String ?: ""
                    val progress = statusData["progress"] as? String ?: ""

                    runOnUiThread {
                        progressDialog.setMessage("$progress")
                    }

                    if (status == "done") {
                        runOnUiThread { progressDialog.dismiss() }
                        startApkDownload(storeCode)
                        break
                    } else if (status == "error") {
                        runOnUiThread {
                            progressDialog.dismiss()
                            Toast.makeText(this, "Error al compilar: ${statusData["error"] ?: "desconocido"}", Toast.LENGTH_LONG).show()
                            updateDialogShown = false
                        }
                        break
                    }
                }
            } catch (e: Exception) {
                runOnUiThread {
                    progressDialog.dismiss()
                    Toast.makeText(this, "Error: ${e.message}", Toast.LENGTH_LONG).show()
                    updateDialogShown = false
                }
            }
        }.start()
    }

    private fun startApkDownload(storeCode: String) {
        runOnUiThread {
            val progressDialog = AlertDialog.Builder(this)
                .setTitle("Descargando actualización")
                .setMessage("Descargando APK...")
                .setCancelable(false)
                .create()
            progressDialog.show()

            Thread {
                try {
                    val url = if (storeCode.isNotBlank())
                        "https://srservi3.srautomatic.com/api/apps/android/download?appName=launcher&storeCode=$storeCode"
                    else
                        "https://srservi3.srautomatic.com/api/apps/android/download?appName=launcher"

                    val conn = java.net.URL(url).openConnection() as java.net.HttpURLConnection
                    conn.requestMethod = "GET"
                    conn.connect()

                    val total = conn.contentLengthLong
                    val apkFile = java.io.File(cacheDir, "SRServi-POS-update.apk")
                    val input = conn.inputStream
                    val output = java.io.FileOutputStream(apkFile)
                    val buffer = ByteArray(8192)
                    var downloaded = 0L
                    var bytes: Int

                    while (input.read(buffer).also { bytes = it } != -1) {
                        output.write(buffer, 0, bytes)
                        downloaded += bytes
                        if (total > 0) {
                            val pct = (downloaded * 100 / total).toInt()
                            runOnUiThread { progressDialog.setMessage("Descargando... $pct%") }
                        }
                    }
                    output.flush()
                    output.close()
                    input.close()
                    conn.disconnect()

                    runOnUiThread {
                        progressDialog.dismiss()
                        installApk(apkFile)
                    }
                } catch (e: Exception) {
                    runOnUiThread {
                        progressDialog.dismiss()
                        Toast.makeText(this, "Error al descargar: ${e.message}", Toast.LENGTH_LONG).show()
                        updateDialogShown = false
                    }
                }
            }.start()
        }
    }

    private fun installApk(file: java.io.File) {
        try {
            val uri = androidx.core.content.FileProvider.getUriForFile(
                this, "$packageName.fileprovider", file
            )
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "application/vnd.android.package-archive")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            startActivity(intent)
        } catch (e: Exception) {
            Toast.makeText(this, "No se pudo abrir el instalador: ${e.message}", Toast.LENGTH_LONG).show()
        }
    }

    private fun setupKioskMode() {
        val dpm = getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        val adminComponent = SRServiDeviceAdminReceiver.getComponentName(this)

        if (dpm.isDeviceOwnerApp(packageName)) {
            dpm.setLockTaskPackages(adminComponent, arrayOf(packageName))
            if (!kioskModeActive) {
                window.decorView.post {
                    try {
                        startLockTask()
                        kioskModeActive = true
                    } catch (_: Exception) {}
                }
            }
        }
    }

    private fun applyRotationPreference() {
        val prefs = getSharedPreferences("srservi_prefs", Context.MODE_PRIVATE)
        val allowRotation = prefs.getBoolean("allow_rotation", false)
        requestedOrientation = if (allowRotation)
            ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
        else
            ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
    }

    private fun updatePrinterStatus() {
        if (printerManager.isConnected()) {
            val name = printerManager.getConnectedDeviceName() ?: "Impresora"
            tvPrinterStatus.text = "Conectado: $name"
        } else {
            tvPrinterStatus.text = getString(R.string.disconnected)
        }
    }

}
