package com.mantraxstudios.srservi.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.mantraxstudios.srservi.printer.PrinterForegroundService

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED ||
            intent.action == "android.intent.action.QUICKBOOT_POWERON"
        ) {
            PrinterForegroundService.start(context)
        }
    }
}
