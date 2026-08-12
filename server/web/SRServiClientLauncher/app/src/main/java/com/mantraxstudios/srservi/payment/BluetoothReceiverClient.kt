package com.mantraxstudios.srservi.payment

import android.Manifest
import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothSocket
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import org.json.JSONObject
import java.util.UUID

/**
 * Cliente Bluetooth que envía el cobro al equipo con la app **SRServiReceiver**
 * (que tiene internet / el terminal) y espera el resultado del pago.
 *
 * Protocolo: JSON por línea sobre RFCOMM SPP (mismo UUID que el receptor).
 *   → {"type":"pay","provider":"tuu","amount":15000,"deviceId":"..","token":"..","orderRef":"1","method":1,"reqId":".."}
 *   ← {"type":"pay_result","reqId":"..","approved":true,"result":"approved","code":"..","message":".."}
 *
 * El dispositivo receptor debe estar **emparejado**. Se elige por MAC guardada en
 * prefs ("receiver_mac") o, si no hay, el primer emparejado cuyo nombre contenga
 * "SRServiReceiver"/"Receiver".
 */
object BluetoothReceiverClient {

    private val SPP_UUID: UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")
    private const val PREFS = "srservi_prefs"
    private const val KEY_RECEIVER_MAC = "receiver_mac"

    data class Result(
        val available: Boolean,   // ¿había un receptor emparejado y se pudo hablar con él?
        val approved: Boolean,
        val result: String,       // approved | canceled | failed | no_receiver | error
        val code: String,
        val message: String
    )

    fun hasPermission(ctx: Context): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true
        return ContextCompat.checkSelfPermission(ctx, Manifest.permission.BLUETOOTH_CONNECT) ==
            PackageManager.PERMISSION_GRANTED
    }

    @SuppressLint("MissingPermission")
    fun findReceiver(ctx: Context): BluetoothDevice? {
        if (!hasPermission(ctx)) return null
        val adapter = BluetoothAdapter.getDefaultAdapter() ?: return null
        if (!adapter.isEnabled) return null

        val savedMac = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY_RECEIVER_MAC, null)?.trim()
        val bonded = try { adapter.bondedDevices } catch (_: SecurityException) { null } ?: return null

        if (!savedMac.isNullOrBlank()) {
            bonded.firstOrNull { it.address.equals(savedMac, true) }?.let { return it }
        }
        return bonded.firstOrNull {
            val n = try { it.name ?: "" } catch (_: SecurityException) { "" }
            n.contains("SRServiReceiver", true) || n.contains("Receiver", true)
        }
    }

    fun isReceiverAvailable(ctx: Context): Boolean = findReceiver(ctx) != null

    /**
     * Envía el cobro y BLOQUEA hasta recibir la respuesta (o timeout). Llamar
     * desde un hilo de fondo, nunca desde el hilo principal.
     */
    @SuppressLint("MissingPermission")
    fun pay(
        ctx: Context,
        provider: String,
        amount: Double,
        currency: String,
        token: String?,
        deviceId: String?,
        orderRef: String,
        method: Int
    ): Result {
        val device = findReceiver(ctx)
            ?: return Result(false, false, "no_receiver", "", "No hay receptor Bluetooth emparejado")

        var socket: BluetoothSocket? = null
        return try {
            socket = device.createRfcommSocketToServiceRecord(SPP_UUID)
            try { BluetoothAdapter.getDefaultAdapter()?.cancelDiscovery() } catch (_: Exception) {}
            socket.connect()

            val reqId = UUID.randomUUID().toString()
            val payload = JSONObject().apply {
                put("type", "pay")
                put("provider", provider)
                put("amount", amount)
                put("currency", currency)
                put("token", token ?: "")
                put("deviceId", deviceId ?: "")
                put("orderRef", orderRef)
                put("method", method)
                put("reqId", reqId)
            }
            val out = socket.outputStream
            out.write((payload.toString() + "\n").toByteArray(Charsets.UTF_8))
            out.flush()

            // Espera la línea de respuesta (el cobro puede tardar minutos).
            val input = socket.inputStream
            val buffer = ByteArray(4096)
            val sb = StringBuilder()
            // 6 min: margen sobre el sondeo TUU del receptor (5 s × 60 ≈ 5 min).
            val deadline = System.currentTimeMillis() + 6 * 60 * 1000L
            var response: JSONObject? = null

            while (System.currentTimeMillis() < deadline) {
                val n = input.read(buffer)
                if (n == -1) break
                sb.append(String(buffer, 0, n, Charsets.UTF_8))
                var idx = sb.indexOf("\n")
                while (idx >= 0) {
                    val line = sb.substring(0, idx).trim()
                    sb.delete(0, idx + 1)
                    if (line.isNotEmpty()) {
                        val j = try { JSONObject(line) } catch (_: Exception) { null }
                        if (j != null && j.optString("type") == "pay_result" &&
                            j.optString("reqId") == reqId
                        ) { response = j; break }
                    }
                    idx = sb.indexOf("\n")
                }
                if (response != null) break
            }

            if (response == null) {
                Result(true, false, "failed", "", "Sin respuesta del receptor")
            } else {
                Result(
                    available = true,
                    approved = response.optBoolean("approved", false),
                    result = response.optString("result", "failed"),
                    code = response.optString("code", ""),
                    message = response.optString("message", "")
                )
            }
        } catch (e: Exception) {
            Result(true, false, "error", "", e.message ?: "Error Bluetooth")
        } finally {
            try { socket?.close() } catch (_: Exception) {}
        }
    }
}
