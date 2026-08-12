package com.mantraxstudios.srservireceiver

import android.Manifest
import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothServerSocket
import android.bluetooth.BluetoothSocket
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import java.io.InputStream
import java.util.UUID

/**
 * Servicio en primer plano que mantiene un servidor Bluetooth RFCOMM (SPP)
 * escuchando conexiones entrantes y leyendo los datos que llegan.
 *
 * Se relanza solo (START_STICKY), mantiene un WakeLock y se reinicia al
 * encender el teléfono (ver BootReceiver), de modo que "nunca deja de funcionar".
 */
class BluetoothReceiverService : Service() {

    companion object {
        // UUID estándar de Serial Port Profile (SPP). El emisor debe usar el mismo.
        private val SPP_UUID: UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")
        private const val SERVICE_NAME = "SRServiReceiver"

        private const val CHANNEL_ID = "srservi_receiver"
        private const val NOTIF_ID = 1001

        const val ACTION_START = "com.mantraxstudios.srservireceiver.START"
        const val ACTION_STOP = "com.mantraxstudios.srservireceiver.STOP"

        @Volatile
        var isRunning: Boolean = false
            private set
    }

    @Volatile private var running = false
    private var serverThread: Thread? = null
    private var serverSocket: BluetoothServerSocket? = null
    private var wakeLock: PowerManager.WakeLock? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopEverything()
            return START_NOT_STICKY
        }

        startForegroundNotification("Iniciando…")
        acquireWakeLock()

        if (!running) {
            running = true
            isRunning = true
            ReceiverState.setStatus(ReceiverState.Status.WAITING)
            serverThread = Thread { serverLoop() }.also { it.start() }
        }
        // Si el sistema lo mata, que lo vuelva a crear.
        return START_STICKY
    }

    // -- Bucle principal del servidor -------------------------------------------------

    @SuppressLint("MissingPermission")
    private fun serverLoop() {
        val adapter = BluetoothAdapter.getDefaultAdapter()
        if (adapter == null) {
            log("Este dispositivo no tiene Bluetooth.")
            updateNotification("Sin Bluetooth")
            return
        }

        while (running) {
            if (!hasConnectPermission()) {
                log("Falta el permiso de Bluetooth. Ábrelo en la app y concédelo.")
                updateNotification("Falta permiso Bluetooth")
                sleep(3000)
                continue
            }
            if (!adapter.isEnabled) {
                ReceiverState.setStatus(ReceiverState.Status.WAITING)
                updateNotification("Bluetooth apagado — esperando…")
                sleep(3000)
                continue
            }

            // Nombre reconocible para que el tótem (launcher) lo encuentre emparejado.
            try {
                if (adapter.name?.contains("SRServiReceiver", true) != true) {
                    adapter.name = "SRServiReceiver"
                }
            } catch (_: Exception) {}

            try {
                serverSocket = adapter.listenUsingRfcommWithServiceRecord(SERVICE_NAME, SPP_UUID)
                ReceiverState.setStatus(ReceiverState.Status.WAITING)
                updateNotification("Esperando conexión…")

                // accept() bloquea hasta que un dispositivo se conecta.
                val socket = serverSocket?.accept()
                // Ya no necesitamos aceptar más en este socket de escucha.
                closeQuietly(serverSocket); serverSocket = null

                if (socket != null) {
                    handleConnection(socket)
                }
            } catch (e: Exception) {
                if (running) {
                    log("Servidor reiniciándose: ${e.message}")
                    sleep(1500)
                }
            } finally {
                closeQuietly(serverSocket); serverSocket = null
            }
        }
    }

    @SuppressLint("MissingPermission")
    private fun handleConnection(socket: BluetoothSocket) {
        val deviceName = try {
            socket.remoteDevice?.name ?: socket.remoteDevice?.address ?: "Desconocido"
        } catch (e: SecurityException) {
            socket.remoteDevice?.address ?: "Desconocido"
        }

        ReceiverState.setStatus(ReceiverState.Status.CONNECTED)
        ReceiverState.setConnectedDevice(deviceName)
        updateNotification("Conectado: $deviceName")
        log("✅ Conectado con $deviceName")

        try {
            val input: InputStream = socket.inputStream
            val output = socket.outputStream
            val buffer = ByteArray(4096)
            val lineBuffer = StringBuilder()

            while (running) {
                val count = input.read(buffer)
                if (count == -1) break // el otro extremo cerró

                val chunk = String(buffer, 0, count, Charsets.UTF_8)
                lineBuffer.append(chunk)

                // Separar por saltos de línea; lo que quede sin \n se conserva.
                var idx = lineBuffer.indexOf("\n")
                while (idx >= 0) {
                    val line = lineBuffer.substring(0, idx).trim('\r', ' ', '\t')
                    lineBuffer.delete(0, idx + 1)
                    if (line.isNotEmpty()) {
                        ReceiverState.addMessage("← $line")
                        onDataReceived(line, output)
                    }
                    idx = lineBuffer.indexOf("\n")
                }
            }
        } catch (e: Exception) {
            log("Conexión finalizada: ${e.message}")
        } finally {
            closeQuietly(socket)
            ReceiverState.setConnectedDevice(null)
            ReceiverState.setStatus(ReceiverState.Status.WAITING)
            log("🔌 Desconectado de $deviceName")
        }
    }

    /**
     * Procesa cada línea recibida. Si es una petición de cobro (JSON con "type":"pay"),
     * ejecuta el pago con el proveedor y responde por Bluetooth con el resultado.
     */
    private fun onDataReceived(data: String, output: java.io.OutputStream) {
        val json = try { org.json.JSONObject(data) } catch (_: Exception) { null }
        if (json == null) return // texto simple: solo se muestra en pantalla

        when (json.optString("type")) {
            "ping" -> writeLine(output, "{\"type\":\"pong\"}")

            "pay" -> {
                val reqId = json.optString("reqId", "")
                val orderRef = json.optString("orderRef", "")
                val req = PaymentProcessor.Request(
                    provider = json.optString("provider", "tuu"),
                    amount = json.optDouble("amount", 0.0),
                    currency = json.optString("currency", "CLP"),
                    token = json.optString("token", "").ifBlank { null },
                    deviceId = json.optString("deviceId", "").ifBlank { null },
                    orderRef = orderRef,
                    method = json.optInt("method", 1)
                )
                updateNotification("Cobrando $${req.amount.toLong()}…")
                val out = PaymentProcessor.process(req)
                val resp = org.json.JSONObject().apply {
                    put("type", "pay_result")
                    put("reqId", reqId)
                    put("orderRef", orderRef)
                    put("approved", out.approved)
                    put("result", out.result)
                    put("code", out.code)
                    put("message", out.message)
                }
                writeLine(output, resp.toString())
                ReceiverState.addMessage(
                    (if (out.approved) "✅ Pago aprobado" else "❌ Pago ${out.result}") +
                        (if (out.code.isNotBlank()) " · ${out.code}" else "")
                )
                updateNotification(if (out.approved) "Último: aprobado" else "Último: ${out.result}")
            }
        }
    }

    private fun writeLine(output: java.io.OutputStream, line: String) {
        try {
            synchronized(output) {
                output.write((line + "\n").toByteArray(Charsets.UTF_8))
                output.flush()
            }
            ReceiverState.addMessage("→ $line")
        } catch (e: Exception) {
            ReceiverState.addMessage("Error al responder: ${e.message}")
        }
    }

    // -- Notificación / foreground ----------------------------------------------------

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Receptor Bluetooth",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Mantiene activo el receptor Bluetooth de SRServi"
                setShowBadge(false)
            }
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(text: String): Notification {
        val openIntent = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Receptor Bluetooth activo")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.stat_sys_data_bluetooth)
            .setContentIntent(openIntent)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun startForegroundNotification(text: String) {
        val notif = buildNotification(text)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIF_ID, notif,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE
            )
        } else {
            startForeground(NOTIF_ID, notif)
        }
    }

    private fun updateNotification(text: String) {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(NOTIF_ID, buildNotification(text))
    }

    // -- WakeLock ---------------------------------------------------------------------

    private fun acquireWakeLock() {
        if (wakeLock == null) {
            val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
            wakeLock = pm.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK,
                "SRServiReceiver::BtWakeLock"
            )
        }
        if (wakeLock?.isHeld == false) {
            @Suppress("WakelockTimeout")
            wakeLock?.acquire()
        }
    }

    private fun releaseWakeLock() {
        if (wakeLock?.isHeld == true) wakeLock?.release()
    }

    // -- Ciclo de vida ----------------------------------------------------------------

    private fun stopEverything() {
        running = false
        isRunning = false
        ReceiverState.setStatus(ReceiverState.Status.STOPPED)
        ReceiverState.setConnectedDevice(null)
        closeQuietly(serverSocket); serverSocket = null
        serverThread?.interrupt()
        releaseWakeLock()
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onDestroy() {
        running = false
        isRunning = false
        closeQuietly(serverSocket); serverSocket = null
        releaseWakeLock()
        ReceiverState.setStatus(ReceiverState.Status.STOPPED)
        super.onDestroy()
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        // Si el usuario cierra la app desde recientes, reprogramamos el arranque.
        if (running) {
            val restart = Intent(applicationContext, BluetoothReceiverService::class.java).apply {
                action = ACTION_START
            }
            val pi = PendingIntent.getService(
                this, 1, restart,
                PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
            )
            val am = getSystemService(Context.ALARM_SERVICE) as android.app.AlarmManager
            am.set(
                android.app.AlarmManager.RTC_WAKEUP,
                System.currentTimeMillis() + 1000,
                pi
            )
        }
        super.onTaskRemoved(rootIntent)
    }

    // -- Utilidades -------------------------------------------------------------------

    private fun hasConnectPermission(): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true
        return ContextCompat.checkSelfPermission(
            this, Manifest.permission.BLUETOOTH_CONNECT
        ) == PackageManager.PERMISSION_GRANTED
    }

    private fun log(msg: String) = ReceiverState.addMessage(msg)

    private fun sleep(ms: Long) = try { Thread.sleep(ms) } catch (_: InterruptedException) {}

    private fun closeQuietly(c: java.io.Closeable?) = try { c?.close() } catch (_: Exception) {}
}
