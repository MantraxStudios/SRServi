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
                val url = "https://srservi2.srautomatic.com/rate/$storeCode"
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
        try {
            val url = if (storeCode.isNotBlank()) {
                "https://srservi2.srautomatic.com/api/apps/android/download?appName=launcher&storeCode=$storeCode"
            } else {
                "https://srservi2.srautomatic.com/api/apps/android/download?appName=launcher"
            }

            val request = DownloadManager.Request(Uri.parse(url))
                .setTitle("SRServi POS - Actualización")
                .setDescription("Descargando nueva versión...")
                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, "SRServi-POS.apk")
                .setMimeType("application/vnd.android.package-archive")

            val dm = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
            dm.enqueue(request)

            Toast.makeText(this, "Descargando actualización... Revisa tus notificaciones.", Toast.LENGTH_LONG).show()
        } catch (e: Exception) {
            Toast.makeText(this, "Error al descargar: ${e.message}", Toast.LENGTH_LONG).show()
            updateDialogShown = false
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
