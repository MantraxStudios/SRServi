package com.mantraxstudios.srservi.ui

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Bundle
import android.view.Gravity
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import com.google.android.material.appbar.MaterialToolbar
import com.google.android.material.button.MaterialButton
import com.mantraxstudios.srservi.R
import com.mantraxstudios.srservi.SRServiApp
import com.mantraxstudios.srservi.model.Order
import com.mantraxstudios.srservi.network.ApiService
import com.mantraxstudios.srservi.printer.BluetoothPrinterManager
import com.mantraxstudios.srservi.printer.PrinterForegroundService

class PrintQueueActivity : AppCompatActivity() {

    private lateinit var rvOrders: RecyclerView
    private lateinit var swipeRefresh: SwipeRefreshLayout
    private lateinit var printerManager: BluetoothPrinterManager
    private val orders = mutableListOf<Order>()
    private lateinit var adapter: OrderAdapter

    private var initialCheckDone = false

    companion object {
        private const val PREFS_NAME = "srservi_prefs"
        private const val KEY_PRINTED_IDS = "printed_order_ids"
    }

    private val ordersUpdatedReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            fetchOrdersForDisplay()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_print_queue)

        printerManager = (application as SRServiApp).printerManager

        val toolbar = findViewById<MaterialToolbar>(R.id.toolbar)
        toolbar.setNavigationIcon(androidx.appcompat.R.drawable.abc_ic_ab_back_material)
        toolbar.setNavigationOnClickListener { finish() }

        rvOrders = findViewById(R.id.rvOrders)
        swipeRefresh = findViewById(R.id.swipeRefresh)

        adapter = OrderAdapter(orders) { order ->
            printOrder(order)
        }
        rvOrders.layoutManager = LinearLayoutManager(this)
        rvOrders.adapter = adapter

        swipeRefresh.setOnRefreshListener { fetchOrdersForDisplay() }

        findViewById<MaterialButton>(R.id.btnRefresh).setOnClickListener { fetchOrdersForDisplay() }

        findViewById<MaterialButton>(R.id.btnPrintAllPending).setOnClickListener {
            printAllPending()
        }

        printerManager.setListener(object : BluetoothPrinterManager.PrinterListener {
            override fun onConnected(deviceName: String) {}
            override fun onDisconnected() {}
            override fun onPrintSuccess(orderNumber: String) {
                runOnUiThread {
                    Toast.makeText(this@PrintQueueActivity, "Impreso: $orderNumber", Toast.LENGTH_SHORT).show()
                }
            }
            override fun onPrintError(orderNumber: String, error: String) {
                runOnUiThread {
                    Toast.makeText(this@PrintQueueActivity, "Error al imprimir $orderNumber: $error", Toast.LENGTH_SHORT).show()
                }
            }
        })

        fetchInitialAndCheckHistory()
    }

    override fun onResume() {
        super.onResume()
        ContextCompat.registerReceiver(
            this,
            ordersUpdatedReceiver,
            IntentFilter(PrinterForegroundService.ACTION_ORDERS_UPDATED),
            ContextCompat.RECEIVER_NOT_EXPORTED
        )
    }

    override fun onPause() {
        super.onPause()
        unregisterReceiver(ordersUpdatedReceiver)
    }

    private fun getPrintedIds(): MutableSet<Int> {
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val idsString = prefs.getString(KEY_PRINTED_IDS, "") ?: ""
        val set = mutableSetOf<Int>()
        if (idsString.isNotEmpty()) {
            idsString.split(",").forEach { it.trim().toIntOrNull()?.let { id -> set.add(id) } }
        }
        return set
    }

    private fun savePrintedId(id: Int) {
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val ids = getPrintedIds().also { it.add(id) }
        prefs.edit().putString(KEY_PRINTED_IDS, ids.joinToString(",")).apply()
    }

    private fun fetchInitialAndCheckHistory() {
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val storeCode = prefs.getString("store_code", "") ?: ""

        if (storeCode.isEmpty()) {
            initialCheckDone = true
            return
        }

        Thread {
            val response = ApiService.fetchOrders(storeCode)
            runOnUiThread {
                if (response != null) {
                    orders.clear()
                    orders.addAll(response.orders)
                    adapter.notifyDataSetChanged()

                    val printedIds = getPrintedIds()
                    val unprintedPending = orders.filter {
                        it.status == "pending" && it.id !in printedIds
                    }

                    if (unprintedPending.isNotEmpty()) {
                        showHistoryDialog(unprintedPending)
                    } else {
                        initialCheckDone = true
                    }
                } else {
                    initialCheckDone = true
                }
            }
        }.start()
    }

    private fun fetchOrdersForDisplay() {
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val storeCode = prefs.getString("store_code", "") ?: ""
        if (storeCode.isEmpty()) {
            swipeRefresh.isRefreshing = false
            return
        }
        Thread {
            val response = ApiService.fetchOrders(storeCode)
            runOnUiThread {
                swipeRefresh.isRefreshing = false
                if (response != null) {
                    orders.clear()
                    orders.addAll(response.orders)
                    adapter.notifyDataSetChanged()
                }
            }
        }.start()
    }

    private fun showHistoryDialog(unprintedOrders: List<Order>) {
        val count = unprintedOrders.size

        val container = LinearLayout(this)
        container.orientation = LinearLayout.VERTICAL
        container.gravity = Gravity.CENTER
        container.setPadding(48, 48, 48, 48)

        val tvCount = TextView(this)
        tvCount.text = count.toString()
        tvCount.textSize = 72f
        tvCount.setTextColor(getColor(R.color.gold))
        tvCount.gravity = Gravity.CENTER
        tvCount.setTypeface(null, android.graphics.Typeface.BOLD)
        container.addView(tvCount)

        val tvLabel = TextView(this)
        tvLabel.text = if (count == 1) "boleta pendiente" else "boletas pendientes"
        tvLabel.textSize = 18f
        tvLabel.setTextColor(getColor(R.color.text_primary))
        tvLabel.gravity = Gravity.CENTER
        container.addView(tvLabel)

        val tvSubLabel = TextView(this)
        tvSubLabel.text = "sin imprimir del historial anterior"
        tvSubLabel.textSize = 14f
        tvSubLabel.setTextColor(getColor(R.color.text_secondary))
        tvSubLabel.gravity = Gravity.CENTER
        val params = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        )
        params.topMargin = 8
        tvSubLabel.layoutParams = params
        container.addView(tvSubLabel)

        AlertDialog.Builder(this)
            .setTitle("Historial de boletas")
            .setView(container)
            .setCancelable(false)
            .setPositiveButton("Imprimir todas") { _, _ ->
                val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                val ids = getPrintedIds().also { set -> unprintedOrders.forEach { set.add(it.id) } }
                prefs.edit().putString(KEY_PRINTED_IDS, ids.joinToString(",")).apply()
                if (printerManager.isConnected()) {
                    printerManager.addAllToQueue(unprintedOrders)
                    Toast.makeText(this, "$count boletas enviadas a imprimir", Toast.LENGTH_SHORT).show()
                } else {
                    Toast.makeText(this, "Conecta una impresora primero", Toast.LENGTH_SHORT).show()
                }
                initialCheckDone = true
            }
            .setNegativeButton("No imprimir") { _, _ ->
                val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                val ids = getPrintedIds().also { set -> unprintedOrders.forEach { set.add(it.id) } }
                prefs.edit().putString(KEY_PRINTED_IDS, ids.joinToString(",")).apply()
                initialCheckDone = true
            }
            .show()
    }

    private fun printOrder(order: Order) {
        if (!printerManager.isConnected()) {
            Toast.makeText(this, "Conecta una impresora primero", Toast.LENGTH_SHORT).show()
            return
        }
        savePrintedId(order.id)
        printerManager.addToQueue(order)
    }

    private fun printAllPending() {
        if (!printerManager.isConnected()) {
            Toast.makeText(this, "Conecta una impresora primero", Toast.LENGTH_SHORT).show()
            return
        }
        val pendingOrders = orders.filter { it.status == "pending" }
        if (pendingOrders.isEmpty()) {
            Toast.makeText(this, "No hay pedidos pendientes", Toast.LENGTH_SHORT).show()
            return
        }
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val ids = getPrintedIds().also { set -> pendingOrders.forEach { set.add(it.id) } }
        prefs.edit().putString(KEY_PRINTED_IDS, ids.joinToString(",")).apply()
        printerManager.addAllToQueue(pendingOrders)
        Toast.makeText(this, "${pendingOrders.size} pedidos enviados a imprimir", Toast.LENGTH_SHORT).show()
    }

    inner class OrderAdapter(
        private val orders: List<Order>,
        private val onPrint: (Order) -> Unit
    ) : RecyclerView.Adapter<OrderAdapter.ViewHolder>() {

        inner class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
            val tvOrderNumber: TextView = view.findViewById(R.id.tvOrderNumber)
            val tvStatus: TextView = view.findViewById(R.id.tvStatus)
            val tvTotal: TextView = view.findViewById(R.id.tvTotal)
            val tvPaymentMethod: TextView = view.findViewById(R.id.tvPaymentMethod)
            val llItems: LinearLayout = view.findViewById(R.id.llItems)
            val btnPrint: MaterialButton = view.findViewById(R.id.btnPrint)
        }

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
            val view = LayoutInflater.from(parent.context)
                .inflate(R.layout.item_order, parent, false)
            return ViewHolder(view)
        }

        override fun onBindViewHolder(holder: ViewHolder, position: Int) {
            val order = orders[position]

            holder.tvOrderNumber.text = "Pedido #${order.orderNumber}"

            when (order.status) {
                "pending" -> {
                    holder.tvStatus.text = getString(R.string.order_pending)
                    holder.tvStatus.setBackgroundResource(R.drawable.bg_status_pending)
                    holder.tvStatus.setTextColor(getColor(R.color.status_pending_text))
                }
                "paid" -> {
                    holder.tvStatus.text = getString(R.string.order_paid)
                    holder.tvStatus.setBackgroundResource(R.drawable.bg_status_paid)
                    holder.tvStatus.setTextColor(getColor(R.color.status_paid_text))
                }
                else -> {
                    holder.tvStatus.text = order.status
                    holder.tvStatus.setBackgroundResource(R.drawable.bg_status_pending)
                    holder.tvStatus.setTextColor(getColor(R.color.text_secondary))
                }
            }

            holder.tvTotal.text = "Total: $${String.format("%.2f", order.total)}"

            val paymentLabel = when (order.paymentMethod) {
                "card" -> "Tarjeta"
                "cash" -> "Efectivo"
                else -> order.paymentMethod
            }
            holder.tvPaymentMethod.text = paymentLabel

            holder.llItems.removeAllViews()
            for (item in order.items) {
                val itemView = TextView(holder.itemView.context)
                val text = StringBuilder("${item.quantity}x ${item.productName} - $${String.format("%.2f", item.unitPrice)}")

                if (item.selectedIngredients.isNotEmpty()) {
                    text.append("\n  Ingredientes: ${item.selectedIngredients.joinToString(", ")}")
                }
                if (item.selectedExtras.isNotEmpty()) {
                    text.append("\n  Extras: ${item.selectedExtras.joinToString(", ")}")
                }

                itemView.text = text.toString()
                itemView.setTextColor(getColor(R.color.text_primary))
                itemView.textSize = 13f
                itemView.setPadding(0, 4, 0, 4)
                holder.llItems.addView(itemView)
            }

            holder.btnPrint.setOnClickListener { onPrint(order) }
        }

        override fun getItemCount(): Int = orders.size
    }
}
