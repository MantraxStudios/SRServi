package com.mantraxstudios.cctv

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat

class KioskService : Service() {

    private val handler = Handler(Looper.getMainLooper())
    private var relaunchRunnable: Runnable? = null

    companion object {
        var instance: KioskService? = null
        private const val CHANNEL_ID = "cctv_kiosk_channel"
        private const val NOTIFICATION_ID = 1

        fun start(context: Context) {
            val intent = Intent(context, KioskService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        instance = this
        createNotificationChannel()
        startForegroundSafe()
    }

    override fun onDestroy() {
        instance = null
        cancelRelaunch()
        super.onDestroy()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int) = START_STICKY

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onTaskRemoved(rootIntent: Intent?) {
        super.onTaskRemoved(rootIntent)
        // Relanzar siempre cuando la tarea es eliminada (swipe en recientes o killed)
        scheduleRelaunch(3_000)
    }

    fun scheduleRelaunch(delayMs: Long = 15_000L) {
        relaunchRunnable?.let { handler.removeCallbacks(it) }
        relaunchRunnable = Runnable {
            try {
                startActivity(
                    Intent(this@KioskService, RestartBridgeActivity::class.java).apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                )
            } catch (_: Exception) {}
        }
        handler.postDelayed(relaunchRunnable!!, delayMs)
    }

    fun cancelRelaunch() {
        relaunchRunnable?.let { handler.removeCallbacks(it) }
        relaunchRunnable = null
    }

    private fun startForegroundSafe() {
        val notification = buildNotification()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
        } else {
            @Suppress("DEPRECATION")
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    private fun buildNotification(): Notification {
        val pi = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Cartelería Digital")
            .setContentText("Pantalla activa · SRAutomatic.cl")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentIntent(pi)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getSystemService(NotificationManager::class.java).createNotificationChannel(
                NotificationChannel(CHANNEL_ID, "Cartelería Digital", NotificationManager.IMPORTANCE_LOW).apply {
                    description = "Mantiene la pantalla activa"
                    setShowBadge(false)
                }
            )
        }
    }
}
