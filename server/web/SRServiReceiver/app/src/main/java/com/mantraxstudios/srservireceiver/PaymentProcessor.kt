package com.mantraxstudios.srservireceiver

import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID
import kotlin.math.roundToLong

/**
 * Procesa un cobro con la API del proveedor (las MISMAS llamadas que hace el
 * servidor SRServi y la app offline del launcher). Es SÍNCRONO: se llama desde
 * el hilo del servidor Bluetooth y devuelve el resultado del pago.
 *
 * Las credenciales (token / deviceId) llegan dentro de la petición Bluetooth que
 * envía el tótem (SRServiClientLauncher), que ya las tiene configuradas offline.
 */
object PaymentProcessor {

    private val ZERO_DECIMAL = setOf(
        "JPY", "KRW", "CLP", "GNF", "ISK", "KMF", "MGA", "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "BIF"
    )

    private const val POLL_INTERVAL_MS = 3000L
    private const val MAX_POLLS = 60 // ~3 minutos

    /** Datos de la petición de cobro que llega por Bluetooth. */
    data class Request(
        val provider: String,
        val amount: Double,
        val currency: String,
        val token: String?,     // api_key del proveedor
        val deviceId: String?,  // serie / terminal_id / merchant_code
        val orderRef: String,
        val method: Int
    )

    /** approved = pago exitoso. code = referencia/comprobante. result = approved|canceled|failed. */
    data class Outcome(
        val approved: Boolean,
        val result: String,
        val code: String,
        val message: String
    )

    private fun log(msg: String) = ReceiverState.addMessage(msg)

    fun process(req: Request): Outcome {
        return try {
            when (req.provider.lowercase()) {
                "mercadopago" -> chargeMercadoPago(req)
                "sumup" -> chargeSumUp(req)
                "square" -> chargeSquare(req)
                "tuu" -> chargeTuu(req)
                "cash", "efectivo" -> Outcome(true, "approved", req.orderRef, "Efectivo")
                else -> Outcome(false, "failed", "", "Proveedor no soportado: ${req.provider}")
            }
        } catch (e: Exception) {
            Outcome(false, "failed", "", e.message ?: "Error de cobro")
        }
    }

    // ── Mercado Pago Point (Orders API) ───────────────────────────────────────
    private fun chargeMercadoPago(req: Request): Outcome {
        val token = req.token ?: return Outcome(false, "failed", "", "Falta token de Mercado Pago")
        val deviceId = req.deviceId ?: return Outcome(false, "failed", "", "Falta terminal de Mercado Pago")
        log("Enviando cobro Mercado Pago…")

        val idem = "ORDER-${System.currentTimeMillis()}-${(0..999999).random()}"
        val payload = JSONObject().apply {
            put("type", "point")
            put("external_reference", req.orderRef.ifBlank { idem })
            put("description", "Pedido POS")
            put("expiration_time", "PT10M")
            put("transactions", JSONObject().apply {
                put("payments", JSONArray().apply {
                    put(JSONObject().put("amount", req.amount.roundToLong().toString()))
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
        if (code !in 200..299) return Outcome(false, "failed", "", "Mercado Pago: $body")
        val orderId = JSONObject(body).optString("id", "")
        if (orderId.isBlank()) return Outcome(false, "failed", "", "MP no devolvió id de orden")

        log("Esperando pago en el terminal…")
        var polls = 0
        while (polls < MAX_POLLS) {
            Thread.sleep(POLL_INTERVAL_MS); polls++
            val (sc, sb) = httpJson("GET", "https://api.mercadopago.com/v1/orders/$orderId", token, null)
            if (sc !in 200..299) continue
            val json = JSONObject(sb)
            val orderStatus = json.optString("status", "")
            val payStatus = json.optJSONObject("transactions")
                ?.optJSONArray("payments")?.optJSONObject(0)?.optString("status", "") ?: ""
            val approved = orderStatus == "processed" || orderStatus == "action_required" ||
                payStatus == "processed" || payStatus == "action_required"
            if (approved) return Outcome(true, "approved", orderId, "Aprobado")
            if (orderStatus == "canceled" || orderStatus == "expired" || orderStatus == "failed")
                return Outcome(false, "canceled", orderId, "Cancelado")
        }
        return Outcome(false, "failed", orderId, "Tiempo de espera agotado")
    }

    // ── SumUp ─────────────────────────────────────────────────────────────────
    private fun chargeSumUp(req: Request): Outcome {
        val apiKey = req.token ?: return Outcome(false, "failed", "", "Falta token de SumUp")
        val merchantCode = req.deviceId ?: return Outcome(false, "failed", "", "Falta Merchant Code de SumUp")
        log("Creando cobro SumUp…")

        val ref = req.orderRef.ifBlank { "SRSERVI-${System.currentTimeMillis()}" }
        val payload = JSONObject().apply {
            put("checkout_reference", ref)
            put("amount", (Math.round(req.amount * 100.0) / 100.0))
            put("currency", req.currency.ifBlank { "USD" })
            put("merchant_code", merchantCode)
            put("description", "Pedido POS")
        }
        val (code, body) = httpJson("POST", "https://api.sumup.com/v0.1/checkouts", apiKey, payload.toString())
        if (code !in 200..299) return Outcome(false, "failed", "", "SumUp: $body")
        val checkoutId = JSONObject(body).optString("id", "")
        if (checkoutId.isBlank()) return Outcome(false, "failed", "", "SumUp no devolvió checkout")

        log("Esperando pago…")
        var polls = 0
        while (polls < MAX_POLLS) {
            Thread.sleep(POLL_INTERVAL_MS); polls++
            val (sc, sb) = httpJson("GET", "https://api.sumup.com/v0.1/checkouts/$checkoutId", apiKey, null)
            if (sc !in 200..299) continue
            when (JSONObject(sb).optString("status", "").uppercase()) {
                "PAID" -> return Outcome(true, "approved", checkoutId, "Aprobado")
                "FAILED", "EXPIRED" -> return Outcome(false, "canceled", checkoutId, "Cancelado")
            }
        }
        return Outcome(false, "failed", checkoutId, "Tiempo de espera agotado")
    }

    // ── Square Terminal ───────────────────────────────────────────────────────
    private fun chargeSquare(req: Request): Outcome {
        val token = req.token ?: return Outcome(false, "failed", "", "Falta token de Square")
        val rawDeviceId = req.deviceId ?: return Outcome(false, "failed", "", "Falta terminal de Square")
        val deviceId = if (rawDeviceId.startsWith("device:")) rawDeviceId.substring(7) else rawDeviceId
        log("Enviando cobro Square…")

        val currency = req.currency.ifBlank { "USD" }
        val sqAmount = if (ZERO_DECIMAL.contains(currency)) req.amount.roundToLong() else (req.amount * 100).roundToLong()
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
        if (code !in 200..299) return Outcome(false, "failed", "", "Square: $body")
        val checkoutId = JSONObject(body).optJSONObject("checkout")?.optString("id", "") ?: ""
        if (checkoutId.isBlank()) return Outcome(false, "failed", "", "Square no devolvió checkout")

        log("Esperando pago en el terminal…")
        var polls = 0
        while (polls < MAX_POLLS) {
            Thread.sleep(POLL_INTERVAL_MS); polls++
            val (sc, sb) = httpJson("GET", "https://connect.squareup.com/v2/terminals/checkouts/$checkoutId", token, null, headers)
            if (sc !in 200..299) continue
            when (JSONObject(sb).optJSONObject("checkout")?.optString("status", "")?.uppercase()) {
                "COMPLETED" -> return Outcome(true, "approved", checkoutId, "Aprobado")
                "CANCELED", "CANCEL_REQUESTED" -> return Outcome(false, "canceled", checkoutId, "Cancelado")
            }
        }
        return Outcome(false, "failed", checkoutId, "Tiempo de espera agotado")
    }

    // ── TUU (Haulmer RemotePayment) ───────────────────────────────────────────
    private const val TUU_API = "https://integrations.payment.haulmer.com/RemotePayment/v2"

    private fun chargeTuu(req: Request): Outcome {
        val apiKey = req.token ?: return Outcome(false, "failed", "", "Falta API Key de TUU")
        val serial = req.deviceId ?: return Outcome(false, "failed", "", "Falta serie del terminal TUU")
        log("Enviando cobro al terminal TUU…")

        val idem = UUID.randomUUID().toString()
        val payload = JSONObject().apply {
            put("Amount", req.amount.roundToLong())
            put("Device", serial)
            put("IdempotencyKey", idem)
            put("Description", "Pedido POS")
            put("DteType", 0)
            put("extraData", JSONObject().apply {
                put("sourceName", "SRServiReceiver")
                put("sourceVersion", "1.1.0")
            })
        }
        val (code, body) = httpRequest(
            "POST", "$TUU_API/Create",
            mapOf("Content-Type" to "application/json", "X-API-Key" to apiKey),
            payload.toString()
        )
        if (code !in 200..299) return Outcome(false, "failed", "", "TUU: $body")
        // Igual que el server (tuuCreatePayment): usa el idempotencyKey devuelto o el enviado.
        val key = JSONObject(body).optString("idempotencyKey", "").ifBlank { idem }

        log("Esperando pago en el terminal…")
        // Mismo sondeo que el server (tuuStartPolling): cada 5 s, hasta 60 intentos (~5 min).
        var polls = 0
        while (polls < 60) {
            Thread.sleep(5000L); polls++
            val (sc, sb) = httpRequest("GET", "$TUU_API/GetPaymentRequest/$key", mapOf("X-API-Key" to apiKey), null)
            if (sc !in 200..299) continue
            val json = JSONObject(sb)
            when (json.optString("status", "")) {
                "Completed" -> {
                    // El server guarda transactionReference (referencia) y sequenceNumber (n° comprobante).
                    val code2 = json.optString("transactionReference", "")
                        .ifBlank { json.optString("sequenceNumber", "") }
                        .ifBlank { key }
                    return Outcome(true, "approved", code2, "Aprobado")
                }
                "Canceled", "Failed" -> return Outcome(false, "canceled", key, "Cancelado")
            }
        }
        return Outcome(false, "failed", key, "Tiempo de espera agotado")
    }

    // ── HTTP helpers ──────────────────────────────────────────────────────────
    private fun httpJson(
        method: String, url: String, bearer: String, body: String?,
        extraHeaders: Map<String, String> = emptyMap()
    ): Pair<Int, String> {
        val headers = HashMap<String, String>()
        headers["Content-Type"] = "application/json"
        headers["Authorization"] = "Bearer $bearer"
        headers.putAll(extraHeaders)
        return httpRequest(method, url, headers, body)
    }

    private fun httpRequest(
        method: String, url: String, headers: Map<String, String>, body: String?
    ): Pair<Int, String> {
        var conn: HttpURLConnection? = null
        return try {
            conn = URL(url).openConnection() as HttpURLConnection
            conn.requestMethod = method
            conn.connectTimeout = 15000
            conn.readTimeout = 20000
            for ((k, v) in headers) conn.setRequestProperty(k, v)
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
}
