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
import com.mantraxstudios.srservi.model.TicketPurchase
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
        const val MAX_EXTRA_PRINTERS = 9  // 1 primary + 9 extra = 10 total máximo (plan Personalizado)
    }

    data class SecondaryConnection(
        val device: BluetoothDevice,
        var socket: BluetoothSocket? = null,
        var outputStream: OutputStream? = null
    ) {
        val address: String get() = device.address
    }

    private var bluetoothAdapter: BluetoothAdapter? = null
    private var socket: BluetoothSocket? = null
    private var outputStream: OutputStream? = null
    private var connectedDevice: BluetoothDevice? = null
    private val secondaryConnections = mutableListOf<SecondaryConnection>()
    private val printQueue: ConcurrentLinkedQueue<Order> = ConcurrentLinkedQueue()
    private val ticketQueue: ConcurrentLinkedQueue<TicketPurchase> = ConcurrentLinkedQueue()
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

    // ── Impresoras secundarias (Plan Empresas, máx 4 extra) ──

    fun connectSecondary(device: BluetoothDevice): Boolean {
        if (!hasBluetoothPermission()) return false
        disconnectSecondary(device.address)
        return try {
            val sock = device.createRfcommSocketToServiceRecord(SPP_UUID)
            sock.connect()
            secondaryConnections.add(SecondaryConnection(device, sock, sock.outputStream))
            true
        } catch (_: IOException) {
            false
        }
    }

    fun disconnectSecondary(address: String) {
        val conn = secondaryConnections.find { it.address == address } ?: return
        try { conn.outputStream?.close(); conn.socket?.close() } catch (_: IOException) {}
        secondaryConnections.removeAll { it.address == address }
    }

    fun getSecondaryConnections(): List<SecondaryConnection> = secondaryConnections.toList()

    fun isSecondaryConnected(address: String): Boolean =
        secondaryConnections.any { it.address == address && it.socket?.isConnected == true }

    private fun getAllOutputStreams(): List<OutputStream> {
        val streams = mutableListOf<OutputStream>()
        outputStream?.let { streams.add(it) }
        secondaryConnections.forEach { conn -> conn.outputStream?.let { streams.add(it) } }
        return streams
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

        val order = printQueue.poll()
        if (order != null) {
            isPrinting = true
            Thread {
                try {
                    printReceipt(order)
                    listener?.onPrintSuccess(order.orderNumber)
                } catch (e: Exception) {
                    listener?.onPrintError(order.orderNumber, e.message ?: "Error desconocido")
                } finally {
                    isPrinting = false
                    if (printQueue.isNotEmpty() || ticketQueue.isNotEmpty()) processQueue()
                }
            }.start()
            return
        }

        val purchase = ticketQueue.poll()
        if (purchase != null) {
            isPrinting = true
            Thread {
                try {
                    val streams = getAllOutputStreams()
                    if (streams.isEmpty()) throw IOException("Impresora no conectada")
                    val receipt = buildTicketPurchaseReceipt(purchase)
                    var lastError: Exception? = null
                    var successCount = 0
                    for (os in streams) {
                        try { os.write(receipt); os.flush(); successCount++ }
                        catch (e: Exception) { lastError = e }
                    }
                    if (successCount == 0) throw lastError ?: IOException("Error al imprimir")
                    listener?.onPrintSuccess(purchase.viewerCode)
                } catch (e: Exception) {
                    listener?.onPrintError(purchase.viewerCode, e.message ?: "Error")
                } finally {
                    isPrinting = false
                    if (printQueue.isNotEmpty() || ticketQueue.isNotEmpty()) processQueue()
                }
            }.start()
        }
    }

    private fun printReceipt(order: Order) {
        val streams = getAllOutputStreams()
        if (streams.isEmpty()) throw IOException("Impresora no conectada")
        val receipt = buildReceipt(order)
        var lastError: Exception? = null
        var successCount = 0
        for (os in streams) {
            try { os.write(receipt); os.flush(); successCount++ }
            catch (e: Exception) { lastError = e }
        }
        if (successCount == 0) throw lastError ?: IOException("Error al imprimir")
    }

    /**
     * Imprime las opciones (extras / complementos) agrupadas por la categoría que
     * definió el administrador. Si una opción no trae categoría se agrupa bajo el
     * rótulo por defecto (Extras / Complementos). Usa el detalle con categorías si
     * está disponible; si no, cae al listado plano (compatibilidad con el server viejo).
     */
    private fun printGroupedOptions(
        builder: ReceiptBuilder,
        detail: List<com.mantraxstudios.srservi.model.SelectedOption>,
        fallbackNames: List<String>,
        defaultLabel: String
    ) {
        val options = if (detail.isNotEmpty()) {
            detail
        } else {
            fallbackNames.map { com.mantraxstudios.srservi.model.SelectedOption(it, "") }
        }
        if (options.isEmpty()) return

        // Agrupa conservando el orden de aparición de cada categoría.
        val grouped = LinkedHashMap<String, MutableList<String>>()
        for (opt in options) {
            val header = opt.group.ifBlank { defaultLabel }
            grouped.getOrPut(header) { mutableListOf() }.add(opt.name)
        }
        for ((header, names) in grouped) {
            builder.addText("  $header:")
            builder.addNewLine()
            for (name in names) {
                builder.addText("  - $name")
                builder.addNewLine()
            }
        }
    }

    private fun buildReceipt(order: Order): ByteArray {
        if (order.orderType == "ticketeria") {
            return buildTicketeriaReceipt(order)
        }
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

            printGroupedOptions(builder, item.selectedExtrasDetail, item.selectedExtras, "Extras")
            printGroupedOptions(builder, item.selectedComplementsDetail, item.selectedComplements, "Complementos")
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

        // Comentario que dejó el cliente al pagar en el tótem (Store.jsx -> customer_comment)
        if (!order.customerComment.isNullOrBlank()) {
            builder.addSeparator()
            builder.alignLeft()
            builder.setBold(true)
            builder.addText("NOTA:")
            builder.setBold(false)
            builder.addNewLine()
            builder.addText(order.customerComment.trim())
            builder.addNewLine()
        }

        builder.addSeparator()
        builder.alignCenter()
        builder.setBold(true)
        builder.setDoubleSize(true)
        val serviceLabel = if (order.serviceType == "llevar") "PARA LLEVAR" else "PARA SERVIR"
        builder.addText(serviceLabel)
        builder.setDoubleSize(false)
        builder.setBold(false)
        if (order.tableNumber != null) {
            builder.addNewLine()
            builder.setBold(true)
            builder.addText("Mesa #${order.tableNumber}")
            builder.setBold(false)
        }
        builder.addNewLine()
        builder.addNewLine()
        builder.addNewLine()

        builder.cut()

        return builder.build()
    }

    private fun buildTicketeriaReceipt(order: Order): ByteArray {
        val builder = ReceiptBuilder(paperWidth)
        val dateFormat = SimpleDateFormat("dd/MM/yyyy HH:mm", Locale.getDefault())
        val showDateFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault())

        builder.initialize()

        // Header
        builder.alignCenter()
        builder.setBold(true)
        builder.setDoubleSize(true)
        builder.addText("SRServi")
        builder.setDoubleSize(false)
        builder.addNewLine()
        builder.setBold(false)
        builder.addSeparator()

        // Event name
        if (!order.eventName.isNullOrBlank()) {
            builder.setBold(true)
            builder.setDoubleSize(true)
            builder.addText(order.eventName)
            builder.setDoubleSize(false)
            builder.setBold(false)
            builder.addNewLine()
        }

        // Show time
        if (!order.showTime.isNullOrBlank()) {
            try {
                val showDate = showDateFormat.parse(order.showTime)
                if (showDate != null) {
                    val formatted = SimpleDateFormat("dd/MM/yyyy HH:mm", Locale.getDefault()).format(showDate)
                    builder.addText("Fecha del show: $formatted")
                } else {
                    builder.addText("Fecha del show: ${order.showTime}")
                }
            } catch (_: Exception) {
                builder.addText("Fecha del show: ${order.showTime}")
            }
            builder.addNewLine()
        }

        builder.addSeparator()

        // Order info
        builder.addText("Pedido: ${order.orderNumber}")
        builder.addNewLine()
        builder.addText("Comprado: ${dateFormat.format(Date())}")
        builder.addNewLine()
        builder.addSeparator()

        // QR code (encoded from order number)
        builder.addQrCode(order.orderNumber)
        builder.addNewLine()

        // Code text under QR
        builder.setBold(true)
        builder.addText("Cod: ${order.orderNumber}")
        builder.setBold(false)
        builder.addNewLine()
        builder.addSeparator()

        // Items purchased
        builder.alignLeft()
        builder.addText("Lo que compraste:")
        builder.addNewLine()
        builder.addNewLine()
        for (item in order.items) {
            builder.addText("${item.quantity}x ${item.productName}")
            builder.addNewLine()
            builder.alignRight()
            builder.addText("$${String.format("%.2f", item.unitPrice * item.quantity)}")
            builder.addNewLine()
            builder.alignLeft()
        }

        builder.addSeparator()
        builder.setBold(true)
        builder.addLeftRight("TOTAL:", "$${String.format("%.2f", order.total)}")
        builder.addNewLine()
        builder.setBold(false)
        builder.addSeparator()

        builder.alignCenter()
        builder.addText("Presentar QR en el ingreso")
        builder.addNewLine()
        builder.addNewLine()
        builder.addNewLine()
        builder.addNewLine()
        builder.addNewLine()
        builder.addNewLine()
        builder.cut()

        return builder.build()
    }

    fun addToQueueTicketPurchase(purchase: TicketPurchase) {
        ticketQueue.add(purchase)
        processQueue()
    }

    private fun buildTicketPurchaseReceipt(purchase: TicketPurchase): ByteArray {
        val builder = ReceiptBuilder(paperWidth)
        val dateFormat = SimpleDateFormat("dd/MM/yyyy HH:mm", Locale.getDefault())

        builder.initialize()

        // Header
        builder.alignCenter()
        builder.setBold(true)
        builder.setDoubleSize(true)
        builder.addText("SRServi")
        builder.setDoubleSize(false)
        builder.addNewLine()
        builder.setBold(false)
        builder.addSeparator()

        // Nombre del evento
        if (!purchase.eventName.isNullOrBlank()) {
            builder.setBold(true)
            builder.setDoubleSize(true)
            builder.addText(purchase.eventName)
            builder.setDoubleSize(false)
            builder.setBold(false)
            builder.addNewLine()
        }

        // Fecha del show
        if (!purchase.showTime.isNullOrBlank()) {
            try {
                val fmt = SimpleDateFormat("yyyy-MM-dd'T'HH:mm", Locale.getDefault())
                val d = fmt.parse(purchase.showTime)
                if (d != null) builder.addText("Fecha: ${dateFormat.format(d)}")
                else builder.addText("Fecha: ${purchase.showTime}")
            } catch (_: Exception) {
                builder.addText("Fecha: ${purchase.showTime}")
            }
            builder.addNewLine()
        }

        builder.addSeparator()

        // Código y fecha de compra
        builder.addText("Cod: ${purchase.viewerCode}")
        builder.addNewLine()
        builder.addText("Compra: ${dateFormat.format(Date())}")
        builder.addNewLine()
        builder.addSeparator()

        // QR — usa la URL completa para que sea escaneable
        builder.addQrCode(purchase.qrUrl)
        builder.addNewLine()
        builder.alignCenter()
        builder.setBold(true)
        builder.addText(purchase.viewerCode)
        builder.setBold(false)
        builder.addNewLine()
        builder.addSeparator()

        // Detalle de entradas
        builder.alignLeft()
        builder.addText("Entradas:")
        builder.addNewLine()
        for (item in purchase.items) {
            builder.addText("${item.quantity}x ${item.categoryName}")
            builder.addNewLine()
            builder.alignRight()
            builder.addText("$${String.format("%.2f", item.unitPrice * item.quantity)}")
            builder.addNewLine()
            builder.alignLeft()
        }

        builder.addSeparator()
        builder.setBold(true)
        builder.addLeftRight("TOTAL:", "$${String.format("%.2f", purchase.totalAmount)}")
        builder.addNewLine()
        builder.setBold(false)
        builder.addSeparator()

        builder.alignCenter()
        builder.addText("Presentar QR en el ingreso")
        builder.addNewLine()
        builder.addNewLine()
        builder.addNewLine()
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

    fun addQrCode(data: String) {
        val dataBytes = data.toByteArray(Charsets.UTF_8)
        val dataLen = dataBytes.size + 3
        val pL = (dataLen and 0xFF).toByte()
        val pH = ((dataLen shr 8) and 0xFF).toByte()

        // Set error correction level M
        addBytes(byteArrayOf(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, 0x31))
        // Set module size (5 dots = ~5mm per module, good scan size)
        addBytes(byteArrayOf(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, 0x05))
        // Store QR data
        addBytes(byteArrayOf(0x1D, 0x28, 0x6B, pL, pH, 0x31, 0x50, 0x30))
        addBytes(dataBytes)
        // Print QR
        addBytes(byteArrayOf(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30))
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
