package com.mantraxstudios.srservi.ui

import android.Manifest
import android.app.admin.DevicePolicyManager
import android.bluetooth.BluetoothDevice
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.View
import android.view.ViewGroup
import android.widget.ArrayAdapter
import android.widget.Spinner
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.appbar.MaterialToolbar
import com.google.android.material.button.MaterialButton
import com.google.android.material.switchmaterial.SwitchMaterial
import com.google.android.material.textfield.TextInputEditText
import com.mantraxstudios.srservi.R
import com.mantraxstudios.srservi.SRServiApp
import com.mantraxstudios.srservi.admin.SRServiDeviceAdminReceiver
import com.mantraxstudios.srservi.printer.BluetoothPrinterManager
import com.mantraxstudios.srservi.printer.PrinterForegroundService

class SettingsActivity : AppCompatActivity() {

    private lateinit var etStoreCode: TextInputEditText
    private lateinit var spinnerPaperSize: Spinner
    private lateinit var switchKiosk: SwitchMaterial
    private lateinit var tvPrinterStatus: TextView
    private lateinit var printerManager: BluetoothPrinterManager

    // Opciones del spinner: par (label, valor en mm)
    private val paperSizeOptions = listOf(
        "44mm — rollo angosto (24 caracteres)" to BluetoothPrinterManager.PAPER_44MM,
        "48mm (26 caracteres)" to BluetoothPrinterManager.PAPER_48MM,
        "57mm (32 caracteres)" to BluetoothPrinterManager.PAPER_57MM,
        "58mm — rollo estandar (32 caracteres)" to BluetoothPrinterManager.PAPER_58MM,
        "76mm (42 caracteres)" to BluetoothPrinterManager.PAPER_76MM,
        "80mm — rollo ancho (48 caracteres)" to BluetoothPrinterManager.PAPER_80MM,
        "110mm (64 caracteres)" to BluetoothPrinterManager.PAPER_110MM,
        "112mm (66 caracteres)" to BluetoothPrinterManager.PAPER_112MM
    )

    private val bluetoothPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        if (permissions.values.all { it }) showPrinterDialog()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_settings)

        printerManager = (application as SRServiApp).printerManager

        val toolbar = findViewById<MaterialToolbar>(R.id.toolbar)
        toolbar.setNavigationIcon(androidx.appcompat.R.drawable.abc_ic_ab_back_material)
        toolbar.setNavigationOnClickListener { finish() }

        etStoreCode = findViewById(R.id.etStoreCode)
        spinnerPaperSize = findViewById(R.id.spinnerPaperSize)
        switchKiosk = findViewById(R.id.switchKiosk)
        tvPrinterStatus = findViewById(R.id.tvPrinterStatus)

        val adapter = ArrayAdapter(
            this,
            android.R.layout.simple_spinner_item,
            paperSizeOptions.map { it.first }
        )
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        spinnerPaperSize.adapter = adapter

        loadSettings()

        findViewById<MaterialButton>(R.id.btnConfigPrinter).setOnClickListener {
            requestBluetoothPermissions()
        }
        findViewById<MaterialButton>(R.id.btnBluetooth).setOnClickListener {
            startActivity(Intent(Settings.ACTION_BLUETOOTH_SETTINGS))
        }
        findViewById<MaterialButton>(R.id.btnWifi).setOnClickListener {
            startActivity(Intent(Settings.ACTION_WIFI_SETTINGS))
        }
        findViewById<MaterialButton>(R.id.btnDeviceSettings).setOnClickListener {
            startActivity(Intent(Settings.ACTION_SETTINGS))
        }
        findViewById<MaterialButton>(R.id.btnPrintQueue).setOnClickListener {
            startActivity(Intent(this, PrintQueueActivity::class.java))
        }
        findViewById<MaterialButton>(R.id.btnClearCache).setOnClickListener { clearAppCache() }
        findViewById<MaterialButton>(R.id.btnSave).setOnClickListener { saveSettings() }
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

    private fun loadSettings() {
        val prefs = getSharedPreferences("srservi_prefs", Context.MODE_PRIVATE)
        etStoreCode.setText(prefs.getString("store_code", ""))

        val paperWidth = prefs.getInt("paper_width", BluetoothPrinterManager.PAPER_58MM)
        val index = paperSizeOptions.indexOfFirst { it.second == paperWidth }.takeIf { it >= 0 } ?: 3
        spinnerPaperSize.setSelection(index)

        val kioskMode = prefs.getBoolean("kiosk_mode", false)
        switchKiosk.isChecked = kioskMode

        val dpm = getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        if (!dpm.isDeviceOwnerApp(packageName)) {
            switchKiosk.isEnabled = false
            switchKiosk.text = "Requiere Device Owner"
        }
    }

    private fun saveSettings() {
        val prefs = getSharedPreferences("srservi_prefs", Context.MODE_PRIVATE)
        val editor = prefs.edit()

        editor.putString("store_code", etStoreCode.text.toString().trim())

        val paperWidth = paperSizeOptions[spinnerPaperSize.selectedItemPosition].second
        editor.putInt("paper_width", paperWidth)

        val kioskMode = switchKiosk.isChecked
        editor.putBoolean("kiosk_mode", kioskMode)

        editor.apply()

        printerManager.setPaperWidth(paperWidth)

        if (kioskMode) {
            val dpm = getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
            if (dpm.isDeviceOwnerApp(packageName)) {
                val adminComponent = SRServiDeviceAdminReceiver.getComponentName(this)
                dpm.setLockTaskPackages(adminComponent, arrayOf(packageName))
            }
        }

        Toast.makeText(this, "Configuracion guardada", Toast.LENGTH_SHORT).show()
        finish()
    }

    private fun requestBluetoothPermissions() {
        val permissions = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            arrayOf(
                Manifest.permission.BLUETOOTH_CONNECT,
                Manifest.permission.BLUETOOTH_SCAN,
                Manifest.permission.ACCESS_FINE_LOCATION
            )
        } else {
            arrayOf(
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
            )
        }
        val needsPermission = permissions.any {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (needsPermission) {
            bluetoothPermissionLauncher.launch(permissions)
        } else {
            showPrinterDialog()
        }
    }

    private fun showPrinterDialog() {
        if (!printerManager.isBluetoothAvailable()) {
            Toast.makeText(this, "Bluetooth no disponible", Toast.LENGTH_SHORT).show()
            return
        }

        if (!printerManager.isBluetoothEnabled()) {
            Toast.makeText(this, "Activa el Bluetooth primero", Toast.LENGTH_SHORT).show()
            startActivity(Intent(Settings.ACTION_BLUETOOTH_SETTINGS))
            return
        }

        val dialogView = layoutInflater.inflate(R.layout.dialog_printer_select, null)
        val rvDevices = dialogView.findViewById<RecyclerView>(R.id.rvDevices)
        val tvNoDevices = dialogView.findViewById<TextView>(R.id.tvNoDevices)

        val devices = printerManager.getPairedDevices()

        val dialog = AlertDialog.Builder(this)
            .setTitle(R.string.printer_setup_title)
            .setView(dialogView)
            .setNegativeButton(R.string.cancel, null)
            .create()

        if (devices.isEmpty()) {
            tvNoDevices.visibility = View.VISIBLE
            rvDevices.visibility = View.GONE
        } else {
            tvNoDevices.visibility = View.GONE
            rvDevices.visibility = View.VISIBLE
            rvDevices.layoutManager = LinearLayoutManager(this)
            rvDevices.adapter = BluetoothDeviceAdapter(devices) { device ->
                dialog.dismiss()
                connectToPrinter(device)
            }
        }

        dialog.show()
    }

    private fun clearAppCache() {
        cacheDir.deleteRecursively()
        externalCacheDir?.deleteRecursively()
        Toast.makeText(this, getString(R.string.cache_cleared), Toast.LENGTH_SHORT).show()
    }

    private fun connectToPrinter(device: BluetoothDevice) {
        tvPrinterStatus.text = "Conectando..."

        Thread {
            val success = printerManager.connect(device)
            runOnUiThread {
                if (success) {
                    val name = printerManager.getConnectedDeviceName() ?: "Impresora"
                    tvPrinterStatus.text = "Conectado: $name"
                    // Guardar MAC para auto-reconexión al reiniciar
                    getSharedPreferences(PrinterForegroundService.PREFS_NAME, Context.MODE_PRIVATE)
                        .edit().putString(PrinterForegroundService.KEY_PRINTER_ADDRESS, device.address).apply()
                    Toast.makeText(this, "Impresora conectada", Toast.LENGTH_SHORT).show()
                } else {
                    tvPrinterStatus.text = getString(R.string.disconnected)
                    Toast.makeText(this, "Error al conectar", Toast.LENGTH_SHORT).show()
                }
            }
        }.start()
    }

    inner class BluetoothDeviceAdapter(
        private val devices: List<BluetoothDevice>,
        private val onClick: (BluetoothDevice) -> Unit
    ) : RecyclerView.Adapter<BluetoothDeviceAdapter.ViewHolder>() {

        inner class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
            val tvName: TextView = view.findViewById(R.id.tvDeviceName)
            val tvAddress: TextView = view.findViewById(R.id.tvDeviceAddress)
        }

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
            val view = layoutInflater.inflate(R.layout.item_bluetooth_device, parent, false)
            return ViewHolder(view)
        }

        override fun onBindViewHolder(holder: ViewHolder, position: Int) {
            val device = devices[position]
            if (ActivityCompat.checkSelfPermission(
                    this@SettingsActivity, Manifest.permission.BLUETOOTH_CONNECT
                ) == PackageManager.PERMISSION_GRANTED || Build.VERSION.SDK_INT < Build.VERSION_CODES.S
            ) {
                holder.tvName.text = device.name ?: "Dispositivo desconocido"
            } else {
                holder.tvName.text = "Dispositivo desconocido"
            }
            holder.tvAddress.text = device.address
            holder.itemView.setOnClickListener { onClick(device) }
        }

        override fun getItemCount(): Int = devices.size
    }
}
