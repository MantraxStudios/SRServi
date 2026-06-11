package com.mantraxstudios.srservi.ui

import android.Manifest
import android.bluetooth.BluetoothDevice
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.appbar.MaterialToolbar
import com.google.android.material.button.MaterialButton
import com.mantraxstudios.srservi.R
import com.mantraxstudios.srservi.SRServiApp
import com.mantraxstudios.srservi.network.ApiService
import com.mantraxstudios.srservi.printer.BluetoothPrinterManager
import com.mantraxstudios.srservi.printer.PrinterForegroundService

class MultiplePrintersActivity : AppCompatActivity() {

    private lateinit var printerManager: BluetoothPrinterManager
    private lateinit var tvPlanStatus: TextView
    private lateinit var tvPrinterCount: TextView
    private lateinit var rvExtraPrinters: RecyclerView
    private lateinit var btnAddPrinter: MaterialButton

    private var maxPrinters = 1
    private var planName = "Gratis"
    private val extraMacs = mutableListOf<String>()

    private val bluetoothPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        if (permissions.values.all { it }) showAddPrinterDialog()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_multiple_printers)

        printerManager = (application as SRServiApp).printerManager

        val toolbar = findViewById<MaterialToolbar>(R.id.toolbarMulti)
        toolbar.setNavigationIcon(androidx.appcompat.R.drawable.abc_ic_ab_back_material)
        toolbar.setNavigationOnClickListener { finish() }

        tvPlanStatus = findViewById(R.id.tvMultiPlanStatus)
        tvPrinterCount = findViewById(R.id.tvMultiPrinterCount)
        rvExtraPrinters = findViewById(R.id.rvExtraPrinters)
        btnAddPrinter = findViewById(R.id.btnAddExtraPrinter)

        rvExtraPrinters.layoutManager = LinearLayoutManager(this)

        btnAddPrinter.setOnClickListener { requestBluetoothPermissions() }

        loadExtraMacs()
        loadPlanInfo()
    }

    override fun onResume() {
        super.onResume()
        refreshList()
    }

    private fun loadExtraMacs() {
        val prefs = getSharedPreferences(PrinterForegroundService.PREFS_NAME, Context.MODE_PRIVATE)
        val raw = prefs.getString(PrinterForegroundService.KEY_EXTRA_PRINTER_MACS, "") ?: ""
        extraMacs.clear()
        if (raw.isNotBlank()) {
            extraMacs.addAll(raw.split(",").map { it.trim() }.filter { it.isNotEmpty() })
        }
    }

    private fun saveExtraMacs() {
        getSharedPreferences(PrinterForegroundService.PREFS_NAME, Context.MODE_PRIVATE)
            .edit().putString(PrinterForegroundService.KEY_EXTRA_PRINTER_MACS, extraMacs.joinToString(",")).apply()
    }

    private fun loadPlanInfo() {
        val prefs = getSharedPreferences(PrinterForegroundService.PREFS_NAME, Context.MODE_PRIVATE)
        val storeCode = prefs.getString("store_code", "") ?: ""
        tvPlanStatus.text = "Verificando plan..."
        btnAddPrinter.isEnabled = false

        Thread {
            val info = if (storeCode.isNotBlank()) ApiService.fetchPlanInfo(storeCode) else null
            runOnUiThread {
                if (info != null) {
                    planName = info.planName
                    maxPrinters = info.maxPrinters
                    if (maxPrinters > 1) {
                        tvPlanStatus.text = "Plan: $planName — hasta $maxPrinters impresoras"
                        btnAddPrinter.isEnabled = extraMacs.size < maxPrinters - 1
                    } else {
                        tvPlanStatus.text = "Plan: $planName — solo 1 impresora. Actualiza al Plan Empresas para usar hasta 5."
                        btnAddPrinter.isEnabled = false
                    }
                } else {
                    tvPlanStatus.text = "No se pudo verificar el plan"
                    btnAddPrinter.isEnabled = false
                }
                refreshList()
            }
        }.start()
    }

    private fun refreshList() {
        val pairedDevices = printerManager.getPairedDevices()
        val items = extraMacs.map { mac ->
            val device = pairedDevices.find { it.address == mac }
            val name = if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
                ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED
            ) device?.name ?: "Desconocida" else "Desconocida"
            val connected = printerManager.isSecondaryConnected(mac)
            ExtraPrinterItem(mac, name, connected)
        }
        tvPrinterCount.text = "Impresoras adicionales: ${extraMacs.size} de ${maxPrinters - 1} disponibles"
        rvExtraPrinters.adapter = ExtraPrinterAdapter(items) { mac -> removePrinter(mac) }
        btnAddPrinter.isEnabled = maxPrinters > 1 && extraMacs.size < maxPrinters - 1
    }

    private fun removePrinter(mac: String) {
        AlertDialog.Builder(this)
            .setTitle("Quitar impresora")
            .setMessage("¿Eliminar esta impresora adicional?")
            .setPositiveButton("Quitar") { _, _ ->
                printerManager.disconnectSecondary(mac)
                extraMacs.remove(mac)
                saveExtraMacs()
                refreshList()
                Toast.makeText(this, "Impresora eliminada", Toast.LENGTH_SHORT).show()
            }
            .setNegativeButton("Cancelar", null)
            .show()
    }

    private fun requestBluetoothPermissions() {
        if (!printerManager.isBluetoothAvailable()) {
            Toast.makeText(this, "Bluetooth no disponible", Toast.LENGTH_SHORT).show()
            return
        }
        if (!printerManager.isBluetoothEnabled()) {
            Toast.makeText(this, "Activa el Bluetooth primero", Toast.LENGTH_SHORT).show()
            startActivity(android.content.Intent(Settings.ACTION_BLUETOOTH_SETTINGS))
            return
        }
        val permissions = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            arrayOf(Manifest.permission.BLUETOOTH_CONNECT, Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.ACCESS_FINE_LOCATION)
        } else {
            arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)
        }
        val needsPermission = permissions.any {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (needsPermission) bluetoothPermissionLauncher.launch(permissions)
        else showAddPrinterDialog()
    }

    private fun showAddPrinterDialog() {
        val dialogView = layoutInflater.inflate(R.layout.dialog_printer_select, null)
        val rvDevices = dialogView.findViewById<RecyclerView>(R.id.rvDevices)
        val tvNoDevices = dialogView.findViewById<TextView>(R.id.tvNoDevices)

        val allPaired = printerManager.getPairedDevices()
        val primaryMac = getSharedPreferences(PrinterForegroundService.PREFS_NAME, Context.MODE_PRIVATE)
            .getString(PrinterForegroundService.KEY_PRINTER_ADDRESS, null)
        // Exclude primary printer and already-added extras
        val available = allPaired.filter { it.address != primaryMac && it.address !in extraMacs }

        val dialog = AlertDialog.Builder(this)
            .setTitle("Agregar impresora adicional")
            .setView(dialogView)
            .setNegativeButton(R.string.cancel, null)
            .create()

        if (available.isEmpty()) {
            tvNoDevices.visibility = View.VISIBLE
            tvNoDevices.text = if (allPaired.isEmpty()) "No hay dispositivos Bluetooth emparejados"
                               else "Todas las impresoras emparejadas ya están configuradas"
            rvDevices.visibility = View.GONE
        } else {
            tvNoDevices.visibility = View.GONE
            rvDevices.visibility = View.VISIBLE
            rvDevices.layoutManager = LinearLayoutManager(this)
            rvDevices.adapter = PairedDeviceAdapter(available) { device ->
                dialog.dismiss()
                connectExtraPrinter(device)
            }
        }
        dialog.show()
    }

    private fun connectExtraPrinter(device: BluetoothDevice) {
        Toast.makeText(this, "Conectando...", Toast.LENGTH_SHORT).show()
        Thread {
            val success = printerManager.connectSecondary(device)
            runOnUiThread {
                if (success) {
                    if (!extraMacs.contains(device.address)) extraMacs.add(device.address)
                    saveExtraMacs()
                    refreshList()
                    Toast.makeText(this, "Impresora adicional conectada", Toast.LENGTH_SHORT).show()
                } else {
                    Toast.makeText(this, "No se pudo conectar", Toast.LENGTH_SHORT).show()
                }
            }
        }.start()
    }

    inner class PairedDeviceAdapter(
        private val devices: List<BluetoothDevice>,
        private val onClick: (BluetoothDevice) -> Unit
    ) : RecyclerView.Adapter<PairedDeviceAdapter.VH>() {
        inner class VH(view: View) : RecyclerView.ViewHolder(view) {
            val tvName: TextView = view.findViewById(R.id.tvDeviceName)
            val tvAddress: TextView = view.findViewById(R.id.tvDeviceAddress)
        }
        override fun onCreateViewHolder(p: ViewGroup, vt: Int) =
            VH(LayoutInflater.from(p.context).inflate(R.layout.item_bluetooth_device, p, false))
        override fun onBindViewHolder(h: VH, pos: Int) {
            val d = devices[pos]
            h.tvName.text = if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
                ContextCompat.checkSelfPermission(this@MultiplePrintersActivity, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED
            ) d.name ?: "Desconocido" else "Desconocido"
            h.tvAddress.text = d.address
            h.itemView.setOnClickListener { onClick(d) }
        }
        override fun getItemCount() = devices.size
    }

    data class ExtraPrinterItem(val mac: String, val name: String, val connected: Boolean)

    inner class ExtraPrinterAdapter(
        private val items: List<ExtraPrinterItem>,
        private val onRemove: (String) -> Unit
    ) : RecyclerView.Adapter<ExtraPrinterAdapter.VH>() {

        inner class VH(view: View) : RecyclerView.ViewHolder(view) {
            val tvName: TextView = view.findViewById(R.id.tvExtraPrinterName)
            val tvMac: TextView = view.findViewById(R.id.tvExtraPrinterMac)
            val tvStatus: TextView = view.findViewById(R.id.tvExtraPrinterStatus)
            val btnRemove: MaterialButton = view.findViewById(R.id.btnRemoveExtraPrinter)
        }

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
            val v = LayoutInflater.from(parent.context).inflate(R.layout.item_extra_printer, parent, false)
            return VH(v)
        }

        override fun onBindViewHolder(holder: VH, position: Int) {
            val item = items[position]
            holder.tvName.text = item.name
            holder.tvMac.text = item.mac
            holder.tvStatus.text = if (item.connected) "Conectada" else "Desconectada"
            holder.tvStatus.setTextColor(
                if (item.connected) getColor(android.R.color.holo_green_dark)
                else getColor(android.R.color.darker_gray)
            )
            holder.btnRemove.setOnClickListener { onRemove(item.mac) }
        }

        override fun getItemCount() = items.size
    }
}
