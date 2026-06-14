package com.mantraxstudios.aforobridge

import android.content.Context
import android.net.Uri

/**
 * Configuración persistente de AforoBridge (SharedPreferences).
 * Guarda cuenta, tienda y datos de la cámara para reconectar al arrancar.
 */
class Settings(context: Context) {

    private val prefs = context.getSharedPreferences("aforobridge", Context.MODE_PRIVATE)

    var serverUrl: String
        get() = prefs.getString("serverUrl", DEFAULT_SERVER) ?: DEFAULT_SERVER
        set(v) = prefs.edit().putString("serverUrl", v).apply()

    var email: String
        get() = prefs.getString("email", "") ?: ""
        set(v) = prefs.edit().putString("email", v).apply()

    var password: String
        get() = prefs.getString("password", "") ?: ""
        set(v) = prefs.edit().putString("password", v).apply()

    var storeId: Int
        get() = prefs.getInt("storeId", 0)
        set(v) = prefs.edit().putInt("storeId", v).apply()

    var storeName: String
        get() = prefs.getString("storeName", "") ?: ""
        set(v) = prefs.edit().putString("storeName", v).apply()

    var camIp: String
        get() = prefs.getString("camIp", "") ?: ""
        set(v) = prefs.edit().putString("camIp", v).apply()

    var camPort: String
        get() = prefs.getString("camPort", "554") ?: "554"
        set(v) = prefs.edit().putString("camPort", v).apply()

    var camUser: String
        get() = prefs.getString("camUser", "") ?: ""
        set(v) = prefs.edit().putString("camUser", v).apply()

    var camPass: String
        get() = prefs.getString("camPass", "") ?: ""
        set(v) = prefs.edit().putString("camPass", v).apply()

    var camChannel: String
        get() = prefs.getString("camChannel", "stream1") ?: "stream1"
        set(v) = prefs.edit().putString("camChannel", v).apply()

    var sensitivity: Int
        get() = prefs.getInt("sensitivity", 30)
        set(v) = prefs.edit().putInt("sensitivity", v).apply()

    var autoStart: Boolean
        get() = prefs.getBoolean("autoStart", true)
        set(v) = prefs.edit().putBoolean("autoStart", v).apply()

    var countIn: Int
        get() = prefs.getInt("countIn", 0)
        set(v) = prefs.edit().putInt("countIn", v).apply()

    var countOut: Int
        get() = prefs.getInt("countOut", 0)
        set(v) = prefs.edit().putInt("countOut", v).apply()

    var countDate: String
        get() = prefs.getString("countDate", "") ?: ""
        set(v) = prefs.edit().putString("countDate", v).apply()

    val isConfigured: Boolean
        get() = email.isNotBlank() && password.isNotBlank() && storeId > 0 && camIp.isNotBlank()

    /** Construye la URL RTSP a partir de los campos individuales. */
    fun rtspUrl(channel: String = camChannel): String {
        if (camIp.isBlank()) return ""
        val auth = if (camUser.isNotBlank()) {
            val u = Uri.encode(camUser)
            val p = if (camPass.isNotBlank()) ":" + Uri.encode(camPass) else ""
            "$u$p@"
        } else ""
        val portPart = if (camPort.isNotBlank() && camPort != "554") ":$camPort" else ""
        val ch = channel.trimStart('/')
        return "rtsp://$auth$camIp$portPart/$ch"
    }

    companion object {
        const val DEFAULT_SERVER = "https://srservi2.srautomatic.com"
    }
}
