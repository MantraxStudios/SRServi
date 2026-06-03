package com.mantraxstudios.aforobridge

import android.graphics.ImageFormat
import android.graphics.Rect
import android.graphics.YuvImage
import android.media.Image
import java.io.ByteArrayOutputStream

/** Conversión de frames YUV_420_888 de la cámara a luminancia 80×60 y a JPEG. */
object YuvUtils {

    /** Rejilla de luminancia 80×60 (un byte por celda) muestreando el plano Y. */
    fun luminance80x60(image: Image): ByteArray {
        val y = image.planes[0]
        val buf = y.buffer
        val rowStride = y.rowStride
        val pixStride = y.pixelStride
        val w = image.width
        val h = image.height
        val out = ByteArray(MotionDetector.FRAME)
        for (gy in 0 until MotionDetector.H) {
            val sy = gy * h / MotionDetector.H
            val rowBase = sy * rowStride
            val dstRow = gy * MotionDetector.W
            for (gx in 0 until MotionDetector.W) {
                val sx = gx * w / MotionDetector.W
                out[dstRow + gx] = buf.get(rowBase + sx * pixStride)
            }
        }
        return out
    }

    /** Comprime el frame a JPEG (para la vista previa en la web). */
    fun toJpeg(image: Image, quality: Int = 70): ByteArray {
        val nv21 = toNv21(image)
        val yuv = YuvImage(nv21, ImageFormat.NV21, image.width, image.height, null)
        val baos = ByteArrayOutputStream()
        yuv.compressToJpeg(Rect(0, 0, image.width, image.height), quality, baos)
        return baos.toByteArray()
    }

    private fun toNv21(image: Image): ByteArray {
        val width = image.width
        val height = image.height
        val ySize = width * height
        val chromaW = width / 2
        val chromaH = height / 2
        val nv21 = ByteArray(ySize + 2 * chromaW * chromaH)

        val yBuffer = image.planes[0].buffer
        val yRowStride = image.planes[0].rowStride
        val yPixelStride = image.planes[0].pixelStride

        var pos = 0
        for (row in 0 until height) {
            if (yPixelStride == 1) {
                yBuffer.position(row * yRowStride)
                yBuffer.get(nv21, pos, width)
                pos += width
            } else {
                val base = row * yRowStride
                for (col in 0 until width) nv21[pos++] = yBuffer.get(base + col * yPixelStride)
            }
        }

        val uBuffer = image.planes[1].buffer
        val vBuffer = image.planes[2].buffer
        val uvRowStride = image.planes[1].rowStride
        val uvPixelStride = image.planes[1].pixelStride
        for (row in 0 until chromaH) {
            val base = row * uvRowStride
            for (col in 0 until chromaW) {
                val off = base + col * uvPixelStride
                nv21[pos++] = vBuffer.get(off) // V
                nv21[pos++] = uBuffer.get(off) // U
            }
        }
        return nv21
    }
}
