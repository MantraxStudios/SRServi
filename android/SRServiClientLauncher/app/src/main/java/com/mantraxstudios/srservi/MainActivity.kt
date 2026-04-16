package com.mantraxstudios.srservi

import android.app.admin.DevicePolicyManager
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import com.mantraxstudios.srservi.admin.SRServiDeviceAdminReceiver
import com.mantraxstudios.srservi.printer.BluetoothPrinterManager
import com.mantraxstudios.srservi.printer.PrinterForegroundService
import com.mantraxstudios.srservi.ui.SellActivity
import com.mantraxstudios.srservi.ui.SettingsActivity
import com.mantraxstudios.srservi.ui.WorkerLoginActivity

class MainActivity : AppCompatActivity() {

    private lateinit var printerManager: BluetoothPrinterManager
    private lateinit var tvPrinterStatus: TextView

    // Evita llamar startLockTask() más de una vez
    private var kioskModeActive = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.main)) { v, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            v.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom)
            insets
        }

        tvPrinterStatus = findViewById(R.id.tvPrinterStatus)
        printerManager = (application as SRServiApp).printerManager

        findViewById<View>(R.id.btnStartSelling).setOnClickListener {
            startActivity(Intent(this, SellActivity::class.java))
        }

        findViewById<View>(R.id.btnWorkerLogin).setOnClickListener {
            startActivity(Intent(this, WorkerLoginActivity::class.java))
        }

        findViewById<View>(R.id.btnAppSettings).setOnClickListener {
            startActivity(Intent(this, SettingsActivity::class.java))
        }
    }

    override fun onResume() {
        super.onResume()

        // El servicio se inicia SIEMPRE para que onTaskRemoved pueda relanzar
        // la app aunque el wizard todavía no esté completo.
        // BluetoothPrinterManager ya maneja gracefully la falta de permisos.
        PrinterForegroundService.start(this)

        // Si falta algún permiso o configuración crítica, mostrar el wizard.
        // El kiosk/lock-task se activa DESPUÉS del wizard para que el usuario
        // pueda navegar a los ajustes del sistema durante la configuración.
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

    private fun setupKioskMode() {
        val dpm = getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        val adminComponent = SRServiDeviceAdminReceiver.getComponentName(this)

        if (dpm.isDeviceOwnerApp(packageName)) {
            dpm.setLockTaskPackages(adminComponent, arrayOf(packageName))
            if (!kioskModeActive) {
                // Post to next frame so the UI renders before the system call blocks
                window.decorView.post {
                    startLockTask()
                    kioskModeActive = true
                }
            }
        }
        // Sin Device Owner, el modo kiosk se logra combinando:
        //   - La app registrada como HOME launcher (el botón Inicio regresa a la app)
        //   - onBackPressed bloqueado (arriba)
        //   - excludeFromRecents en el manifest
        //   - PrinterForegroundService.onTaskRemoved relanza la app si la cierran
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
