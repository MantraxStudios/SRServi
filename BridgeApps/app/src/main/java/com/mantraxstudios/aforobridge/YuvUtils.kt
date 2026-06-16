package com.mantraxstudios.aforobridge

import android.graphics.Bitmap
import android.graphics.Color
import java.io.ByteArrayOutputStream

object YuvUtils {

    /**
     * Extrae luminancia 80×60 de un Bitmap (output de LibVLC getThumbnail).
     * Escala el Bitmap a 80×60 y extrae el canal Y (luminancia).
     */
    fun luminanceFromBitmap(src: Bitmap, srcW: Int, srcH: Int): ByteArray {
        val out = ByteArray(MotionDetector.FRAME)
        try {
            // Escalar a 80×60 para el detector
            val scaled = if (src.width == MotionDetector.W && src.height == MotionDetector.H) {
                src
            } else {
                Bitmap.createScaledBitmap(src, MotionDetector.W, MotionDetector.H, false)
            }
            val pixels = IntArray(MotionDetector.W * MotionDetector.H)
            scaled.getPixels(pixels, 0, MotionDetector.W, 0, 0, MotionDetector.W, MotionDetector.H)
            for (i in pixels.indices) {
                val px = pixels[i]
                // Fórmula estándar BT.601: Y = 0.299R + 0.587G + 0.114B
                val r = Color.red(px)
                val g = Color.green(px)
                val b = Color.blue(px)
                out[i] = ((77 * r + 150 * g + 29 * b) shr 8).toByte()
            }
            if (scaled !== src) scaled.recycle()
        } catch (_: Throwable) {}
        return out
    }

    /**
     * Comprime un Bitmap a JPEG para subir como snapshot.
     */
    fun jpegFromBitmap(bmp: Bitmap, quality: Int = 70): ByteArray {
        return try {
            val baos = ByteArrayOutputStream()
            bmp.compress(Bitmap.CompressFormat.JPEG, quality, baos)
            baos.toByteArray()
        } catch (_: Throwable) {
            ByteArray(0)
        }
    }
}
