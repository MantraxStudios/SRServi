package com.mantraxstudios.aforobridge

/**
 * RtspSourceFactory — STUB vacío.
 *
 * Este archivo existía cuando el proyecto usaba ExoPlayer/Media3 para RTSP.
 * Fue reemplazado por LibVLC (CountingService) porque ExoPlayer crasheaba con
 * streams RTSP reales (autenticación Digest, H.264 no-estándar, etc).
 *
 * Se mantiene el archivo para no romper referencias en otros lugares del código,
 * pero ya no hace nada. Si ningún otro archivo lo referencia, puedes eliminarlo.
 */
object RtspSourceFactory