package com.mantraxstudios.srservi

import android.Manifest
import android.app.admin.DevicePolicyManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.View
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
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

    // Permisos necesarios con su descripcion para el usuario
    private data class PermissionInfo(
        val permission: String,
        val nombre: String,
        val motivo: String
    )

    private fun requiredPermissions(): List<PermissionInfo> {
        val lista = mutableListOf<PermissionInfo>()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            lista += PermissionInfo(
                Manifest.permission.BLUETOOTH_CONNECT,
                "Bluetooth (Conectar)",
                "Necesario para conectar la impresora Bluetooth y imprimir recibos."
            )
            lista += PermissionInfo(
                Manifest.permission.BLUETOOTH_SCAN,
                "Bluetooth (Buscar)",
                "Necesario para encontrar y emparejar la impresora Bluetooth."
            )
        }

        lista += PermissionInfo(
            Manifest.permission.ACCESS_FINE_LOCATION,
            "Ubicacion",
            "Android requiere este permiso para poder usar Bluetooth y encontrar la impresora."
        )

        if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.P) {
            lista += PermissionInfo(
                Manifest.permission.WRITE_EXTERNAL_STORAGE,
                "Almacenamiento",
                "Necesario para guardar recibos en el dispositivo."
            )
        } else if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.S_V2) {
            lista += PermissionInfo(
                Manifest.permission.READ_EXTERNAL_STORAGE,
                "Almacenamiento",
                "Necesario para leer archivos de recibos."
            )
        }

        return lista
    }

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { results ->
        val denied = requiredPermissions().filter { info ->
            results[info.permission] == false
        }
        if (denied.isNotEmpty()) {
            showPermissionDeniedDialog(denied)
        } else {
            // Todos los permisos otorgados — arrancar el servicio de impresion
            PrinterForegroundService.start(this)
        }
    }

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

        setupKioskMode()
        checkAndRequestPermissions()
    }

    // Verifica cuales permisos faltan y los pide todos juntos
    private fun checkAndRequestPermissions() {
        val missing = requiredPermissions()
            .map { it.permission }
            .filter { ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED }

        if (missing.isNotEmpty()) {
            // Antes de pedir, explica para que sirve cada uno
            val infos = requiredPermissions().filter { it.permission in missing }
            showPermissionRationaleDialog(infos) {
                permissionLauncher.launch(missing.toTypedArray())
            }
        }
    }

    // Dialog explicativo ANTES de pedir los permisos
    private fun showPermissionRationaleDialog(
        permisos: List<PermissionInfo>,
        onAceptar: () -> Unit
    ) {
        val mensaje = buildString {
            appendLine("Esta app necesita los siguientes permisos para funcionar correctamente:\n")
            permisos.forEach { info ->
                appendLine("• ${info.nombre}")
                appendLine("  ${info.motivo}\n")
            }
        }

        AlertDialog.Builder(this)
            .setTitle("Permisos necesarios")
            .setMessage(mensaje.trim())
            .setCancelable(false)
            .setPositiveButton("Entendido, continuar") { _, _ -> onAceptar() }
            .show()
    }

    // Dialog si el usuario nego un permiso, con opcion de ir a ajustes
    private fun showPermissionDeniedDialog(denied: List<PermissionInfo>) {
        val permanentlyDenied = denied.filter { info ->
            !shouldShowRequestPermissionRationale(info.permission)
        }
        val soloNegados = denied.filter { info ->
            shouldShowRequestPermissionRationale(info.permission)
        }

        val mensaje = buildString {
            if (permanentlyDenied.isNotEmpty()) {
                appendLine("Los siguientes permisos fueron BLOQUEADOS. Debes activarlos manualmente en Ajustes del sistema:\n")
                permanentlyDenied.forEach { appendLine("• ${it.nombre}: ${it.motivo}\n") }
                appendLine("Presiona \"Ir a Ajustes\" y activa cada permiso en la seccion \"Permisos\".")
            } else {
                appendLine("Los siguientes permisos son necesarios para que la app funcione:\n")
                soloNegados.forEach { appendLine("• ${it.nombre}: ${it.motivo}\n") }
            }
        }

        val builder = AlertDialog.Builder(this)
            .setTitle("Permisos requeridos")
            .setMessage(mensaje.trim())
            .setCancelable(false)

        if (permanentlyDenied.isNotEmpty()) {
            builder.setPositiveButton("Ir a Ajustes") { _, _ ->
                startActivity(
                    Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                        data = Uri.fromParts("package", packageName, null)
                    }
                )
            }
            builder.setNegativeButton("Omitir por ahora", null)
        } else {
            builder.setPositiveButton("Volver a intentar") { _, _ ->
                permissionLauncher.launch(denied.map { it.permission }.toTypedArray())
            }
            builder.setNegativeButton("Omitir por ahora", null)
        }

        builder.show()
    }

    private fun setupKioskMode() {
        val prefs = getSharedPreferences("srservi_prefs", Context.MODE_PRIVATE)
        val kioskEnabled = prefs.getBoolean("kiosk_mode", false)
        if (!kioskEnabled) return

        val dpm = getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        val adminComponent = SRServiDeviceAdminReceiver.getComponentName(this)

        if (dpm.isDeviceOwnerApp(packageName)) {
            dpm.setLockTaskPackages(adminComponent, arrayOf(packageName))
            startLockTask()
        }
    }

    override fun onResume() {
        super.onResume()
        updatePrinterStatus()
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
