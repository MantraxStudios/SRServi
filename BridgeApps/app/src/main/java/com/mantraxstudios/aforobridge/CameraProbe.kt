package com.mantraxstudios.aforobridge

import android.content.Context
import android.net.Uri
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.rtsp.RtspMediaSource
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import kotlin.coroutines.resume

object CameraProbe {

    private val COMMON_CHANNELS = listOf(
        "stream1", "stream2", "h264Preview_01_main", "Streaming/Channels/101",
        "cam/realmonitor?channel=1&subtype=0", "live", "live/ch0", "11", "video1", "1"
    )

    data class Result(val ok: Boolean, val channel: String?, val message: String)

    suspend fun autoDetect(context: Context, s: Settings, preferred: String?): Result {
        if (s.camIp.isBlank()) return Result(false, null, "Primero elige la IP de la cámara.")
        val list = LinkedHashSet<String>()
        if (!preferred.isNullOrBlank()) list.add(preferred)
        list.addAll(COMMON_CHANNELS)
        for (ch in list) {
            val (ok, authError) = testUrl(context, s.rtspUrl(ch))
            if (ok) return Result(true, ch, "✓ ¡Cámara conectada correctamente!")
            if (authError) return Result(false, null, "Usuario o contraseña de la cámara incorrectos.")
        }
        return Result(false, null, "No pude conectar. Revisa la IP, el usuario y la contraseña.")
    }

    @Suppress("UnsafeOptInUsageError")
    private suspend fun testUrl(context: Context, url: String): Pair<Boolean, Boolean> =
        withContext(Dispatchers.Main) {
            var player: ExoPlayer? = null
            try {
                player = ExoPlayer.Builder(context).build()

                val source = RtspMediaSource.Factory()
                    .setForceUseRtpTcp(true)
                    .createMediaSource(MediaItem.fromUri(Uri.parse(url)))
                player.setMediaSource(source)

                withTimeout(12_000) {
                    suspendCancellableCoroutine { cont ->
                        player.addListener(object : Player.Listener {
                            override fun onPlaybackStateChanged(state: Int) {
                                if (state == Player.STATE_READY && cont.isActive) {
                                    cont.resume(true to false)
                                }
                            }
                            override fun onPlayerError(error: PlaybackException) {
                                if (cont.isActive) {
                                    val msg = error.message ?: ""
                                    val isAuth = msg.contains("401") || msg.contains("nauthorized", true)
                                    cont.resume(false to isAuth)
                                }
                            }
                        })
                        player.prepare()
                    }
                }
            } catch (_: Exception) {
                false to false
            } finally {
                runCatching { player?.release() }
            }
        }
}
