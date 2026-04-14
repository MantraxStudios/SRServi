package com.mantraxstudios.srservi.printer

import android.Manifest
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothSocket
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.ActivityCompat
import com.mantraxstudios.srservi.model.Order
import com.mantraxstudios.srservi.model.OrderItem
import java.io.IOException
import java.io.OutputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID
import java.util.concurrent.ConcurrentLinkedQueue

class BluetoothPrinterManager(private val context: Context) {

    companion object {
        private val SPP_UUID: UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")
        const val PAPER_44MM = 24
        const val PAPER_48MM = 26
        const val PAPER_57MM = 32
        const val PAPER_58MM = 32
        const val PAPER_76MM = 42
        const val PAPER_80MM = 48
        const val PAPER_110MM = 64
        const val PAPER_112MM = 66
    }

    private var bluetoothAdapter: BluetoothAdapter? = null
    private var socket: BluetoothSocket? = null
    private var outputStream: OutputStream? = null
    private var connectedDevice: BluetoothDevice? = null
    private val printQueue: ConcurrentLinkedQueue<Order> = ConcurrentLinkedQueue()
    private var isPrinting = false
    private var paperWidth = PAPER_58MM
    private var listener: PrinterListener? = null

    interface PrinterListener {
        fun onConnected(deviceName: String)
        fun onDisconnected()
        fun onPrintSuccess(orderNumber: String)
        fun onPrintError(orderNumber: String, error: String)
    }

    fun setListener(listener: PrinterListener) {
        this.listener = listener
    }

    fun setPaperWidth(width: Int) {
        paperWidth = width
    }

    fun getPaperWidth(): Int = paperWidth

    fun init() {
        val bluetoothManager = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
        bluetoothAdapter = bluetoothManager?.adapter
    }

    fun isBluetoothAvailable(): Boolean = bluetoothAdapter != null

    fun isBluetoothEnabled(): Boolean = bluetoothAdapter?.isEnabled == true

    fun isConnected(): Boolean = socket?.isConnected == true

    fun getConnectedDeviceName(): String? {
        if (!hasBluetoothPermission()) return null
        return connectedDevice?.name
    }

    fun getPairedDevices(): List<BluetoothDevice> {
        if (!hasBluetoothPermission()) return emptyList()
        return bluetoothAdapter?.bondedDevices?.toList() ?: emptyList()
    }

    private fun hasBluetoothPermission(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            ActivityCompat.checkSelfPermission(
                context, Manifest.permission.BLUETOOTH_CONNECT
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            true
        }
    }

    fun connect(device: BluetoothDevice): Boolean {
        if (!hasBluetoothPermission()) return false
        try {
            disconnect()
            socket = device.createRfcommSocketToServiceRecord(SPP_UUID)
            socket?.connect()
            outputStream = socket?.outputStream
            connectedDevice = device
            listener?.onConnected(device.name ?: "Impresora")
            return true
        } catch (e: IOException) {
            disconnect()
            return false
        }
    }

    fun disconnect() {
        try {
            outputStream?.close()
            socket?.close()
        } catch (_: IOException) {
        }
        outputStream = null
        socket = null
        connectedDevice = null
        listener?.onDisconnected()
    }

    fun addToQueue(order: Order) {
        printQueue.add(order)
        processQueue()
    }

    fun addAllToQueue(orders: List<Order>) {
        printQueue.addAll(orders)
        processQueue()
    }

    private fun processQueue() {
        if (isPrinting) return
        val order = printQueue.poll() ?: return

        isPrinting = true
        Thread {
            try {
                printReceipt(order)
                listener?.onPrintSuccess(order.orderNumber)
            } catch (e: Exception) {
                listener?.onPrintError(order.orderNumber, e.message ?: "Error desconocido")
            } finally {
                isPrinting = false
                if (printQueue.isNotEmpty()) {
                    processQueue()
                }
            }
        }.start()
    }

    private fun printReceipt(order: Order) {
        val os = outputStream ?: throw IOException("Impresora no conectada")

        val receipt = buildReceipt(order)
        os.write(receipt)
        os.flush()
    }

    private fun buildReceipt(order: Order): ByteArray {
        val builder = ReceiptBuilder(paperWidth)

        builder.initialize()
        builder.alignCenter()
        builder.setBold(true)
        builder.setDoubleSize(true)
        builder.addText("SRServi")
        builder.setDoubleSize(false)
        builder.addNewLine()
        builder.setBold(false)

        builder.addSeparator()

        builder.alignCenter()
        builder.setBold(true)
        builder.addText("Pedido: ${order.orderNumber}")
        builder.setBold(false)
        builder.addNewLine()

        val dateFormat = SimpleDateFormat("dd/MM/yyyy HH:mm", Locale.getDefault())
        builder.addText(dateFormat.format(Date()))
        builder.addNewLine()

        builder.addSeparator()

        builder.alignLeft()
        for (item in order.items) {
            builder.addText("${item.quantity}x ${item.productName}")
            builder.addNewLine()
            builder.alignRight()
            builder.addText("$${String.format("%.2f", item.unitPrice * item.quantity)}")
            builder.addNewLine()
            builder.alignLeft()

            if (item.selectedIngredients.isNotEmpty()) {
                builder.addText("  Ingredientes:")
                builder.addNewLine()
                for (ingredient in item.selectedIngredients) {
                    builder.addText("  - $ingredient")
                    builder.addNewLine()
                }
            }

            if (item.selectedExtras.isNotEmpty()) {
                builder.addText("  Extras:")
                builder.addNewLine()
                for (extra in item.selectedExtras) {
                    builder.addText("  - $extra")
                    builder.addNewLine()
                }
            }
        }

        builder.addSeparator()

        builder.addLeftRight("Subtotal:", "$${String.format("%.2f", order.subtotal)}")
        builder.addNewLine()

        if (order.discountTotal > 0) {
            builder.addLeftRight("Descuento:", "-$${String.format("%.2f", order.discountTotal)}")
            builder.addNewLine()
        }

        builder.setBold(true)
        builder.addLeftRight("TOTAL:", "$${String.format("%.2f", order.total)}")
        builder.addNewLine()
        builder.setBold(false)

        builder.addSeparator()

        val paymentLabel = when (order.paymentMethod) {
            "card" -> "Tarjeta"
            "cash" -> "Efectivo"
            else -> order.paymentMethod
        }
        builder.addLeftRight("Pago:", paymentLabel)
        builder.addNewLine()

        if (order.couponCode != null) {
            builder.addLeftRight("Cupon:", order.couponCode)
            builder.addNewLine()
        }

        builder.addSeparator()
        builder.alignCenter()
        builder.addText("Gracias por su compra")
        builder.addNewLine()
        builder.addNewLine()
        builder.addNewLine()

        builder.cut()

        return builder.build()
    }

    fun printTestPage() {
        val os = outputStream ?: return

        Thread {
            try {
                val builder = ReceiptBuilder(paperWidth)
                builder.initialize()
                builder.alignCenter()
                builder.setBold(true)
                builder.setDoubleSize(true)
                builder.addText("SRServi")
                builder.setDoubleSize(false)
                builder.addNewLine()
                builder.setBold(false)
                builder.addSeparator()
                builder.addText("Pagina de prueba")
                builder.addNewLine()
                builder.addText("Impresora OK")
                builder.addNewLine()
                builder.addText("Papel: ${paperWidth} chars")
                builder.addNewLine()
                builder.addSeparator()
                builder.addNewLine()
                builder.addNewLine()
                builder.cut()

                os.write(builder.build())
                os.flush()
            } catch (_: IOException) {
            }
        }.start()
    }
}

class ReceiptBuilder(private val width: Int) {

    private val data = mutableListOf<Byte>()

    fun initialize() {
        addBytes(byteArrayOf(0x1B, 0x40))
    }

    fun alignLeft() {
        addBytes(byteArrayOf(0x1B, 0x61, 0x00))
    }

    fun alignCenter() {
        addBytes(byteArrayOf(0x1B, 0x61, 0x01))
    }

    fun alignRight() {
        addBytes(byteArrayOf(0x1B, 0x61, 0x02))
    }

    fun setBold(on: Boolean) {
        addBytes(byteArrayOf(0x1B, 0x45, if (on) 0x01 else 0x00))
    }

    fun setDoubleSize(on: Boolean) {
        if (on) {
            addBytes(byteArrayOf(0x1D, 0x21, 0x11))
        } else {
            addBytes(byteArrayOf(0x1D, 0x21, 0x00))
        }
    }

    fun addText(text: String) {
        addBytes(text.toByteArray(Charsets.UTF_8))
    }

    fun addNewLine() {
        addBytes(byteArrayOf(0x0A))
    }

    fun addSeparator() {
        val line = "-".repeat(width)
        addText(line)
        addNewLine()
    }

    fun addLeftRight(left: String, right: String) {
        val spaces = width - left.length - right.length
        if (spaces > 0) {
            alignLeft()
            addText(left + " ".repeat(spaces) + right)
        } else {
            addText(left)
            addNewLine()
            alignRight()
            addText(right)
            alignLeft()
        }
    }

    fun cut() {
        addBytes(byteArrayOf(0x1D, 0x56, 0x00))
    }

    private fun addBytes(bytes: ByteArray) {
        for (b in bytes) {
            data.add(b)
        }
    }

    fun build(): ByteArray {
        return data.toByteArray()
    }
}
