package com.mantraxstudios.srservi.offline

import android.content.Context
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/**
 * Descarga y cachea en disco los datos de la tienda para el Modo Offline.
 *
 * Al abrir el modo offline se descargan:
 *   - `/api/public/<code>`               → tienda + productos + categorías + extras
 *   - `/api/public/<code>/pos-terminals` → terminales/métodos de pago con credenciales
 *
 * Todo se guarda en `filesDir/offline/`. Si no hay conexión, se cargan los datos
 * cacheados de la última sincronización, de modo que la venta sigue funcionando.
 */
object OfflineRepository {

    const val BASE_URL = "https://srservi2.srautomatic.com"
    const val HOST = BASE_URL // para imágenes /uploads/*

    private val gson = Gson()

    private fun dir(context: Context): File =
        File(context.filesDir, "offline").apply { if (!exists()) mkdirs() }

    private fun storeFile(context: Context) = File(dir(context), "store.json")
    private fun terminalsFile(context: Context) = File(dir(context), "terminals.json")
    private fun metaFile(context: Context) = File(dir(context), "meta.json")

    data class SyncResult(
        val success: Boolean,
        val fromCache: Boolean,
        val productCount: Int,
        val terminalCount: Int,
        val error: String? = null
    )

    /**
     * Descarga los datos de la tienda y los guarda. Debe llamarse en un hilo de fondo.
     * Si falla la red pero hay caché, devuelve `fromCache = true`.
     */
    fun sync(context: Context, storeCode: String): SyncResult {
        val code = storeCode.trim().uppercase()
        return try {
            val storeJson = httpGet("$BASE_URL/api/public/$code")
                ?: throw Exception("No se pudo obtener la tienda")
            // Validar que parsee antes de guardar
            val store = gson.fromJson(storeJson, PublicStoreResponse::class.java)
            if (store?.store == null) throw Exception("Respuesta de tienda inválida")

            storeFile(context).writeText(storeJson)

            // Terminales (best-effort: si falla, seguimos con caché o solo efectivo)
            val terminalsJson = httpGet("$BASE_URL/api/public/$code/pos-terminals")
            if (terminalsJson != null) terminalsFile(context).writeText(terminalsJson)

            metaFile(context).writeText(
                gson.toJson(mapOf("code" to code, "syncedAt" to System.currentTimeMillis()))
            )

            SyncResult(
                success = true,
                fromCache = false,
                productCount = store.products.size,
                terminalCount = loadTerminals(context).size
            )
        } catch (e: Exception) {
            val cached = loadStore(context)
            if (cached != null) {
                SyncResult(
                    success = true,
                    fromCache = true,
                    productCount = cached.products.size,
                    terminalCount = loadTerminals(context).size,
                    error = e.message
                )
            } else {
                SyncResult(false, false, 0, 0, e.message ?: "Error de descarga")
            }
        }
    }

    fun loadStore(context: Context): PublicStoreResponse? {
        val f = storeFile(context)
        if (!f.exists()) return null
        return try { gson.fromJson(f.readText(), PublicStoreResponse::class.java) } catch (_: Exception) { null }
    }

    fun loadTerminals(context: Context): List<PosTerminal> {
        val f = terminalsFile(context)
        if (!f.exists()) return emptyList()
        return try {
            val type = object : TypeToken<List<PosTerminal>>() {}.type
            gson.fromJson<List<PosTerminal>>(f.readText(), type) ?: emptyList()
        } catch (_: Exception) { emptyList() }
    }

    fun lastSyncTime(context: Context): Long {
        val f = metaFile(context)
        if (!f.exists()) return 0L
        return try {
            val map = gson.fromJson(f.readText(), Map::class.java)
            (map["syncedAt"] as? Double)?.toLong() ?: 0L
        } catch (_: Exception) { 0L }
    }

    fun hasCache(context: Context): Boolean = storeFile(context).exists()

    /** Construye la URL absoluta de la imagen de un producto/extra. */
    fun imageUrl(path: String?): String? {
        if (path.isNullOrBlank()) return null
        return if (path.startsWith("http")) path else HOST + path
    }

    private fun httpGet(urlString: String): String? {
        var conn: HttpURLConnection? = null
        return try {
            val url = URL(urlString)
            conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = "GET"
            conn.connectTimeout = 12000
            conn.readTimeout = 15000
            conn.setRequestProperty("Accept", "application/json")
            if (conn.responseCode == HttpURLConnection.HTTP_OK) {
                conn.inputStream.bufferedReader().use { it.readText() }
            } else null
        } catch (_: Exception) {
            null
        } finally {
            conn?.disconnect()
        }
    }
}
