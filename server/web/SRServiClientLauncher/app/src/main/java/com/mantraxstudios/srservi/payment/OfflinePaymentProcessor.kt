package com.mantraxstudios.srservi.payment

import android.os.Handler
import android.os.Looper
import com.mantraxstudios.srservi.offline.PosTerminal
import com.mantraxstudios.srservi.offline.StoreInfo
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import kotlin.math.roundToLong

/**
 * Procesa el cobro enviando la venta directamente a la API del proveedor,
 * usando las MISMAS llamadas que hace el servidor SRServi:
 *
 *   - Mercado Pago Point → POST https://api.mercadopago.com/v1/orders  + polling /v1/orders/{id}
 *   - SumUp              → POST https://api.sumup.com/v0.1/checkouts   + polling /v0.1/checkouts/{id}
 *   - Square             → POST https://connect.squareup.com/v2/terminals/checkouts + polling
 *   - Efectivo (cash)    → aprobado al instante
 *   - Otros (tuu/custom) → confirmación manual (isAutoCharge = false)
 *
 * Las credenciales (api_key / device_id) vienen en el [PosTerminal] descargado.
 * Al aprobarse, quien llama dispara la impresión Bluetooth y guarda la venta local.
 */
object OfflinePaymentProcessor {

    // Monedas sin decimales (Square/MP esperan el monto en la unidad entera)
    private val ZERO_DECIMAL = setOf(
        "JPY", "KRW", "CLP", "GNF", "ISK", "KMF", "MGA", "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "BIF"
    )

    private const val POLL_INTERVAL_MS = 3000L
    private const val MAX_POLLS = 60 // ~3 minutos

    sealed class PaymentResult {
        object Approved : PaymentResult()
        object Canceled : PaymentResult()
        data class Failed(val reason: String) : PaymentResult()
    }

    interface Callback {
        fun onProgress(message: String)
        fun onResult(result: PaymentResult)
    }

    /** ¿El proveedor cobra automáticamente vía API, o requiere confirmación manual del cajero? */
    fun isAutoCharge(provider: String): Boolean = when (provider.lowercase()) {
        "mercadopago", "sumup", "square" -> true
        else -> false // cash, tuu y otros → confirmación manual
    }

    private val mainHandler = Handler(Looper.getMainLooper())

    /**
     * Ejecuta el cobro en un hilo de fondo. Los callbacks se entregan en el hilo principal.
     */
    fun process(store: StoreInfo, terminal: PosTerminal, amount: Double, orderType: String, cb: Callback) {
        Thread {
            try {
                val result = when (terminal.provider.lowercase()) {
                    "mercadopago" -> chargeMercadoPago(store, terminal, amount, orderType, cb)
                    "sumup" -> chargeSumUp(store, terminal, amount, orderType, cb)
                    "square" -> chargeSquare(store, terminal, amount, cb)
                    else -> PaymentResult.Approved // cash / manual
                }
                post(cb) { cb.onResult(result) }
            } catch (e: Exception) {
                post(cb) { cb.onResult(PaymentResult.Failed(e.message ?: "Error de cobro")) }
            }
        }.start()
    }

    // ── Mercado Pago Point (nueva Orders API) ─────────────────────────────────
    private fun chargeMercadoPago(
        store: StoreInfo, terminal: PosTerminal, amount: Double, orderType: String, cb: Callback
    ): PaymentResult {
        val token = terminal.apiKey ?: return PaymentResult.Failed("Falta API Key de Mercado Pago")
        val deviceId = terminal.deviceId ?: return PaymentResult.Failed("Falta terminal de Mercado Pago")
        post(cb) { cb.onProgress("Enviando cobro al terminal Mercado Pago…") }

        val idem = "ORDER-${System.currentTimeMillis()}-${(0..999999).random()}"
        val payload = JSONObject().apply {
            put("type", "point")
            put("external_reference", idem)
            put("description", "Pedido POS")
            put("expiration_time", "PT10M")
            put("transactions", JSONObject().apply {
                put("payments", org.json.JSONArray().apply {
                    put(JSONObject().put("amount", amount.roundToLong().toString()))
                })
            })
            put("config", JSONObject().apply {
                put("point", JSONObject().apply {
                    put("terminal_id", deviceId)
                    put("print_on_terminal", "no_ticket")
                })
            })
        }

        val (code, body) = httpJson(
            "POST", "https://api.mercadopago.com/v1/orders", token, payload.toString(),
            mapOf("X-Idempotency-Key" to idem)
        )
        if (code !in 200..299) return PaymentResult.Failed("Mercado Pago: $body")
        val orderId = JSONObject(body).optString("id", "")
        if (orderId.isBlank()) return PaymentResult.Failed("Mercado Pago no devolvió id de orden")

        post(cb) { cb.onProgress("Esperando pago en el terminal…") }
        var polls = 0
        while (polls < MAX_POLLS) {
            Thread.sleep(POLL_INTERVAL_MS)
            polls++
            val (sc, sb) = httpJson("GET", "https://api.mercadopago.com/v1/orders/$orderId", token, null)
            if (sc !in 200..299) continue
            val json = JSONObject(sb)
            val orderStatus = json.optString("status", "")
            val payStatus = json.optJSONObject("transactions")
                ?.optJSONArray("payments")?.optJSONObject(0)?.optString("status", "") ?: ""
            val approved = orderStatus == "processed" || orderStatus == "action_required" ||
                payStatus == "processed" || payStatus == "action_required"
            if (approved) return PaymentResult.Approved
            if (orderStatus == "canceled" || orderStatus == "expired" || orderStatus == "failed") {
                return PaymentResult.Canceled
            }
        }
        return PaymentResult.Failed("Tiempo de espera agotado")
    }

    // ── SumUp ─────────────────────────────────────────────────────────────────
    private fun chargeSumUp(
        store: StoreInfo, terminal: PosTerminal, amount: Double, orderType: String, cb: Callback
    ): PaymentResult {
        val apiKey = terminal.apiKey ?: return PaymentResult.Failed("Falta API Key de SumUp")
        val merchantCode = terminal.deviceId ?: return PaymentResult.Failed("Falta Merchant Code de SumUp")
        post(cb) { cb.onProgress("Creando cobro SumUp…") }

        val ref = "SRSERVI-${System.currentTimeMillis()}"
        val payload = JSONObject().apply {
            put("checkout_reference", ref)
            put("amount", (Math.round(amount * 100.0) / 100.0))
            put("currency", store.currencyCode.ifBlank { "USD" })
            put("merchant_code", merchantCode)
            put("description", "Pedido POS")
        }
        val (code, body) = httpJson("POST", "https://api.sumup.com/v0.1/checkouts", apiKey, payload.toString())
        if (code !in 200..299) return PaymentResult.Failed("SumUp: $body")
        val checkoutId = JSONObject(body).optString("id", "")
        if (checkoutId.isBlank()) return PaymentResult.Failed("SumUp no devolvió checkout")

        post(cb) { cb.onProgress("Esperando pago…") }
        var polls = 0
        while (polls < MAX_POLLS) {
            Thread.sleep(POLL_INTERVAL_MS)
            polls++
            val (sc, sb) = httpJson("GET", "https://api.sumup.com/v0.1/checkouts/$checkoutId", apiKey, null)
            if (sc !in 200..299) continue
            when (JSONObject(sb).optString("status", "").uppercase()) {
                "PAID" -> return PaymentResult.Approved
                "FAILED", "EXPIRED" -> return PaymentResult.Canceled
            }
        }
        return PaymentResult.Failed("Tiempo de espera agotado")
    }

    // ── Square Terminal ─────────────────────────────────────────────────────────
    private fun chargeSquare(
        store: StoreInfo, terminal: PosTerminal, amount: Double, cb: Callback
    ): PaymentResult {
        val token = terminal.apiKey ?: return PaymentResult.Failed("Falta Access Token de Square")
        val rawDeviceId = terminal.deviceId ?: return PaymentResult.Failed("Falta terminal de Square")
        val deviceId = if (rawDeviceId.startsWith("device:")) rawDeviceId.substring(7) else rawDeviceId
        post(cb) { cb.onProgress("Enviando cobro al terminal Square…") }

        val currency = store.currencyCode.ifBlank { "USD" }
        val sqAmount = if (ZERO_DECIMAL.contains(currency)) amount.roundToLong() else (amount * 100).roundToLong()
        val idem = "sq_${System.currentTimeMillis()}_${(0..999999).random()}"
        val payload = JSONObject().apply {
            put("idempotency_key", idem)
            put("checkout", JSONObject().apply {
                put("amount_money", JSONObject().put("amount", sqAmount).put("currency", currency))
                put("device_options", JSONObject().put("device_id", deviceId))
                put("note", "Pedido POS")
            })
        }
        val headers = mapOf("Square-Version" to "2026-01-22")
        val (code, body) = httpJson("POST", "https://connect.squareup.com/v2/terminals/checkouts", token, payload.toString(), headers)
        if (code !in 200..299) return PaymentResult.Failed("Square: $body")
        val checkoutId = JSONObject(body).optJSONObject("checkout")?.optString("id", "") ?: ""
        if (checkoutId.isBlank()) return PaymentResult.Failed("Square no devolvió checkout")

        post(cb) { cb.onProgress("Esperando pago en el terminal…") }
        var polls = 0
        while (polls < MAX_POLLS) {
            Thread.sleep(POLL_INTERVAL_MS)
            polls++
            val (sc, sb) = httpJson("GET", "https://connect.squareup.com/v2/terminals/checkouts/$checkoutId", token, null, headers)
            if (sc !in 200..299) continue
            when (JSONObject(sb).optJSONObject("checkout")?.optString("status", "")?.uppercase()) {
                "COMPLETED" -> return PaymentResult.Approved
                "CANCELED", "CANCEL_REQUESTED" -> return PaymentResult.Canceled
            }
        }
        return PaymentResult.Failed("Tiempo de espera agotado")
    }

    // ── HTTP helper ─────────────────────────────────────────────────────────────
    private fun httpJson(
        method: String,
        url: String,
        bearer: String,
        body: String?,
        extraHeaders: Map<String, String> = emptyMap()
    ): Pair<Int, String> {
        var conn: HttpURLConnection? = null
        return try {
            conn = URL(url).openConnection() as HttpURLConnection
            conn.requestMethod = method
            conn.connectTimeout = 15000
            conn.readTimeout = 20000
            conn.setRequestProperty("Content-Type", "application/json")
            conn.setRequestProperty("Authorization", "Bearer $bearer")
            for ((k, v) in extraHeaders) conn.setRequestProperty(k, v)
            if (body != null) {
                conn.doOutput = true
                conn.outputStream.use { it.write(body.toByteArray()) }
            }
            val status = conn.responseCode
            val stream = if (status in 200..299) conn.inputStream else conn.errorStream
            val text = stream?.bufferedReader()?.use { it.readText() } ?: ""
            status to text
        } catch (e: Exception) {
            -1 to (e.message ?: "error de red")
        } finally {
            conn?.disconnect()
        }
    }

    private fun post(cb: Callback, block: () -> Unit) {
        mainHandler.post(block)
    }
}
