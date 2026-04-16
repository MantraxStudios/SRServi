package com.mantraxstudios.srservi.printer

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.app.admin.DevicePolicyManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import com.mantraxstudios.srservi.MainActivity
import com.mantraxstudios.srservi.R
import com.mantraxstudios.srservi.RestartBridgeActivity
import com.mantraxstudios.srservi.SRServiApp
import com.mantraxstudios.srservi.network.ApiService

class PrinterForegroundService : Service() {

    companion object {
        const val CHANNEL_ID = "printer_service_channel"
        private const val CHANNEL_RELAUNCH_ID = "relaunch_channel"
        const val NOTIFICATION_ID = 1
        private const val NOTIFICATION_RELAUNCH_ID = 2
        const val ACTION_ORDERS_UPDATED = "com.mantraxstudios.srservi.ORDERS_UPDATED"
        const val PREFS_NAME = "srservi_prefs"
        const val KEY_PRINTED_IDS = "printed_order_ids"
        const val KEY_PRINTER_ADDRESS = "printer_mac_address"
        private const val POLL_INTERVAL = 3000L

        fun start(context: Context) {
            val intent = Intent(context, PrinterForegroundService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, PrinterForegroundService::class.java))
        }
    }

    private lateinit var printerManager: BluetoothPrinterManager
    private val handler = Handler(Looper.getMainLooper())

    // Flags para evitar threads paralelos que causan bugs de impresion
    @Volatile private var isFetching = false
    @Volatile private var isConnecting = false

    private val pollingRunnable = object : Runnable {
        override fun run() {
            fetchAndAutoPrint()
            handler.postDelayed(this, POLL_INTERVAL)
        }
    }

    override fun onCreate() {
        super.onCreate()
        printerManager = (application as SRServiApp).printerManager
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, buildNotification("Monitoreando pedidos..."))
        autoConnect()
        handler.post(pollingRunnable)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        return START_STICKY
    }

    override fun onDestroy() {
        handler.removeCallbacks(pollingRunnable)
        super.onDestroy()
    }

    // Si la tarea es eliminada (swipe en recientes o cierre forzado),
    // relanzar la app para mantener el modo kiosk.
    //
    // Android 14/15 bloquea dos cosas por separado:
    //   1. BAL desde ForegroundService → se permite si la app es launcher/Device Owner.
    //   2. "balDontBringExistingBackgroundTaskStackToFg" → bloquea traer tareas
    //      existentes al frente incluso con BAL permitido.
    //
    // Solución: RestartBridgeActivity (taskAffinity="", standard) crea una tarea
    // NUEVA sin historial, evitando la segunda restricción.
    // Si no somos el launcher, mostramos una notificación heads-up.
    override fun onTaskRemoved(rootIntent: Intent?) {
        super.onTaskRemoved(rootIntent)

        val dpm = getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager

        if (dpm.isDeviceOwnerApp(packageName) || isDefaultLauncher()) {
            // Tenemos exención BAL. Usamos RestartBridgeActivity para evitar
            // "balDontBringExistingBackgroundTaskStackToFg" que bloquea incluso
            // al launcher si intenta traer una tarea existente al frente.
            try {
                startActivity(
                    Intent(this, RestartBridgeActivity::class.java).apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                )
                return
            } catch (_: Exception) { /* fallthrough to notification */ }
        }

        // Sin exención BAL o si el lanzamiento falló: notificación heads-up.
        val mainIntent = Intent(this, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
        }
        showRelaunchNotification(mainIntent)
    }

    private fun isDefaultLauncher(): Boolean {
        val homeIntent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
        val info = packageManager.resolveActivity(homeIntent, PackageManager.MATCH_DEFAULT_ONLY)
        return info?.activityInfo?.packageName == packageName
    }

    private fun showRelaunchNotification(relaunchIntent: Intent) {
        val pi = PendingIntent.getActivity(
            this, 0, relaunchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val notification = NotificationCompat.Builder(this, CHANNEL_RELAUNCH_ID)
            .setContentTitle("SRServi")
            .setContentText("Toca para reactivar la aplicación")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentIntent(pi)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setAutoCancel(true)
            .build()

        getSystemService(NotificationManager::class.java)
            .notify(NOTIFICATION_RELAUNCH_ID, notification)
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun autoConnect() {
        // Evitar multiples intentos de conexion al mismo tiempo
        if (isConnecting || printerManager.isConnected()) return
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val address = prefs.getString(KEY_PRINTER_ADDRESS, null) ?: return

        isConnecting = true
        Thread {
            try {
                val device = printerManager.getPairedDevices().find { it.address == address }
                if (device != null) {
                    printerManager.connect(device)
                }
            } finally {
                isConnecting = false
            }
        }.start()
    }

    private fun fetchAndAutoPrint() {
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val storeCode = prefs.getString("store_code", "") ?: ""
        if (storeCode.isEmpty()) return

        // Si el ciclo anterior todavia no termino, no lanzar otro
        if (isFetching) return

        // Reconectar si se desconecto, pero sin bloquear el ciclo
        if (!printerManager.isConnected()) {
            autoConnect()
        }

        isFetching = true
        Thread {
            try {
                val response = ApiService.fetchOrders(storeCode) ?: return@Thread

                handler.post { sendBroadcast(Intent(ACTION_ORDERS_UPDATED)) }

                if (!printerManager.isConnected()) return@Thread

                // Leer IDs impresos frescos en cada ciclo para evitar duplicados
                val idsString = prefs.getString(KEY_PRINTED_IDS, "") ?: ""
                val printedIds = mutableSetOf<Int>()
                if (idsString.isNotEmpty()) {
                    idsString.split(",").forEach { s ->
                        s.trim().toIntOrNull()?.let { printedIds.add(it) }
                    }
                }

                // Imprimir cuando cash_approved == 1 (la orden fue aprobada para impresion).
                // No usar "status" porque varia segun el flujo de pago.
                val toPrint = response.orders.filter {
                    it.cashApproved == 1 && it.id !in printedIds
                }
                if (toPrint.isEmpty()) return@Thread

                // Marcar como impresos ANTES de encolar para evitar doble impresion
                for (order in toPrint) printedIds.add(order.id)
                prefs.edit().putString(KEY_PRINTED_IDS, printedIds.joinToString(",")).apply()
                printerManager.addAllToQueue(toPrint)
            } finally {
                isFetching = false
            }
        }.start()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val nm = getSystemService(NotificationManager::class.java)

            // Canal persistente del servicio (baja prioridad, sin sonido)
            nm.createNotificationChannel(
                NotificationChannel(
                    CHANNEL_ID,
                    "Servicio de Impresión",
                    NotificationManager.IMPORTANCE_LOW
                ).apply {
                    description = "Monitoreo de pedidos e impresión automática"
                    setShowBadge(false)
                }
            )

            // Canal de relanzamiento (alta prioridad, aparece como heads-up)
            nm.createNotificationChannel(
                NotificationChannel(
                    CHANNEL_RELAUNCH_ID,
                    "Reactivar SRServi",
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "Avisa cuando la app se cierra para poder reabrirla"
                    setShowBadge(false)
                }
            )
        }
    }

    private fun buildNotification(status: String): Notification {
        val pendingIntent = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("SRServi")
            .setContentText(status)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }
}
