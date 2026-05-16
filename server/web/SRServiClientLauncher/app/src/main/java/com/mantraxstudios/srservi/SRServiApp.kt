package com.mantraxstudios.srservi

import android.Manifest
import android.app.Application
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import com.mantraxstudios.srservi.printer.BluetoothPrinterManager
import com.mantraxstudios.srservi.printer.PrinterForegroundService

class SRServiApp : Application() {

    lateinit var printerManager: BluetoothPrinterManager
        private set

    override fun onCreate() {
        super.onCreate()
        printerManager = BluetoothPrinterManager(this)
        printerManager.init()

        val prefs = getSharedPreferences("srservi_prefs", Context.MODE_PRIVATE)
        val paperWidth = prefs.getInt("paper_width", BluetoothPrinterManager.PAPER_58MM)
        printerManager.setPaperWidth(paperWidth)

        // Solo iniciar el servicio si ya tenemos los permisos de Bluetooth.
        // Si no, MainActivity los pedirá y arrancará el servicio después.
        if (hasBluetoothPermission()) {
            PrinterForegroundService.start(this)
        }
    }

    private fun hasBluetoothPermission(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            ContextCompat.checkSelfPermission(
                this, Manifest.permission.BLUETOOTH_CONNECT
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            true
        }
    }
}
