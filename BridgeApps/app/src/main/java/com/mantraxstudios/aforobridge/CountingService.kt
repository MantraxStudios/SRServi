package com.mantraxstudios.aforobridge

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.ImageFormat
import android.media.ImageReader
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.rtsp.RtspMediaSource
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/**
 * Servicio en primer plano que cuenta el aforo desde la cámara RTSP:
 * ExoPlayer decodifica el stream → ImageReader entrega frames YUV →
 * MotionDetector cuenta cruces → se reportan al servidor + se suben snapshots.
 * Sigue corriendo aunque la app esté cerrada y arranca solo con el teléfono.
 */
@androidx.annotation.OptIn(androidx.media3.common.util.UnstableApi::class)
class CountingService : Service() {

    companion object {
        const val CHANNEL_ID = "aforo_counter"
        const val NOTIF_ID = 1001

        val isRunning = MutableStateFlow(false)
        val status = MutableStateFlow("Detenido")
        val countIn = MutableStateFlow(0)
        val countOut = MutableStateFlow(0)

        fun start(ctx: Context) =
            ContextCompat.startForegroundService(ctx, Intent(ctx, CountingService::class.java))

        fun stop(ctx: Context) = ctx.stopService(Intent(ctx, CountingService::class.java))
    }

    private lateinit var settings: Settings
    private lateinit var api: Api
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val mainHandler = Handler(Looper.getMainLooper())

    private var player: ExoPlayer? = null
    private var reader: ImageReader? = null
    private var imgThread: HandlerThread? = null
    private var detector: MotionDetector? = null
    private var wakeLock: PowerManager.WakeLock? = null

    private var started = false
    private var lastSnap = 0L

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        settings = Settings(this)
        api = Api(settings.serverUrl)
        createChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForegroundSafely(buildNotif("Iniciando…"))
        if (!started) { started = true; setup() }
        return START_STICKY
    }

    private fun setup() {
        acquireWakeLock()
        isRunning.value = true
        status.value = "Conectando…"

        scope.launch {
            // 1) Sesión
            try {
                api.setBaseUrl(settings.serverUrl)
                api.login(settings.email, settings.password)
            } catch (e: Exception) {
                status.value = "Error de sesión: ${e.message}"
            }

            // 2) Línea de conteo
            val line = runCatching { api.getLineConfig(settings.storeId) }.getOrNull()
            detector = MotionDetector(
                sensitivity = settings.sensitivity,
                x1 = line?.x1 ?: 0.15, y1 = line?.y1 ?: 0.5,
                x2 = line?.x2 ?: 0.85, y2 = line?.y2 ?: 0.5,
                flip = line?.flip ?: false
            ) { dir ->
                countIn.value = detector?.countIn ?: 0
                countOut.value = detector?.countOut ?: 0
                scope.launch { api.postEvent(settings.storeId, dir) }
                mainHandler.post { updateNotif() }
            }

            // 3) Guardar info de cámara en el panel (informativo)
            scope.launch { api.saveRtspInfo(settings.storeId, settings.rtspUrl(), settings.sensitivity) }

            // 4) Arrancar captura + decodificación
            startCapture()

            // 5) Refrescar la línea cada 60s
            scope.launch {
                while (isActive) {
                    delay(60_000)
                    runCatching { api.getLineConfig(settings.storeId) }.getOrNull()?.let {
                        detector?.updateLine(it)
                    }
                }
            }
        }
    }

    private fun startCapture() {
        val ht = HandlerThread("aforo-img").apply { start() }
        imgThread = ht
        val handler = Handler(ht.looper)

        val r = ImageReader.newInstance(640, 360, ImageFormat.YUV_420_888, 2)
        reader = r
        r.setOnImageAvailableListener({ reader ->
            val img = reader.acquireLatestImage() ?: return@setOnImageAvailableListener
            try {
                detector?.process(YuvUtils.luminance80x60(img))
                val now = System.currentTimeMillis()
                if (now - lastSnap > 100) { // ~10 fps para una vista previa fluida
                    lastSnap = now
                    val jpeg = YuvUtils.toJpeg(img)
                    scope.launch { api.uploadSnapshot(settings.storeId, jpeg) }
                }
            } catch (_: Exception) {
            } finally {
                img.close()
            }
        }, handler)

        val p = ExoPlayer.Builder(this).build()
        player = p
        p.setVideoSurface(r.surface)
        p.volume = 0f
        p.addListener(object : Player.Listener {
            override fun onPlaybackStateChanged(state: Int) {
                if (state == Player.STATE_READY) {
                    status.value = "Contando"
                    updateNotif()
                }
            }
            override fun onPlayerError(error: PlaybackException) {
                status.value = "Reconectando…"
                updateNotif()
                // Reintentar a los 5s
                mainHandler.postDelayed({
                    runCatching { p.setMediaSource(buildSource()); p.prepare(); p.playWhenReady = true }
                }, 5000)
            }
        })
        p.setMediaSource(buildSource())
        p.prepare()
        p.playWhenReady = true
    }

    private fun buildSource() = RtspMediaSource.Factory()
        .setForceUseRtpTcp(true)
        .setTimeoutMs(15000)
        .createMediaSource(MediaItem.fromUri(settings.rtspUrl()))

    // ── Notificación ──────────────────────────────────────────────────────────
    private fun createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val ch = NotificationChannel(CHANNEL_ID, "Contador de aforo", NotificationManager.IMPORTANCE_LOW)
            ch.description = "Mantiene el conteo activo en segundo plano"
            getSystemService(NotificationManager::class.java).createNotificationChannel(ch)
        }
    }

    private fun buildNotif(text: String): Notification {
        val open = android.app.PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java),
            android.app.PendingIntent.FLAG_IMMUTABLE or android.app.PendingIntent.FLAG_UPDATE_CURRENT
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("AforoBridge")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_menu_view)
            .setOngoing(true)
            .setContentIntent(open)
            .build()
    }

    private fun updateNotif() {
        val text = "${status.value} · Entradas ${countIn.value} · Salidas ${countOut.value}"
        getSystemService(NotificationManager::class.java).notify(NOTIF_ID, buildNotif(text))
    }

    private fun startForegroundSafely(notif: Notification) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ServiceCompat.startForeground(this, NOTIF_ID, notif, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
        } else {
            startForeground(NOTIF_ID, notif)
        }
    }

    private fun acquireWakeLock() {
        val pm = getSystemService(POWER_SERVICE) as PowerManager
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "AforoBridge::counting").apply {
            setReferenceCounted(false)
            acquire(12 * 60 * 60 * 1000L)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        isRunning.value = false
        status.value = "Detenido"
        runCatching { player?.release() }
        runCatching { reader?.close() }
        runCatching { imgThread?.quitSafely() }
        runCatching { wakeLock?.release() }
        scope.cancel()
    }
}
