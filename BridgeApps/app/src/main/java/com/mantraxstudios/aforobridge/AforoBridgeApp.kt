package com.mantraxstudios.aforobridge

import android.app.Application
import java.io.PrintWriter
import java.io.StringWriter

class AforoBridgeApp : Application() {

    override fun onCreate() {
        super.onCreate()
        val default = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            try {
                val sw = StringWriter()
                throwable.printStackTrace(PrintWriter(sw))
                val log = sw.toString()
                getSharedPreferences("crash", MODE_PRIVATE).edit()
                    .putString("last_crash", log)
                    .putLong("crash_time", System.currentTimeMillis())
                    .commit()
            } catch (_: Throwable) { }
            default?.uncaughtException(thread, throwable)
        }
    }

    companion object {
        fun getLastCrash(ctx: android.content.Context): String? {
            val prefs = ctx.getSharedPreferences("crash", MODE_PRIVATE)
            return prefs.getString("last_crash", null)
        }

        fun clearCrash(ctx: android.content.Context) {
            ctx.getSharedPreferences("crash", MODE_PRIVATE).edit().clear().apply()
        }
    }
}
