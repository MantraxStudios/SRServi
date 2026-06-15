package com.mantraxstudios.aforobridge

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Arranca el conteo automáticamente cuando se enciende el teléfono. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        val action = intent?.action ?: return
        if (action == Intent.ACTION_BOOT_COMPLETED || action == "android.intent.action.QUICKBOOT_POWERON") {
            val s = Settings(context)
            if (s.isConfigured && s.autoStart) {
                try {
                    CountingService.start(context)
                } catch (_: Exception) { }
            }
        }
    }
}
