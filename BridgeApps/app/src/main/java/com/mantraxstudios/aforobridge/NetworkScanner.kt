package com.mantraxstudios.aforobridge

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import kotlinx.coroutines.withContext
import java.net.InetSocketAddress
import java.net.Socket

/** Escanea la red local (Wi-Fi) buscando dispositivos con el puerto RTSP abierto. */
object NetworkScanner {

    /** IPv4 local del teléfono (la de la Wi-Fi). */
    fun localIPv4(): String? {
        return try {
            java.net.NetworkInterface.getNetworkInterfaces().toList()
                .filter { it.isUp && !it.isLoopback }
                .flatMap { it.inetAddresses.toList() }
                .firstOrNull { addr ->
                    !addr.isLoopbackAddress && addr is java.net.Inet4Address &&
                        addr.hostAddress?.startsWith("169.254") == false
                }?.hostAddress
        } catch (_: Exception) { null }
    }

    /**
     * Escanea x.x.x.1-254 en el puerto dado. onProgress(revisados, total).
     * Devuelve las IPs que respondieron, ordenadas.
     */
    suspend fun scan(port: Int, onProgress: ((Int, Int) -> Unit)? = null): List<String> =
        withContext(Dispatchers.IO) {
            val local = localIPv4() ?: return@withContext emptyList()
            val parts = local.split(".")
            if (parts.size != 4) return@withContext emptyList()
            val prefix = "${parts[0]}.${parts[1]}.${parts[2]}."

            val found = mutableListOf<String>()
            val sem = Semaphore(64)
            var done = 0
            val total = 254
            coroutineScope {
                for (i in 1..254) {
                    val ip = "$prefix$i"
                    launch {
                        sem.withPermit {
                            if (isOpen(ip, port, 400)) synchronized(found) { found.add(ip) }
                        }
                        synchronized(found) { done++ }
                        onProgress?.invoke(done, total)
                    }
                }
            }
            found.sortedBy { it.substringAfterLast('.').toIntOrNull() ?: 999 }
        }

    private fun isOpen(ip: String, port: Int, timeoutMs: Int): Boolean {
        return try {
            Socket().use { s ->
                s.connect(InetSocketAddress(ip, port), timeoutMs)
                true
            }
        } catch (_: Exception) { false }
    }
}
