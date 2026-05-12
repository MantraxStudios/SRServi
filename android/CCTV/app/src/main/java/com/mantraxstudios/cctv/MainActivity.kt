package com.mantraxstudios.cctv

import android.app.admin.DevicePolicyManager
import android.content.Context
import android.content.SharedPreferences
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.view.KeyEvent
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.addCallback
import androidx.activity.compose.setContent
import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.annotation.OptIn
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import kotlinx.coroutines.*
import org.json.JSONObject
import java.io.*
import java.net.HttpURLConnection
import java.net.URL

private val Gold = Color(0xFFD4AF37)
private val DarkBg = Color(0xFF0A0A0A)
private val CardBg = Color(0xFF141414)

private const val BASE_URL = "https://srservi2.srautomatic.com"
private const val PREFS_NAME = "cctv_signage"
private const val KEY_TOKEN = "device_token"
private const val KEY_VIDEO_PATH = "current_video_path"
private const val KEY_VIDEO_URL = "current_video_url"
private const val TAG = "CCTVSignage"

class MainActivity : ComponentActivity() {

    private var kioskActive = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        // Bloquear el botón back — kiosk mode
        onBackPressedDispatcher.addCallback(this) { /* no-op */ }

        KioskService.start(this)

        setContent {
            val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            var screen by remember { mutableStateOf("splash") }

            when (screen) {
                "splash" -> SplashScreen(onFinish = {
                    screen = if (prefs.getString(KEY_TOKEN, null) != null) "player" else "pair"
                })
                "pair" -> PairingScreen(onPaired = { token ->
                    prefs.edit().putString(KEY_TOKEN, token).apply()
                    screen = "player"
                })
                "player" -> PlayerScreen(prefs = prefs)
            }
        }
    }

    override fun onResume() {
        super.onResume()
        setupLockTask()
    }

    // Bloquear también teclas de hardware (menú, home en algunos dispositivos)
    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        return when (keyCode) {
            KeyEvent.KEYCODE_HOME,
            KeyEvent.KEYCODE_MENU,
            KeyEvent.KEYCODE_APP_SWITCH -> true  // bloquear
            else -> super.onKeyDown(keyCode, event)
        }
    }

    private fun setupLockTask() {
        val dpm = getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        val adminComp = com.mantraxstudios.cctv.admin.CCTVDeviceAdminReceiver.getComponentName(this)
        if (dpm.isDeviceOwnerApp(packageName)) {
            dpm.setLockTaskPackages(adminComp, arrayOf(packageName))
            if (!kioskActive) {
                window.decorView.post {
                    try { startLockTask(); kioskActive = true } catch (_: Exception) {}
                }
            }
        }
        // Sin Device Owner: el modo kiosk se logra con HOME launcher + back bloqueado
        // + KioskService.onTaskRemoved que relanza la app si la cierran
    }
}

// ─── Splash ─────────────────────────────────────────────────────────────────

@Composable
fun SplashScreen(onFinish: () -> Unit) {
    var titleVisible by remember { mutableStateOf(false) }
    var subtitleVisible by remember { mutableStateOf(false) }
    var poweredVisible by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        delay(400)
        titleVisible = true
        delay(700)
        subtitleVisible = true
        delay(500)
        poweredVisible = true
        delay(2000)
        onFinish()
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(DarkBg),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            AnimatedVisibility(
                visible = titleVisible,
                enter = fadeIn(tween(700)) + scaleIn(tween(700, easing = FastOutSlowInEasing), initialScale = 0.75f)
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(
                        modifier = Modifier
                            .size(88.dp)
                            .background(Gold, RoundedCornerShape(20.dp)),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            "SR",
                            color = DarkBg,
                            fontSize = 32.sp,
                            fontWeight = FontWeight.Black,
                            letterSpacing = 2.sp
                        )
                    }
                    Spacer(Modifier.height(28.dp))
                    Text(
                        "Cartelería Digital",
                        color = Color.White,
                        fontSize = 38.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 1.sp
                    )
                }
            }

            Spacer(Modifier.height(12.dp))

            AnimatedVisibility(
                visible = subtitleVisible,
                enter = fadeIn(tween(600)) + slideInVertically(tween(600, easing = FastOutSlowInEasing)) { it }
            ) {
                Box(
                    modifier = Modifier
                        .background(Gold.copy(alpha = 0.12f), RoundedCornerShape(8.dp))
                        .padding(horizontal = 20.dp, vertical = 6.dp)
                ) {
                    Text(
                        "Señalización Digital Profesional",
                        color = Gold,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Medium,
                        letterSpacing = 0.5.sp
                    )
                }
            }

            Spacer(Modifier.height(48.dp))

            AnimatedVisibility(
                visible = poweredVisible,
                enter = fadeIn(tween(800))
            ) {
                Text(
                    "Powered By SRAutomatic.cl",
                    color = Color.White.copy(alpha = 0.28f),
                    fontSize = 13.sp,
                    fontStyle = FontStyle.Italic
                )
            }
        }
    }
}

// ─── Pairing ─────────────────────────────────────────────────────────────────

@Composable
fun PairingScreen(onPaired: (String) -> Unit) {
    var code by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(false) }
    var errorMsg by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(DarkBg),
        contentAlignment = Alignment.Center
    ) {
        Card(
            modifier = Modifier
                .width(380.dp)
                .padding(16.dp),
            shape = RoundedCornerShape(24.dp),
            colors = CardDefaults.cardColors(containerColor = CardBg),
            border = BorderStroke(1.dp, Gold.copy(alpha = 0.25f)),
            elevation = CardDefaults.cardElevation(8.dp)
        ) {
            Column(
                modifier = Modifier.padding(horizontal = 36.dp, vertical = 40.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Box(
                    modifier = Modifier
                        .size(68.dp)
                        .background(Gold, RoundedCornerShape(16.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    Text("SR", color = DarkBg, fontSize = 26.sp, fontWeight = FontWeight.Black)
                }

                Spacer(Modifier.height(20.dp))

                Text(
                    "Cartelería Digital",
                    color = Color.White,
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center
                )
                Text(
                    "Powered By SRAutomatic.cl",
                    color = Gold,
                    fontSize = 13.sp,
                    textAlign = TextAlign.Center
                )

                Spacer(Modifier.height(32.dp))

                Text(
                    "Código de emparejamiento",
                    color = Color.White.copy(alpha = 0.55f),
                    fontSize = 13.sp,
                    textAlign = TextAlign.Center
                )
                Spacer(Modifier.height(12.dp))

                OutlinedTextField(
                    value = code,
                    onValueChange = { v -> code = v.uppercase().filter { it.isLetterOrDigit() }.take(8); errorMsg = "" },
                    placeholder = { Text("Ej: ABC123", color = Color.White.copy(0.3f), textAlign = TextAlign.Center) },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Characters),
                    textStyle = androidx.compose.ui.text.TextStyle(
                        color = Color.White,
                        fontSize = 22.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 6.sp,
                        textAlign = TextAlign.Center
                    ),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Gold,
                        unfocusedBorderColor = Color.White.copy(0.18f),
                        cursorColor = Gold,
                        focusedContainerColor = Color.White.copy(0.04f),
                        unfocusedContainerColor = Color.White.copy(0.03f)
                    ),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                )

                if (errorMsg.isNotEmpty()) {
                    Spacer(Modifier.height(8.dp))
                    Text(errorMsg, color = Color(0xFFEF4444), fontSize = 13.sp, textAlign = TextAlign.Center)
                }

                Spacer(Modifier.height(20.dp))

                Button(
                    onClick = {
                        if (code.isBlank()) { errorMsg = "Ingresa el código"; return@Button }
                        scope.launch {
                            loading = true
                            try {
                                val token = pairDevice(code.trim())
                                onPaired(token)
                            } catch (e: Exception) {
                                errorMsg = e.message ?: "Error al emparejar"
                            } finally {
                                loading = false
                            }
                        }
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp),
                    enabled = !loading,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Gold,
                        disabledContainerColor = Gold.copy(alpha = 0.5f)
                    ),
                    shape = RoundedCornerShape(14.dp)
                ) {
                    if (loading) {
                        CircularProgressIndicator(
                            color = DarkBg,
                            modifier = Modifier.size(22.dp),
                            strokeWidth = 2.5.dp
                        )
                    } else {
                        Text("Emparejar Pantalla", color = DarkBg, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                    }
                }
            }
        }
    }
}

// ─── Player ──────────────────────────────────────────────────────────────────

@OptIn(UnstableApi::class)
@Composable
fun PlayerScreen(prefs: SharedPreferences) {
    val context = LocalContext.current
    var downloadProgress by remember { mutableFloatStateOf(-1f) }
    var downloadingName by remember { mutableStateOf("") }

    val exoPlayer = remember {
        ExoPlayer.Builder(context).build().apply {
            repeatMode = Player.REPEAT_MODE_ONE
            playWhenReady = true
            volume = 0f
        }
    }

    // Load cached video on startup
    LaunchedEffect(Unit) {
        val savedPath = prefs.getString(KEY_VIDEO_PATH, null)
        if (savedPath != null) {
            val file = File(savedPath)
            if (file.exists()) {
                exoPlayer.setMediaItem(MediaItem.fromUri(Uri.fromFile(file)))
                exoPlayer.prepare()
            }
        }
    }

    // Poll server every 30s for config changes
    val deviceToken = remember { prefs.getString(KEY_TOKEN, "") ?: "" }
    LaunchedEffect(deviceToken) {
        while (true) {
            try {
                val config = fetchDeviceConfig(deviceToken)
                val videoUrl = config.optString("video_url").takeIf { it.isNotEmpty() }
                val savedUrl = prefs.getString(KEY_VIDEO_URL, null)

                if (videoUrl != null && videoUrl != savedUrl) {
                    val fullUrl = if (videoUrl.startsWith("http")) videoUrl else "$BASE_URL$videoUrl"
                    val filename = Uri.parse(videoUrl).lastPathSegment ?: "video.mp4"
                    val destFile = File(context.filesDir, filename)

                    if (!destFile.exists()) {
                        downloadingName = config.optString("video_name", filename)
                        downloadProgress = 0f

                        var success = false
                        withContext(Dispatchers.IO) {
                            try {
                                downloadVideoFile(fullUrl, destFile) { p ->
                                    downloadProgress = p
                                }
                                success = true
                            } catch (e: Exception) {
                                Log.e(TAG, "Download error: ${e.message}")
                                destFile.delete()
                            }
                        }

                        if (success) {
                            val oldPath = prefs.getString(KEY_VIDEO_PATH, null)
                            prefs.edit()
                                .putString(KEY_VIDEO_PATH, destFile.absolutePath)
                                .putString(KEY_VIDEO_URL, videoUrl)
                                .apply()

                            exoPlayer.setMediaItem(MediaItem.fromUri(Uri.fromFile(destFile)))
                            exoPlayer.prepare()

                            // Delete old cached file if different
                            if (oldPath != null && oldPath != destFile.absolutePath) {
                                File(oldPath).delete()
                            }
                        }
                    } else {
                        // File already downloaded, just update URL reference
                        prefs.edit().putString(KEY_VIDEO_URL, videoUrl).apply()
                        val currentPath = prefs.getString(KEY_VIDEO_PATH, null)
                        if (currentPath != destFile.absolutePath) {
                            prefs.edit().putString(KEY_VIDEO_PATH, destFile.absolutePath).apply()
                            exoPlayer.setMediaItem(MediaItem.fromUri(Uri.fromFile(destFile)))
                            exoPlayer.prepare()
                        }
                    }
                    downloadProgress = -1f
                }
            } catch (e: Exception) {
                Log.e(TAG, "Poll error: ${e.message}")
            }
            delay(30_000)
        }
    }

    DisposableEffect(Unit) {
        onDispose { exoPlayer.release() }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
    ) {
        AndroidView(
            factory = { ctx ->
                PlayerView(ctx).apply {
                    player = exoPlayer
                    useController = false
                    resizeMode = AspectRatioFrameLayout.RESIZE_MODE_ZOOM
                }
            },
            modifier = Modifier.fillMaxSize()
        )

        // Download progress overlay
        AnimatedVisibility(
            visible = downloadProgress >= 0f,
            enter = fadeIn(tween(300)),
            exit = fadeOut(tween(500)),
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color.Black.copy(alpha = 0.6f))
                    .padding(horizontal = 40.dp, vertical = 20.dp)
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.Center,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            "Descargando",
                            color = Color.White.copy(alpha = 0.7f),
                            fontSize = 13.sp
                        )
                        if (downloadingName.isNotEmpty()) {
                            Text(
                                " · $downloadingName",
                                color = Gold,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                        Text(
                            " · ${(downloadProgress * 100).toInt()}%",
                            color = Color.White.copy(alpha = 0.7f),
                            fontSize = 13.sp
                        )
                    }
                    Spacer(Modifier.height(8.dp))
                    LinearProgressIndicator(
                        progress = { downloadProgress.coerceIn(0f, 1f) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(4.dp),
                        color = Gold,
                        trackColor = Color.White.copy(alpha = 0.15f)
                    )
                    Spacer(Modifier.height(4.dp))
                    Text(
                        "El video actual seguirá reproduciéndose hasta que termine la descarga",
                        color = Color.White.copy(alpha = 0.35f),
                        fontSize = 11.sp,
                        textAlign = TextAlign.Center
                    )
                }
            }
        }

        // Watermark
        Text(
            "Powered By SRAutomatic.cl",
            color = Color.White.copy(alpha = 0.12f),
            fontSize = 11.sp,
            modifier = Modifier
                .align(Alignment.TopEnd)
                .padding(12.dp)
        )
    }
}

// ─── API Helpers ─────────────────────────────────────────────────────────────

private suspend fun pairDevice(code: String): String = withContext(Dispatchers.IO) {
    val url = URL("$BASE_URL/api/cctv/pair")
    val conn = url.openConnection() as HttpURLConnection
    conn.requestMethod = "POST"
    conn.setRequestProperty("Content-Type", "application/json")
    conn.doOutput = true
    conn.connectTimeout = 15_000
    conn.readTimeout = 15_000
    val body = """{"pairing_code":"$code","device_name":"TV Cartelería"}"""
    conn.outputStream.use { it.write(body.toByteArray()) }
    val responseCode = conn.responseCode
    val response = if (responseCode == 200)
        conn.inputStream.bufferedReader().readText()
    else
        conn.errorStream?.bufferedReader()?.readText() ?: ""
    conn.disconnect()
    if (responseCode != 200) {
        val json = runCatching { JSONObject(response) }.getOrNull()
        throw Exception(json?.optString("error") ?: "Código inválido o expirado")
    }
    JSONObject(response).getString("device_token")
}

private suspend fun fetchDeviceConfig(deviceToken: String): JSONObject = withContext(Dispatchers.IO) {
    val url = URL("$BASE_URL/api/cctv/device-config?device_token=$deviceToken")
    val conn = url.openConnection() as HttpURLConnection
    conn.requestMethod = "GET"
    conn.connectTimeout = 15_000
    conn.readTimeout = 15_000
    val code = conn.responseCode
    val response = if (code == 200) conn.inputStream.bufferedReader().readText() else "{}"
    conn.disconnect()
    JSONObject(response)
}

private fun downloadVideoFile(urlStr: String, destFile: File, onProgress: (Float) -> Unit) {
    val url = URL(urlStr)
    val conn = url.openConnection() as HttpURLConnection
    conn.connectTimeout = 30_000
    conn.readTimeout = 120_000
    conn.connect()
    val totalBytes = conn.contentLengthLong

    // Temp file to avoid serving partial downloads
    val tempFile = File(destFile.parent, "${destFile.name}.tmp")
    try {
        val input = BufferedInputStream(conn.inputStream, 65536)
        val output = FileOutputStream(tempFile)
        val buffer = ByteArray(65536)
        var downloaded = 0L
        var lastProgressReport = 0f
        var bytes: Int
        while (input.read(buffer).also { bytes = it } != -1) {
            output.write(buffer, 0, bytes)
            downloaded += bytes
            if (totalBytes > 0) {
                val progress = downloaded.toFloat() / totalBytes
                if (progress - lastProgressReport >= 0.005f) {
                    lastProgressReport = progress
                    onProgress(progress)
                }
            }
        }
        output.flush()
        output.close()
        input.close()
        onProgress(1f)
        tempFile.renameTo(destFile)
    } catch (e: Exception) {
        tempFile.delete()
        throw e
    } finally {
        conn.disconnect()
    }
}
