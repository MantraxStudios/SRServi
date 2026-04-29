package com.mantraxstudios.srservituuorders

import android.content.Context
import android.graphics.*
import android.util.Log

import com.pos.sdk.printer.POIPrinterManager
import com.pos.sdk.printer.models.BitmapPrintLine

object PrintHelper {

    private const val TAG = "PrintHelper"
    private const val BITMAP_WIDTH = 576

    fun print(context: Context, orderNumber: String, date: String) {
        val bitmap = buildBitmap(orderNumber, date)
        val manager = POIPrinterManager(context)
        try {
            manager.open()
            manager.addBlankView(1)
            manager.addPrintLine(BitmapPrintLine(bitmap))
            manager.addBlankView(5)
            manager.beginPrint(object : POIPrinterManager.IPrinterListener {
                override fun onStart() {}
                override fun onFinish() {
                    manager.cleanCache()
                    Log.d(TAG, "Printed OK: $orderNumber")
                }
                override fun onError(code: Int, msg: String) {
                    Log.e(TAG, "Print error $code: $msg")
                    manager.cleanCache()
                }
            })
        } catch (e: Exception) {
            Log.e(TAG, "Printer exception", e)
        }
    }

    private fun buildBitmap(orderNumber: String, date: String): Bitmap {
        val w = BITMAP_WIDTH
        val h = 460
        val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bmp)
        canvas.drawColor(Color.WHITE)

        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.BLACK
            textAlign = Paint.Align.CENTER
        }

        // Tiny header
        paint.textSize = 22f
        paint.isFakeBoldText = false
        canvas.drawText("Auto Servicio Creado Por SRautomatic CL", w / 2f, 28f, paint)

        // Top separator
        paint.strokeWidth = 2f
        paint.style = Paint.Style.STROKE
        canvas.drawLine(24f, 42f, (w - 24).toFloat(), 42f, paint)
        paint.style = Paint.Style.FILL

        // Date
        paint.textSize = 38f
        canvas.drawText(date, w / 2f, 90f, paint)

        // Mid separator
        paint.strokeWidth = 3f
        paint.style = Paint.Style.STROKE
        canvas.drawLine(24f, 106f, (w - 24).toFloat(), 106f, paint)
        paint.style = Paint.Style.FILL

        // Order number — very large, auto-scale if needed
        paint.textSize = 160f
        paint.isFakeBoldText = true
        val textWidth = paint.measureText(orderNumber)
        if (textWidth > w - 32f) {
            paint.textSize *= (w - 32f) / textWidth
        }
        val fm = paint.fontMetrics
        val centerY = 106f + (310f - 106f) / 2f
        val baseline = centerY - (fm.ascent + fm.descent) / 2f
        canvas.drawText(orderNumber, w / 2f, baseline, paint)

        // Bottom separator
        paint.strokeWidth = 2f
        paint.style = Paint.Style.STROKE
        canvas.drawLine(24f, 318f, (w - 24).toFloat(), 318f, paint)
        paint.style = Paint.Style.FILL

        // Footer message
        paint.textSize = 38f
        paint.isFakeBoldText = true
        canvas.drawText("Por favor acérquese a caja", w / 2f, 366f, paint)
        canvas.drawText("y pague con efectivo justo", w / 2f, 414f, paint)

        return bmp
    }
}
