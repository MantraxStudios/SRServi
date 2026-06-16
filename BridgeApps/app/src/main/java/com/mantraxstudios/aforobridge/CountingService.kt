package com.mantraxstudios.aforobridge

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Bitmap
import android.graphics.SurfaceTexture
import android.net.Uri
import android.opengl.EGL14
import android.opengl.EGLConfig
import android.opengl.EGLContext
import android.opengl.EGLDisplay
import android.opengl.EGLSurface
import android.opengl.GLES11Ext
import android.opengl.GLES20
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.view.Surface
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
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.FloatBuffer
import java.time.LocalDate

@Suppress("UnsafeOptInUsageError")
class CountingService : Service() {

    companion object {
        const val CHANNEL_ID = "aforo_counter"
        const val NOTIF_ID  = 1001

        private const val W = 80
        private const val H = 60

        private const val FRAME_INTERVAL_MS = 180L
        private const val SNAP_INTERVAL_MS  = 1000L

        val isRunning = MutableStateFlow(false)
        val status    = MutableStateFlow("Detenido")
        val countIn   = MutableStateFlow(0)
        val countOut  = MutableStateFlow(0)

        fun start(ctx: Context) =
            ContextCompat.startForegroundService(ctx, Intent(ctx, CountingService::class.java))
        fun stop(ctx: Context) =
            ctx.stopService(Intent(ctx, CountingService::class.java))
    }

    private lateinit var settings: Settings
    private lateinit var api: Api
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val mainHandler = Handler(Looper.getMainLooper())

    private var player: ExoPlayer? = null
    private var glReader: GlFrameReader? = null

    private var detector: MotionDetector? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private var retryRunnable: Runnable? = null
    private var destroyed = false
    private var started   = false

    private var lastFrameTime = 0L
    private var lastSnapTime  = 0L
    private var firstFrame    = true

    private val snapChannel = Channel<ByteArray>(Channel.CONFLATED)

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        try {
            settings = Settings(this)
            api      = Api(settings.serverUrl)
            createChannel()
        } catch (e: Throwable) {
            status.value = "Error al crear servicio: ${e.message}"
            stopSelf()
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        try {
            startForegroundSafely(buildNotif("Iniciando…"))
            if (!started) { started = true; setup() }
        } catch (e: Throwable) {
            status.value = "Error al iniciar: ${e.message}"
            runCatching { stopSelf() }
        }
        return START_STICKY
    }

    override fun onDestroy() {
        super.onDestroy()
        destroyed = true
        detector?.let {
            settings.countIn   = it.countIn
            settings.countOut  = it.countOut
            settings.countDate = LocalDate.now().toString()
        }
        isRunning.value = false
        status.value    = "Detenido"
        releaseCapture()
        runCatching { wakeLock?.release() }
        scope.cancel()
    }

    private fun setup() {
        runCatching { acquireWakeLock() }
        isRunning.value = true
        status.value    = "Conectando…"

        scope.launch {
            try {
                api.setBaseUrl(settings.serverUrl)
                api.login(settings.email, settings.password)
            } catch (e: Exception) {
                status.value = "Error de sesión: ${e.message}"
            }

            val today = LocalDate.now().toString()
            val savedIn: Int
            val savedOut: Int
            if (settings.countDate == today) {
                savedIn  = settings.countIn
                savedOut = settings.countOut
            } else {
                savedIn  = 0; savedOut = 0
                settings.countDate = today
                settings.countIn   = 0; settings.countOut = 0
            }
            countIn.value  = savedIn
            countOut.value = savedOut

            val line = runCatching { api.getLineConfig(settings.storeId) }.getOrNull()
            detector = MotionDetector(
                sensitivity = settings.sensitivity,
                x1 = line?.x1 ?: 0.15, y1 = line?.y1 ?: 0.5,
                x2 = line?.x2 ?: 0.85, y2 = line?.y2 ?: 0.5,
                flip = line?.flip ?: false,
                initialIn  = savedIn,
                initialOut = savedOut,
                onCountChanged = { cIn, cOut ->
                    settings.countIn = cIn; settings.countOut = cOut
                }
            ) { dir ->
                countIn.value  = detector?.countIn  ?: 0
                countOut.value = detector?.countOut ?: 0
                scope.launch { api.postEvent(settings.storeId, dir) }
                mainHandler.post { updateNotif() }
            }

            runCatching { api.saveRtspInfo(settings.storeId, settings.rtspUrl(), settings.sensitivity) }

            launch {
                for (jpeg in snapChannel) {
                    runCatching { api.uploadSnapshot(settings.storeId, jpeg) }
                }
            }

            launch {
                while (isActive) {
                    delay(60_000)
                    runCatching { api.getLineConfig(settings.storeId) }.getOrNull()
                        ?.let { detector?.updateLine(it) }
                }
            }

            mainHandler.post { startCapture() }
        }
    }

    // ── ExoPlayer + GL frame reader ──────────────────────────────────────────

    private fun startCapture() {
        releaseCapture()
        val url = settings.rtspUrl()
        if (url.isBlank()) {
            status.value = "URL de cámara vacía"
            return
        }

        firstFrame = true

        val reader = GlFrameReader { rgba, w, h ->
            onVideoFrame(rgba, w, h)
        }
        glReader = reader

        try {
            val exo = ExoPlayer.Builder(this).build()
            player = exo

            exo.setVideoSurface(reader.surface)

            val source = RtspMediaSource.Factory()
                .setForceUseRtpTcp(true)
                .createMediaSource(MediaItem.fromUri(Uri.parse(url)))
            exo.setMediaSource(source)

            exo.addListener(object : Player.Listener {
                override fun onVideoSizeChanged(size: androidx.media3.common.VideoSize) {
                    if (size.width > 0 && size.height > 0) {
                        reader.setVideoSize(size.width, size.height)
                    }
                }
                override fun onPlayerError(error: PlaybackException) {
                    if (!destroyed) {
                        status.value = "Error: ${error.message?.take(80)}"
                        mainHandler.post { updateNotif() }
                        scheduleRetry()
                    }
                }
                override fun onPlaybackStateChanged(state: Int) {
                    if (state == Player.STATE_ENDED && !destroyed) {
                        status.value = "Reconectando…"
                        mainHandler.post { updateNotif() }
                        scheduleRetry()
                    }
                }
            })

            exo.prepare()
            exo.playWhenReady = true
        } catch (e: Exception) {
            status.value = "Error: ${e.message}"
            if (!destroyed) scheduleRetry()
        }
    }

    private fun onVideoFrame(rgba: ByteBuffer, srcW: Int, srcH: Int) {
        if (destroyed) return

        val now = System.currentTimeMillis()
        if (now - lastFrameTime < FRAME_INTERVAL_MS) return
        lastFrameTime = now

        if (srcW <= 0 || srcH <= 0) return

        val luma = ByteArray(W * H)
        for (dy in 0 until H) {
            val sy = dy * srcH / H
            for (dx in 0 until W) {
                val sx = dx * srcW / W
                val off = (sy * srcW + sx) * 4
                if (off + 2 < rgba.capacity()) {
                    val r = rgba[off].toInt() and 0xFF
                    val g = rgba[off + 1].toInt() and 0xFF
                    val b = rgba[off + 2].toInt() and 0xFF
                    luma[dy * W + dx] = ((77 * r + 150 * g + 29 * b) shr 8).toByte()
                }
            }
        }
        detector?.process(luma)

        if (firstFrame) {
            firstFrame = false
            status.value = "Contando"
            mainHandler.post { updateNotif() }
        }

        if (now - lastSnapTime >= SNAP_INTERVAL_MS) {
            lastSnapTime = now
            val jpeg = snapFromRgba(rgba, srcW, srcH, 320, 240)
            if (jpeg != null) snapChannel.trySend(jpeg)
        }
    }

    private fun snapFromRgba(rgba: ByteBuffer, srcW: Int, srcH: Int, dW: Int, dH: Int): ByteArray? {
        return try {
            val pixels = IntArray(dW * dH)
            for (dy in 0 until dH) {
                val sy = dy * srcH / dH
                for (dx in 0 until dW) {
                    val sx = dx * srcW / dW
                    val off = (sy * srcW + sx) * 4
                    if (off + 2 < rgba.capacity()) {
                        val r = rgba[off].toInt() and 0xFF
                        val g = rgba[off + 1].toInt() and 0xFF
                        val b = rgba[off + 2].toInt() and 0xFF
                        pixels[dy * dW + dx] = (0xFF shl 24) or (r shl 16) or (g shl 8) or b
                    }
                }
            }
            val bmp = Bitmap.createBitmap(dW, dH, Bitmap.Config.ARGB_8888)
            bmp.setPixels(pixels, 0, dW, 0, 0, dW, dH)
            val jpeg = YuvUtils.jpegFromBitmap(bmp, 70)
            bmp.recycle()
            jpeg
        } catch (_: Exception) { null }
    }

    // ── Retry / Release ────────────────────────────────────────────────────────

    private fun scheduleRetry(delayMs: Long = 5_000) {
        if (destroyed) return
        retryRunnable?.let { mainHandler.removeCallbacks(it) }
        val r = Runnable { if (!destroyed) startCapture() }
        retryRunnable = r
        mainHandler.postDelayed(r, delayMs)
    }

    private fun releaseCapture() {
        retryRunnable?.let { mainHandler.removeCallbacks(it) }
        retryRunnable = null
        val p = player
        player = null
        if (p != null) {
            runCatching { p.stop() }
            runCatching { p.release() }
        }
        glReader?.release()
        glReader = null
    }

    // ── Notificación ───────────────────────────────────────────────────────────

    private fun createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val ch = NotificationChannel(
                CHANNEL_ID, "Contador de aforo", NotificationManager.IMPORTANCE_LOW
            )
            ch.description = "Mantiene el conteo activo en segundo plano"
            getSystemService(NotificationManager::class.java).createNotificationChannel(ch)
        }
    }

    private fun buildNotif(text: String): Notification {
        val open = android.app.PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java),
            android.app.PendingIntent.FLAG_IMMUTABLE or
                    android.app.PendingIntent.FLAG_UPDATE_CURRENT
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
        try {
            when {
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q -> {
                    val serviceType =
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE)
                            ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
                        else
                            ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
                    ServiceCompat.startForeground(this, NOTIF_ID, notif, serviceType)
                }
                else -> startForeground(NOTIF_ID, notif)
            }
        } catch (_: Throwable) {
            try { startForeground(NOTIF_ID, notif) } catch (_: Throwable) { stopSelf() }
        }
    }

    private fun acquireWakeLock() {
        val pm = getSystemService(POWER_SERVICE) as PowerManager
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "AforoBridge::counting")
            .apply { setReferenceCounted(false); acquire(12 * 60 * 60 * 1000L) }
    }
}

/**
 * Reads decoded video frames from ExoPlayer using SurfaceTexture + OpenGL ES.
 *
 * MediaCodec outputs to a GPU texture (OES). We render that texture to a small
 * offscreen FBO and read pixels with glReadPixels. This runs on its own GL thread
 * so the main thread stays free.
 */
private class GlFrameReader(
    private val onFrame: (rgba: ByteBuffer, width: Int, height: Int) -> Unit
) {
    private val glThread = HandlerThread("gl-reader").also { it.start() }
    private val glHandler = Handler(glThread.looper)

    private var eglDisplay: EGLDisplay = EGL14.EGL_NO_DISPLAY
    private var eglContext: EGLContext = EGL14.EGL_NO_CONTEXT
    private var eglSurface: EGLSurface = EGL14.EGL_NO_SURFACE
    private var oesTexId = 0
    private var program = 0
    private var fbo = 0
    private var fboTex = 0
    private var released = false

    @Volatile private var videoW = 0
    @Volatile private var videoH = 0

    private val stMatrix = FloatArray(16)

    val surfaceTexture: SurfaceTexture
    val surface: Surface

    fun setVideoSize(w: Int, h: Int) {
        videoW = w; videoH = h
    }

    init {
        val ready = java.util.concurrent.CountDownLatch(1)
        var stRef: SurfaceTexture? = null

        glHandler.post {
            initEgl()
            oesTexId = createOesTexture()
            stRef = SurfaceTexture(oesTexId)
            stRef!!.setOnFrameAvailableListener({ st ->
                glHandler.post { drawAndRead(st) }
            }, glHandler)
            ready.countDown()
        }
        ready.await()

        surfaceTexture = stRef!!
        surface = Surface(surfaceTexture)
    }

    fun release() {
        if (released) return
        released = true
        glHandler.post {
            runCatching { surface.release() }
            runCatching { surfaceTexture.release() }
            if (fbo != 0) { GLES20.glDeleteFramebuffers(1, intArrayOf(fbo), 0); fbo = 0 }
            if (fboTex != 0) { GLES20.glDeleteTextures(1, intArrayOf(fboTex), 0); fboTex = 0 }
            if (oesTexId != 0) { GLES20.glDeleteTextures(1, intArrayOf(oesTexId), 0); oesTexId = 0 }
            if (program != 0) { GLES20.glDeleteProgram(program); program = 0 }
            if (eglDisplay != EGL14.EGL_NO_DISPLAY) {
                EGL14.eglMakeCurrent(eglDisplay, EGL14.EGL_NO_SURFACE, EGL14.EGL_NO_SURFACE, EGL14.EGL_NO_CONTEXT)
                EGL14.eglDestroySurface(eglDisplay, eglSurface)
                EGL14.eglDestroyContext(eglDisplay, eglContext)
                EGL14.eglTerminate(eglDisplay)
            }
            glThread.quitSafely()
        }
    }

    // ── EGL ─────────────────────────────────────────────────────────────────

    private fun initEgl() {
        eglDisplay = EGL14.eglGetDisplay(EGL14.EGL_DEFAULT_DISPLAY)
        val ver = IntArray(2)
        EGL14.eglInitialize(eglDisplay, ver, 0, ver, 1)

        val attribs = intArrayOf(
            EGL14.EGL_RED_SIZE, 8, EGL14.EGL_GREEN_SIZE, 8,
            EGL14.EGL_BLUE_SIZE, 8, EGL14.EGL_ALPHA_SIZE, 8,
            EGL14.EGL_RENDERABLE_TYPE, EGL14.EGL_OPENGL_ES2_BIT,
            EGL14.EGL_SURFACE_TYPE, EGL14.EGL_PBUFFER_BIT,
            EGL14.EGL_NONE
        )
        val configs = arrayOfNulls<EGLConfig>(1)
        val numCfg = IntArray(1)
        EGL14.eglChooseConfig(eglDisplay, attribs, 0, configs, 0, 1, numCfg, 0)

        val ctxAttribs = intArrayOf(EGL14.EGL_CONTEXT_CLIENT_VERSION, 2, EGL14.EGL_NONE)
        eglContext = EGL14.eglCreateContext(eglDisplay, configs[0]!!, EGL14.EGL_NO_CONTEXT, ctxAttribs, 0)

        val pbAttribs = intArrayOf(EGL14.EGL_WIDTH, 1, EGL14.EGL_HEIGHT, 1, EGL14.EGL_NONE)
        eglSurface = EGL14.eglCreatePbufferSurface(eglDisplay, configs[0]!!, pbAttribs, 0)

        EGL14.eglMakeCurrent(eglDisplay, eglSurface, eglSurface, eglContext)
    }

    private fun createOesTexture(): Int {
        val tex = IntArray(1)
        GLES20.glGenTextures(1, tex, 0)
        GLES20.glBindTexture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, tex[0])
        GLES20.glTexParameteri(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR)
        GLES20.glTexParameteri(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR)
        GLES20.glTexParameteri(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_WRAP_S, GLES20.GL_CLAMP_TO_EDGE)
        GLES20.glTexParameteri(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_WRAP_T, GLES20.GL_CLAMP_TO_EDGE)
        return tex[0]
    }

    // ── FBO ─────────────────────────────────────────────────────────────────

    private fun ensureFbo(w: Int, h: Int) {
        if (videoW == w && videoH == h && fbo != 0) return
        videoW = w; videoH = h

        if (fbo != 0) GLES20.glDeleteFramebuffers(1, intArrayOf(fbo), 0)
        if (fboTex != 0) GLES20.glDeleteTextures(1, intArrayOf(fboTex), 0)

        val t = IntArray(1)
        GLES20.glGenTextures(1, t, 0)
        fboTex = t[0]
        GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, fboTex)
        GLES20.glTexImage2D(GLES20.GL_TEXTURE_2D, 0, GLES20.GL_RGBA, w, h, 0,
            GLES20.GL_RGBA, GLES20.GL_UNSIGNED_BYTE, null)
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR)
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR)

        val f = IntArray(1)
        GLES20.glGenFramebuffers(1, f, 0)
        fbo = f[0]
        GLES20.glBindFramebuffer(GLES20.GL_FRAMEBUFFER, fbo)
        GLES20.glFramebufferTexture2D(GLES20.GL_FRAMEBUFFER, GLES20.GL_COLOR_ATTACHMENT0,
            GLES20.GL_TEXTURE_2D, fboTex, 0)
        GLES20.glBindFramebuffer(GLES20.GL_FRAMEBUFFER, 0)

        if (program == 0) program = buildProgram()
    }

    // ── Draw + read ────────────────────────────────────────────────────────

    private fun drawAndRead(st: SurfaceTexture) {
        if (released) return
        st.updateTexImage()
        st.getTransformMatrix(stMatrix)

        val w = videoW
        val h = videoH
        if (w <= 0 || h <= 0) return

        ensureFbo(w, h)

        GLES20.glBindFramebuffer(GLES20.GL_FRAMEBUFFER, fbo)
        GLES20.glViewport(0, 0, w, h)
        GLES20.glUseProgram(program)

        val posLoc = GLES20.glGetAttribLocation(program, "aPos")
        val tcLoc  = GLES20.glGetAttribLocation(program, "aTC")
        val stLoc  = GLES20.glGetUniformLocation(program, "uST")
        val texLoc = GLES20.glGetUniformLocation(program, "uTex")

        GLES20.glActiveTexture(GLES20.GL_TEXTURE0)
        GLES20.glBindTexture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, oesTexId)
        GLES20.glUniform1i(texLoc, 0)
        GLES20.glUniformMatrix4fv(stLoc, 1, false, stMatrix, 0)

        GLES20.glEnableVertexAttribArray(posLoc)
        GLES20.glEnableVertexAttribArray(tcLoc)
        GLES20.glVertexAttribPointer(posLoc, 2, GLES20.GL_FLOAT, false, 0, QUAD_POS)
        GLES20.glVertexAttribPointer(tcLoc, 2, GLES20.GL_FLOAT, false, 0, QUAD_TC)
        GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, 4)
        GLES20.glDisableVertexAttribArray(posLoc)
        GLES20.glDisableVertexAttribArray(tcLoc)

        val buf = ByteBuffer.allocateDirect(w * h * 4).order(ByteOrder.nativeOrder())
        GLES20.glReadPixels(0, 0, w, h, GLES20.GL_RGBA, GLES20.GL_UNSIGNED_BYTE, buf)
        buf.rewind()

        GLES20.glBindFramebuffer(GLES20.GL_FRAMEBUFFER, 0)

        onFrame(buf, w, h)
    }

    // ── Shader ──────────────────────────────────────────────────────────────

    private fun buildProgram(): Int {
        val vs = compile(GLES20.GL_VERTEX_SHADER,
            "attribute vec2 aPos; attribute vec2 aTC; uniform mat4 uST;" +
            "varying vec2 vTC; void main(){ gl_Position=vec4(aPos,0.0,1.0); vTC=(uST*vec4(aTC,0.0,1.0)).xy; }")
        val fs = compile(GLES20.GL_FRAGMENT_SHADER,
            "#extension GL_OES_EGL_image_external : require\n" +
            "precision mediump float; varying vec2 vTC; uniform samplerExternalOES uTex;" +
            "void main(){ gl_FragColor=texture2D(uTex,vTC); }")
        val p = GLES20.glCreateProgram()
        GLES20.glAttachShader(p, vs)
        GLES20.glAttachShader(p, fs)
        GLES20.glLinkProgram(p)
        return p
    }

    private fun compile(type: Int, src: String): Int {
        val s = GLES20.glCreateShader(type)
        GLES20.glShaderSource(s, src)
        GLES20.glCompileShader(s)
        return s
    }

    companion object {
        private val QUAD_POS: FloatBuffer = floatBuf(
            -1f, 1f, 1f, 1f, -1f, -1f, 1f, -1f)
        private val QUAD_TC: FloatBuffer = floatBuf(
            0f, 0f, 1f, 0f, 0f, 1f, 1f, 1f)

        private fun floatBuf(vararg v: Float): FloatBuffer =
            ByteBuffer.allocateDirect(v.size * 4).order(ByteOrder.nativeOrder())
                .asFloatBuffer().apply { put(v); rewind() }
    }
}
