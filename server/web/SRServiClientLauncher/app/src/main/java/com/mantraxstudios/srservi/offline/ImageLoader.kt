package com.mantraxstudios.srservi.offline

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.LruCache
import android.widget.ImageView
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

/**
 * Cargador de imágenes ligero con caché en memoria (LruCache) + disco.
 * Evita añadir una dependencia como Glide/Coil. Las imágenes descargadas quedan
 * en `cacheDir/img/` para que en modo offline se sigan mostrando.
 */
object ImageLoader {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private val memoryCache: LruCache<String, Bitmap> by lazy {
        val maxKb = (Runtime.getRuntime().maxMemory() / 1024).toInt()
        object : LruCache<String, Bitmap>(maxKb / 8) {
            override fun sizeOf(key: String, value: Bitmap): Int = value.byteCount / 1024
        }
    }

    fun load(imageView: ImageView, url: String?, placeholderRes: Int) {
        imageView.setImageResource(placeholderRes)
        if (url.isNullOrBlank()) return

        val key = md5(url)
        memoryCache.get(key)?.let {
            imageView.setImageBitmap(it)
            return
        }

        // Marca la vista para evitar setear una imagen equivocada al reciclar en RecyclerView.
        imageView.tag = key

        scope.launch {
            val bmp = loadFromDiskOrNetwork(imageView, url, key)
            if (bmp != null) {
                withContext(Dispatchers.Main) {
                    if (imageView.tag == key) imageView.setImageBitmap(bmp)
                }
            }
        }
    }

    private fun loadFromDiskOrNetwork(imageView: ImageView, url: String, key: String): Bitmap? {
        val cacheDir = File(imageView.context.cacheDir, "img").apply { if (!exists()) mkdirs() }
        val diskFile = File(cacheDir, key)

        // 1) Disco
        if (diskFile.exists()) {
            decode(diskFile)?.let {
                memoryCache.put(key, it)
                return it
            }
        }

        // 2) Red → guardar en disco
        var conn: HttpURLConnection? = null
        return try {
            conn = URL(url).openConnection() as HttpURLConnection
            conn.connectTimeout = 10000
            conn.readTimeout = 15000
            if (conn.responseCode != HttpURLConnection.HTTP_OK) return null
            conn.inputStream.use { input ->
                diskFile.outputStream().use { output -> input.copyTo(output) }
            }
            decode(diskFile)?.also { memoryCache.put(key, it) }
        } catch (_: Exception) {
            null
        } finally {
            conn?.disconnect()
        }
    }

    private fun decode(file: File): Bitmap? = try {
        // Sub-muestreo para no cargar imágenes gigantes en las celdas de la grilla.
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(file.absolutePath, bounds)
        val opts = BitmapFactory.Options().apply {
            inSampleSize = calcInSampleSize(bounds, 400, 400)
        }
        BitmapFactory.decodeFile(file.absolutePath, opts)
    } catch (_: Exception) { null }

    private fun calcInSampleSize(o: BitmapFactory.Options, reqW: Int, reqH: Int): Int {
        val (h, w) = o.outHeight to o.outWidth
        var sample = 1
        if (h > reqH || w > reqW) {
            val halfH = h / 2
            val halfW = w / 2
            while (halfH / sample >= reqH && halfW / sample >= reqW) sample *= 2
        }
        return sample
    }

    private fun md5(s: String): String = try {
        val md = MessageDigest.getInstance("MD5")
        md.digest(s.toByteArray()).joinToString("") { "%02x".format(it) }
    } catch (_: Exception) {
        s.hashCode().toString()
    }
}
