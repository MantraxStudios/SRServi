package com.mantraxstudios.srservi.offline

import android.content.Context
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID

/**
 * Almacén local de ventas del Modo Offline.
 *
 * Cada venta completada se guarda en `filesDir/offline/sales.json`. Además se
 * intenta sincronizar con el servidor (`POST /api/orders`) de forma idempotente
 * usando `client_uid` — si no hay red, la venta queda marcada `synced = false`
 * y se reintenta más tarde. La venta NUNCA se pierde: primero se guarda local.
 */
object SalesLog {

    private val gson = Gson()

    private fun file(context: Context): File {
        val dir = File(context.filesDir, "offline").apply { if (!exists()) mkdirs() }
        return File(dir, "sales.json")
    }

    @Synchronized
    fun all(context: Context): MutableList<OfflineSale> {
        val f = file(context)
        if (!f.exists()) return mutableListOf()
        return try {
            val type = object : TypeToken<MutableList<OfflineSale>>() {}.type
            gson.fromJson<MutableList<OfflineSale>>(f.readText(), type) ?: mutableListOf()
        } catch (_: Exception) { mutableListOf() }
    }

    @Synchronized
    private fun saveAll(context: Context, sales: List<OfflineSale>) {
        file(context).writeText(gson.toJson(sales))
    }

    @Synchronized
    fun add(context: Context, sale: OfflineSale) {
        val sales = all(context)
        sales.add(0, sale)
        saveAll(context, sales)
    }

    @Synchronized
    fun markSynced(context: Context, clientUid: String) {
        val sales = all(context)
        var changed = false
        for (s in sales) if (s.clientUid == clientUid && !s.synced) { s.synced = true; changed = true }
        if (changed) saveAll(context, sales)
    }

    fun pendingCount(context: Context): Int = all(context).count { !it.synced }

    fun todayTotal(context: Context): Double {
        val startOfDay = java.util.Calendar.getInstance().apply {
            set(java.util.Calendar.HOUR_OF_DAY, 0); set(java.util.Calendar.MINUTE, 0)
            set(java.util.Calendar.SECOND, 0); set(java.util.Calendar.MILLISECOND, 0)
        }.timeInMillis
        return all(context).filter { it.createdAt >= startOfDay }.sumOf { it.total }
    }

    fun newClientUid(): String = "off-" + UUID.randomUUID().toString()

    /**
     * Reintenta subir al servidor todas las ventas pendientes. Best-effort,
     * corre en background. Idempotente por `client_uid`.
     */
    fun syncPending(context: Context) {
        Thread {
            val pending = all(context).filter { !it.synced }
            for (sale in pending) {
                if (postSale(sale)) markSynced(context, sale.clientUid)
            }
        }.start()
    }

    private fun postSale(sale: OfflineSale): Boolean {
        var conn: HttpURLConnection? = null
        return try {
            val itemsArr = JSONArray()
            for (it in sale.items) {
                itemsArr.put(JSONObject().apply {
                    put("product_id", it.productId)
                    put("product_name", it.productName)
                    put("quantity", it.quantity)
                    put("unit_price", it.unitPrice)
                    put("selected_extras", JSONArray(it.extras))
                })
            }
            val body = JSONObject().apply {
                put("store_id", sale.storeId)
                put("items", itemsArr)
                put("order_type", "pos")
                put("payment_method", sale.paymentMethod)
                put("total", sale.total)
                sale.terminalId?.let { put("terminal_id", it) }
                put("client_uid", sale.clientUid)
                put("source", "offline_pos")
            }

            conn = URL("${OfflineRepository.BASE_URL}/api/orders").openConnection() as HttpURLConnection
            conn.requestMethod = "POST"
            conn.setRequestProperty("Content-Type", "application/json")
            conn.doOutput = true
            conn.connectTimeout = 10000
            conn.readTimeout = 15000
            conn.outputStream.use { it.write(body.toString().toByteArray()) }
            conn.responseCode in 200..299
        } catch (_: Exception) {
            false
        } finally {
            conn?.disconnect()
        }
    }
}
