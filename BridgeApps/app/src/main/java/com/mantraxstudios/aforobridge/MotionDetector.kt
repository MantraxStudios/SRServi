package com.mantraxstudios.aforobridge

import kotlin.math.abs
import kotlin.math.hypot
import kotlin.math.sign

/**
 * Detección de aforo por movimiento. Mismo algoritmo que el panel web, el servidor y
 * AforoBridge Windows, adaptado a una rejilla de luminancia 80×60:
 *   diff de luminancia → blobs → tracking → cruce de línea con cooldown.
 *
 * Alimenta con frames de luminancia 80×60 (un byte por celda) vía [process].
 */
class MotionDetector(
    var sensitivity: Int = 30,
    var x1: Double = 0.15, var y1: Double = 0.5,
    var x2: Double = 0.85, var y2: Double = 0.5,
    var flip: Boolean = false,
    private val onCross: (String) -> Unit
) {
    companion object {
        const val W = 80
        const val H = 60
        const val FRAME = W * H
        private const val MIN_BLOB = 12
        private const val MAX_DIST = 0.18
        private const val COOLDOWN_MS = 2500L
    }

    private class Track(var cx: Double, var cy: Double, var missed: Int = 0, var lastCross: Long = 0)

    private val tracks = ArrayList<Track>()
    private var prev: ByteArray? = null

    var countIn = 0; private set
    var countOut = 0; private set

    fun resetCounts() { countIn = 0; countOut = 0 }

    fun updateLine(c: LineConfig) {
        x1 = c.x1; y1 = c.y1; x2 = c.x2; y2 = c.y2; flip = c.flip
    }

    /** Procesa un frame de luminancia 80×60. */
    fun process(curr: ByteArray) {
        val p = prev
        if (p == null) { prev = curr.copyOf(); return }
        val blobs = detectBlobs(p, curr, sensitivity)
        updateTracks(blobs)
        System.arraycopy(curr, 0, p, 0, FRAME)
    }

    private fun detectBlobs(prev: ByteArray, curr: ByteArray, threshold: Int): List<DoubleArray> {
        val motion = ByteArray(FRAME)
        for (i in 0 until FRAME) {
            val d = abs((curr[i].toInt() and 0xff) - (prev[i].toInt() and 0xff))
            if (d > threshold) motion[i] = 1
        }
        // Dilatación 1px
        val dil = ByteArray(FRAME)
        for (y in 1 until H - 1) {
            for (x in 1 until W - 1) {
                val i = y * W + x
                if (motion[i].toInt() == 1 || motion[i - 1].toInt() == 1 || motion[i + 1].toInt() == 1 ||
                    motion[i - W].toInt() == 1 || motion[i + W].toInt() == 1
                ) dil[i] = 1
            }
        }
        // Componentes conexas (BFS)
        val labels = IntArray(FRAME) { -1 }
        val blobs = ArrayList<DoubleArray>()
        val queue = ArrayDeque<Int>()
        var nl = 0
        for (y in 0 until H) {
            for (x in 0 until W) {
                val idx = y * W + x
                if (dil[idx].toInt() == 0 || labels[idx] >= 0) continue
                queue.clear(); queue.addLast(idx); labels[idx] = nl
                var cnt = 0; var sx = 0L; var sy = 0L
                while (queue.isNotEmpty()) {
                    val c = queue.removeFirst()
                    cnt++; sx += (c % W).toLong(); sy += (c / W).toLong()
                    val ns = intArrayOf(c - 1, c + 1, c - W, c + W)
                    for (n in ns) if (n in 0 until FRAME && dil[n].toInt() == 1 && labels[n] < 0) {
                        labels[n] = nl; queue.addLast(n)
                    }
                }
                if (cnt >= MIN_BLOB) blobs.add(doubleArrayOf(sx.toDouble() / cnt / W, sy.toDouble() / cnt / H))
                nl++
            }
        }
        return blobs
    }

    private fun getSide(px: Double, py: Double): Double =
        (x2 - x1) * (py - y1) - (y2 - y1) * (px - x1)

    private fun updateTracks(blobs: List<DoubleArray>) {
        val used = HashSet<Int>()
        for (t in tracks) {
            var best = -1; var bd = Double.POSITIVE_INFINITY
            for (i in blobs.indices) {
                if (used.contains(i)) continue
                val d = hypot(blobs[i][0] - t.cx, blobs[i][1] - t.cy)
                if (d < bd) { bd = d; best = i }
            }
            if (best >= 0 && bd < MAX_DIST) {
                val b = blobs[best]; used.add(best)
                val ps = getSide(t.cx, t.cy); val cs = getSide(b[0], b[1])
                if (ps != 0.0 && cs != 0.0 && sign(ps) != sign(cs)) {
                    val now = System.currentTimeMillis()
                    if (t.lastCross == 0L || now - t.lastCross > COOLDOWN_MS) {
                        t.lastCross = now
                        var dir = if (cs < 0) "in" else "out"
                        if (flip) dir = if (dir == "in") "out" else "in"
                        if (dir == "in") countIn++ else countOut++
                        onCross(dir)
                    }
                }
                t.cx = b[0]; t.cy = b[1]; t.missed = 0
            } else t.missed++
        }
        for (i in blobs.indices) if (!used.contains(i))
            tracks.add(Track(blobs[i][0], blobs[i][1]))
        tracks.removeAll { it.missed >= 5 }
    }
}
