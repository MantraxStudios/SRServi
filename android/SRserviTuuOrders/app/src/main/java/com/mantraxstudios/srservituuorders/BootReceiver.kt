package com.mantraxstudios.srservituuorders

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        val pin = context.getSharedPreferences("srservi_prefs", Context.MODE_PRIVATE)
            .getString("pos_pin", "")
        if (pin.isNullOrEmpty()) return
        val svc = Intent(context, OrderPollingService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
            context.startForegroundService(svc)
        else
            context.startService(svc)
    }
}
