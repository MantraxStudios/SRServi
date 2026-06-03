package com.mantraxstudios.aforobridge

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

data class StoreInfo(val id: Int, val name: String)
data class LoginResult(val token: String, val userJson: String, val userName: String)
data class LineConfig(val x1: Double, val y1: Double, val x2: Double, val y2: Double, val flip: Boolean)

/** Cliente HTTP contra la API de SRServi (mismos endpoints que el panel web y AforoBridge Windows). */
class Api(private var baseUrl: String) {

    private val http = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .build()

    var token: String? = null

    fun setBaseUrl(url: String) { baseUrl = url.trimEnd('/') }

    private val jsonType = "application/json; charset=utf-8".toMediaType()
    private val jpegType = "image/jpeg".toMediaType()

    /** Inicia sesión. Devuelve token + JSON de usuario (para inyectar en la web si hiciera falta). */
    suspend fun login(email: String, password: String): LoginResult = withContext(Dispatchers.IO) {
        val body = JSONObject().put("email", email).put("password", password).toString()
        val req = Request.Builder()
            .url("$baseUrl/api/auth/login")
            .post(body.toRequestBody(jsonType))
            .build()
        http.newCall(req).execute().use { res ->
            val text = res.body?.string() ?: ""
            if (!res.isSuccessful) {
                val msg = runCatching { JSONObject(text).getString("error") }.getOrDefault(text)
                throw RuntimeException(msg)
            }
            val root = JSONObject(text)
            val tk = root.getString("token")
            val user = root.getJSONObject("user")
            token = tk
            LoginResult(tk, user.toString(), user.optString("name", email))
        }
    }

    /** Lista las tiendas del usuario autenticado. */
    suspend fun getStores(): List<StoreInfo> = withContext(Dispatchers.IO) {
        val req = authReq("$baseUrl/api/stores").build()
        http.newCall(req).execute().use { res ->
            val text = res.body?.string() ?: "[]"
            if (!res.isSuccessful) throw RuntimeException("Error ${res.code}")
            val arr = JSONArray(text)
            (0 until arr.length()).mapNotNull { i ->
                val o = arr.getJSONObject(i)
                val id = o.optInt("id", 0)
                if (id > 0) StoreInfo(id, o.optString("name", "Tienda $id")) else null
            }
        }
    }

    /** Línea de conteo configurada en el panel (o null). */
    suspend fun getLineConfig(storeId: Int): LineConfig? = withContext(Dispatchers.IO) {
        runCatching {
            val req = authReq("$baseUrl/api/stores/$storeId/people-counter/config").build()
            http.newCall(req).execute().use { res ->
                if (!res.isSuccessful) return@withContext null
                val root = JSONObject(res.body?.string() ?: "{}")
                val line = root.optJSONObject("line") ?: return@withContext null
                val flip = root.optBoolean("flip", false)
                LineConfig(
                    line.optDouble("x1", 0.15), line.optDouble("y1", 0.5),
                    line.optDouble("x2", 0.85), line.optDouble("y2", 0.5), flip
                )
            }
        }.getOrNull()
    }

    /** Reporta un cruce (entrada/salida). */
    suspend fun postEvent(storeId: Int, direction: String) = withContext(Dispatchers.IO) {
        runCatching {
            val body = JSONObject()
                .put("direction", direction)
                .put("crossed_at", isoNow())
                .toString()
            val req = authReq("$baseUrl/api/stores/$storeId/people-counter/event")
                .post(body.toRequestBody(jsonType)).build()
            http.newCall(req).execute().close()
        }
        Unit
    }

    /** Sube un snapshot JPEG → activa "agente activo" y la vista previa en la web. */
    suspend fun uploadSnapshot(storeId: Int, jpeg: ByteArray) = withContext(Dispatchers.IO) {
        runCatching {
            val req = authReq("$baseUrl/api/stores/$storeId/people-counter/snapshot-upload")
                .post(jpeg.toRequestBody(jpegType)).build()
            http.newCall(req).execute().close()
        }
        Unit
    }

    /** Guarda los datos de la cámara en el panel (enabled=false: el conteo lo hace este teléfono). */
    suspend fun saveRtspInfo(storeId: Int, rtspUrl: String, sensitivity: Int) = withContext(Dispatchers.IO) {
        runCatching {
            val body = JSONObject()
                .put("rtsp_url", rtspUrl)
                .put("rtsp_enabled", false)
                .put("rtsp_sensitivity", sensitivity)
                .toString()
            val req = authReq("$baseUrl/api/stores/$storeId/people-counter/rtsp")
                .post(body.toRequestBody(jsonType)).build()
            http.newCall(req).execute().close()
        }
        Unit
    }

    private fun authReq(url: String): Request.Builder {
        val b = Request.Builder().url(url)
        token?.let { b.header("Authorization", "Bearer $it") }
        return b
    }

    private fun isoNow(): String {
        val sdf = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US)
        sdf.timeZone = java.util.TimeZone.getTimeZone("UTC")
        return sdf.format(java.util.Date())
    }
}
