package com.mantraxstudios.aforobridge

import android.content.Context
import android.graphics.ImageFormat
import android.media.ImageReader
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.rtsp.RtspMediaSource
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout

/** Prueba la cámara con ExoPlayer y autodetecta el canal de video correcto. */
@androidx.annotation.OptIn(androidx.media3.common.util.UnstableApi::class)
object CameraProbe {

    private val COMMON_CHANNELS = listOf(
        "stream1", "stream2", "h264Preview_01_main", "Streaming/Channels/101",
        "cam/realmonitor?channel=1&subtype=0", "live", "live/ch0", "11", "video1", "1"
    )

    data class Result(val ok: Boolean, val channel: String?, val message: String)

    /**
     * Prueba los canales más comunes hasta encontrar uno que conecte.
     * Devuelve el canal que funcionó (para guardarlo sin que el usuario lo sepa).
     */
    suspend fun autoDetect(context: Context, s: Settings, preferred: String?): Result {
        if (s.camIp.isBlank()) return Result(false, null, "Primero elige la IP de la cámara.")

        val list = LinkedHashSet<String>()
        if (!preferred.isNullOrBlank()) list.add(preferred)
        list.addAll(COMMON_CHANNELS)

        for (ch in list) {
            val url = s.rtspUrl(ch)
            val (ok, auth) = testUrl(context, url)
            if (ok) return Result(true, ch, "✓ ¡Cámara conectada correctamente!")
            if (auth) return Result(false, null, "Usuario o contraseña de la cámara incorrectos.")
        }
        return Result(false, null, "No pude conectar. Revisa la IP, el usuario y la contraseña de la cámara.")
    }

    /** @return (conectó, fueErrorDeCredenciales) */
    private suspend fun testUrl(context: Context, url: String): Pair<Boolean, Boolean> =
        withContext(Dispatchers.Main) {
            val reader = ImageReader.newInstance(64, 48, ImageFormat.YUV_420_888, 2)
            val deferred = CompletableDeferred<Pair<Boolean, Boolean>>()
            val player = ExoPlayer.Builder(context).build()
            val listener = object : Player.Listener {
                override fun onPlaybackStateChanged(state: Int) {
                    if (state == Player.STATE_READY && !deferred.isCompleted)
                        deferred.complete(true to false)
                }
                override fun onPlayerError(error: PlaybackException) {
                    if (!deferred.isCompleted) {
                        val msg = (error.message ?: "").lowercase()
                        val auth = msg.contains("401") || msg.contains("unauthorized")
                        deferred.complete(false to auth)
                    }
                }
            }
            try {
                player.addListener(listener)
                player.setVideoSurface(reader.surface)
                player.volume = 0f
                val src = RtspMediaSource.Factory()
                    .setForceUseRtpTcp(true)
                    .setTimeoutMs(8000)
                    .createMediaSource(MediaItem.fromUri(url))
                player.setMediaSource(src)
                player.prepare()
                player.playWhenReady = true
                withTimeout(10000) { deferred.await() }
            } catch (_: TimeoutCancellationException) {
                false to false
            } catch (_: Exception) {
                false to false
            } finally {
                runCatching { player.release() }
                runCatching { reader.close() }
            }
        }
}
