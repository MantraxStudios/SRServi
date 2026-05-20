package com.mantraxstudios.cctv.admin

import android.app.admin.DeviceAdminReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent

class CCTVDeviceAdminReceiver : DeviceAdminReceiver() {
    companion object {
        fun getComponentName(context: Context) =
            ComponentName(context, CCTVDeviceAdminReceiver::class.java)
    }

    override fun onEnabled(context: Context, intent: Intent) = super.onEnabled(context, intent)
    override fun onDisabled(context: Context, intent: Intent) = super.onDisabled(context, intent)
}
