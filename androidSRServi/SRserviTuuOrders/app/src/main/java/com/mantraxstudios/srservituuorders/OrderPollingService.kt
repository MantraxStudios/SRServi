package com.mantraxstudios.srservituuorders

import android.app.*
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.util.Log
import kotlinx.coroutines.*
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.*

class OrderPollingService : Service() {

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private lateinit var prefs: android.content.SharedPreferences

    companion object {
        @Volatile var isRunning = false
        private const val CHANNEL_ID = "srservi_channel"
        private const val NOTIF_ID = 1001
        private const val POLL_INTERVAL_MS = 3_000L
        private const val TAG = "OrderPollingService"
    }

    override fun onCreate() {
        super.onCreate()
        prefs = getSharedPreferences("srservi_prefs", Context.MODE_PRIVATE)
        createNotifChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(NOTIF_ID, buildNotif())
        isRunning = true
        scope.launch { pollLoop() }
        return START_STICKY
    }

    override fun onDestroy() {
        isRunning = false
        scope.cancel()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private suspend fun pollLoop() {
        while (scope.isActive) {
            try {
                poll()
            } catch (e: Exception) {
                Log.e(TAG, "Poll failed", e)
            }
            delay(POLL_INTERVAL_MS)
        }
    }

    private fun poll() {
        val pin = prefs.getString("pos_pin", "").orEmpty()
        if (pin.isEmpty()) return

        clearDailyIfNeeded()

        val conn = URL("https://srservi2.srautomatic.com/api/getCashOrders?pin=$pin")
            .openConnection() as HttpURLConnection
        conn.connectTimeout = 10_000
        conn.readTimeout = 10_000

        try {
            val body = conn.inputStream.bufferedReader().readText()
            processOrders(JSONObject(body))
        } finally {
            conn.disconnect()
        }
    }

    private fun processOrders(json: JSONObject) {
        val orders = json.getJSONArray("orders")
        val printed = prefs.getStringSet("printed_orders", emptySet())!!.toMutableSet()
        var changed = false

        for (i in 0 until orders.length()) {
            val order = orders.getJSONObject(i)
            val id = order.getInt("id").toString()
            val status = order.getString("status")

            if (status == "pending" && !printed.contains(id)) {
                val orderNumber = order.getString("order_number")
                val createdAt = order.getString("created_at")
                PrintHelper.print(
                    context = applicationContext,
                    orderNumber = orderNumber,
                    date = formatDate(createdAt)
                )
                printed.add(id)
                changed = true
                Log.d(TAG, "Queued print for order $orderNumber (id=$id)")
            }
        }

        if (changed) {
            prefs.edit().putStringSet("printed_orders", printed).apply()
        }
    }

    private fun clearDailyIfNeeded() {
        val today = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
        if (prefs.getString("last_clear_date", "") != today) {
            prefs.edit()
                .remove("printed_orders")
                .putString("last_clear_date", today)
                .apply()
        }
    }

    private fun formatDate(iso: String): String = try {
        val inFmt = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault())
        inFmt.timeZone = TimeZone.getTimeZone("UTC")
        val outFmt = SimpleDateFormat("dd/MM/yyyy HH:mm", Locale.getDefault())
        outFmt.format(inFmt.parse(iso)!!)
    } catch (e: Exception) {
        iso.take(16).replace("T", " ")
    }

    private fun createNotifChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val chan = NotificationChannel(
                CHANNEL_ID,
                "SRServi Pedidos",
                NotificationManager.IMPORTANCE_LOW
            ).apply { description = "Monitoreo de pedidos en segundo plano" }
            (getSystemService(NOTIFICATION_SERVICE) as NotificationManager)
                .createNotificationChannel(chan)
        }
    }

    @Suppress("DEPRECATION")
    private fun buildNotif(): Notification {
        val pi = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE
        )
        val icon = android.R.drawable.ic_dialog_info
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL_ID)
                .setContentTitle("SRServi Auto Print")
                .setContentText("Monitoreando pedidos...")
                .setSmallIcon(icon)
                .setContentIntent(pi)
                .setOngoing(true)
                .build()
        } else {
            Notification.Builder(this)
                .setContentTitle("SRServi Auto Print")
                .setContentText("Monitoreando pedidos...")
                .setSmallIcon(icon)
                .setContentIntent(pi)
                .setOngoing(true)
                .build()
        }
    }
}
