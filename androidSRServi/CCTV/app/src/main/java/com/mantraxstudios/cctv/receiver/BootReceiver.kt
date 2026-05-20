package com.mantraxstudios.cctv.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.mantraxstudios.cctv.KioskService
import com.mantraxstudios.cctv.MainActivity

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED ||
            intent.action == "android.intent.action.QUICKBOOT_POWERON"
        ) {
            KioskService.start(context)
            context.startActivity(
                Intent(context, MainActivity::class.java).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
                }
            )
        }
    }
}
