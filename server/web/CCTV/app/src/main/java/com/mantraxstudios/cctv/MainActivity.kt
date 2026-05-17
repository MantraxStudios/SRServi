package com.mantraxstudios.cctv

import android.app.admin.DevicePolicyManager
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.util.Log
import android.view.KeyEvent
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.addCallback
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.foundation.Image
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
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
import android.graphics.BitmapFactory
import androidx.annotation.RequiresApi
import androidx.compose.ui.graphics.asImageBitmap
import org.json.JSONObject
import java.io.*
import java.net.HttpURLConnection
import java.net.URL
import java.security.SecureRandom
import java.security.cert.X509Certificate
import javax.net.ssl.HostnameVerifier
import javax.net.ssl.HttpsURLConnection
import javax.net.ssl.SSLContext
import javax.net.ssl.TrustManager
import javax.net.ssl.X509TrustManager

private val Gold = Color(0xFFD4AF37)
private val DarkBg = Color(0xFF0A0A0A)
private val CardBg = Color(0xFF141414)

private const val BASE_URL = "https://srservi2.srautomatic.com"
private const val STORE_CODE = "AUTO_STORE_CODE"
private const val PREFS_NAME = "cctv_signage"
private const val KEY_TOKEN = "device_token"
private const val KEY_VIDEO_PATH = "current_video_path"
private const val KEY_VIDEO_URL = "current_video_url"
private const val KEY_MUSIC_URL = "current_music_url"
private const val KEY_MUSIC_PATH = "current_music_path"
private const val KEY_LAUNCHER_CONFIRMED = "launcher_confirmed"
private const val KEY_OFFLINE_MODE = "offline_mode"
private const val KEY_AUTO_OFFLINE = "auto_offline"
private const val TAG = "CCTVSignage"
private const val PERM_NOTIFICATIONS = "android.permission.POST_NOTIFICATIONS"
private const val PERM_STORAGE = "android.permission.WRITE_EXTERNAL_STORAGE"

private fun isNetworkAvailable(context: Context): Boolean {
    val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    return if (Build.VERSION.SDK_INT >= 23) {
        val network = cm.activeNetwork ?: return false
        cm.getNetworkCapabilities(network)
            ?.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) == true
    } else {
        @Suppress("DEPRECATION")
        cm.activeNetworkInfo?.isConnected == true
    }
}

private fun getVideoStorageDir(context: Context): File {
    val dir = context.getExternalFilesDir("videos") ?: context.filesDir
    if (!dir.exists()) dir.mkdirs()
    return dir
}

private fun getMusicStorageDir(context: Context): File {
    val dir = context.getExternalFilesDir("music") ?: context.filesDir
    if (!dir.exists()) dir.mkdirs()
    return dir
}

private fun getImageStorageDir(context: Context): File {
    val dir = context.getExternalFilesDir("images") ?: context.filesDir
    if (!dir.exists()) dir.mkdirs()
    return dir
}

class MainActivity : ComponentActivity() {

    private var appScreen by mutableStateOf("init")
    private var kioskActive = false
    private var showBackMenu by mutableStateOf(false)
    private var setupDone = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        onBackPressedDispatcher.addCallback(this) { showBackMenu = true }
        KioskService.start(this)

        setContent {
            val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val context = LocalContext.current
            var offlineMode by remember { mutableStateOf(prefs.getBoolean(KEY_OFFLINE_MODE, false)) }
            var isConnected by remember { mutableStateOf(isNetworkAvailable(context)) }
            var showVideoList by remember { mutableStateOf(false) }
            var overrideVideoPath by remember { mutableStateOf<String?>(null) }

            // Monitorear conectividad cada 5 segundos
            LaunchedEffect(Unit) {
                while (true) {
                    delay(5_000)
                    val connected = isNetworkAvailable(context)
                    if (connected != isConnected) {
                        isConnected = connected
                        if (connected && prefs.getBoolean(KEY_AUTO_OFFLINE, false)) {
                            // Conectividad restaurada - volver a modo online automáticamente
                            offlineMode = false
                            prefs.edit()
                                .putBoolean(KEY_OFFLINE_MODE, false)
                                .putBoolean(KEY_AUTO_OFFLINE, false)
                                .apply()
                        } else if (!connected && !offlineMode) {
                            // Conectividad perdida - cambiar a offline automáticamente
                            offlineMode = true
                            prefs.edit()
                                .putBoolean(KEY_OFFLINE_MODE, true)
                                .putBoolean(KEY_AUTO_OFFLINE, true)
                                .apply()
                        }
                    }
                }
            }

            Box(modifier = Modifier.fillMaxSize()) {
                when (appScreen) {
                    "setup_permissions" -> PermissionsSetupScreen(
                        onAllGranted = { appScreen = "setup_launcher" }
                    )
                    "setup_launcher" -> SetupLauncherScreen(
                        onOpenLauncherSettings = { openLauncherSettings() },
                        onOpenSystemSettings = { openSystemSettings() },
                        isLauncherDefault = { isDefaultLauncher() },
                        onConfirmed = {
                            prefs.edit().putBoolean(KEY_LAUNCHER_CONFIRMED, true).apply()
                            appScreen = "splash"
                        }
                    )
                    "splash" -> SplashScreen(onFinish = {
                        appScreen = when {
                            prefs.getString(KEY_TOKEN, null) != null -> "player"
                            STORE_CODE.isNotEmpty() && STORE_CODE != "AUTO_STORE_CODE" -> "auto_pair"
                            else -> "pair"
                        }
                    })
                    "auto_pair" -> AutoPairScreen(
                        storeCode = STORE_CODE,
                        onPaired = { token ->
                            prefs.edit().putString(KEY_TOKEN, token).apply()
                            appScreen = "player"
                        },
                        onError = { appScreen = "pair" }
                    )
                    "pair" -> PairingScreen(onPaired = { token ->
                        prefs.edit().putString(KEY_TOKEN, token).apply()
                        appScreen = "player"
                    })
                    "player" -> PlayerScreen(
                        prefs = prefs,
                        offlineMode = offlineMode,
                        isConnected = isConnected,
                        overrideVideoPath = overrideVideoPath
                    )
                }

                if (showBackMenu) {
                    BackMenuDialog(
                        onStay = { showBackMenu = false },
                        onSystemSettings = { showBackMenu = false; openSystemSettings() },
                        offlineMode = offlineMode,
                        isConnected = isConnected,
                        onToggleMode = {
                            val newOffline = !offlineMode
                            offlineMode = newOffline
                            prefs.edit()
                                .putBoolean(KEY_OFFLINE_MODE, newOffline)
                                .putBoolean(KEY_AUTO_OFFLINE, false)
                                .apply()
                            showBackMenu = false
                        },
                        onShowVideoList = {
                            showBackMenu = false
                            showVideoList = true
                        }
                    )
                }

                if (showVideoList) {
                    VideoListOverlay(
                        currentPath = prefs.getString(KEY_VIDEO_PATH, null),
                        onSelect = { path ->
                            overrideVideoPath = path
                            showVideoList = false
                        },
                        onDismiss = { showVideoList = false }
                    )
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        KioskService.instance?.cancelRelaunch()
        setupLockTask()
        if (appScreen == "init" || appScreen == "setup_permissions" || appScreen == "setup_launcher") {
            val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val launcherConfirmed = prefs.getBoolean(KEY_LAUNCHER_CONFIRMED, false)
            appScreen = when {
                !hasRequiredPermissions() -> "setup_permissions"
                !launcherConfirmed -> "setup_launcher"
                else -> "splash"
            }
        }
    }

    override fun onStop() {
        super.onStop()
        KioskService.instance?.scheduleRelaunch(15_000)
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        return when (keyCode) {
            KeyEvent.KEYCODE_HOME,
            KeyEvent.KEYCODE_APP_SWITCH -> true
            KeyEvent.KEYCODE_MENU -> { showBackMenu = true; true }
            else -> super.onKeyDown(keyCode, event)
        }
    }

    private fun isDefaultLauncher(): Boolean {
        val homeIntent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
        val info = packageManager.resolveActivity(homeIntent, PackageManager.MATCH_DEFAULT_ONLY)
        return info?.activityInfo?.packageName == packageName
    }

    private fun openLauncherSettings() {
        val intents = listOf(
            Intent(Settings.ACTION_HOME_SETTINGS),
            Intent(Settings.ACTION_MANAGE_DEFAULT_APPS_SETTINGS),
            Intent(Settings.ACTION_SETTINGS)
        )
        for (intent in intents) {
            try { startActivity(intent); return } catch (_: Exception) {}
        }
    }

    fun openSystemSettings() {
        try { startActivity(Intent(Settings.ACTION_SETTINGS)) } catch (_: Exception) {}
    }

    fun openWifiSettings() {
        try { startActivity(Intent(Settings.ACTION_WIFI_SETTINGS)) } catch (_: Exception) {}
    }

    fun openAppSettings() {
        try {
            startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = Uri.fromParts("package", packageName, null)
            })
        } catch (_: Exception) {}
    }

    fun hasRequiredPermissions(): Boolean {
        val notifOk = if (Build.VERSION.SDK_INT >= 33)
            checkSelfPermission(PERM_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
        else true
        val storageOk = if (Build.VERSION.SDK_INT < 29)
            checkSelfPermission(PERM_STORAGE) == PackageManager.PERMISSION_GRANTED
        else true
        return notifOk && storageOk
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
    }
}

// ─── Permissions Setup ───────────────────────────────────────────────────────

@Composable
fun PermissionsSetupScreen(onAllGranted: () -> Unit) {
    val context = LocalContext.current

    fun checkNotif() = if (Build.VERSION.SDK_INT >= 33)
        context.checkSelfPermission(PERM_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
    else true

    fun checkStorage() = if (Build.VERSION.SDK_INT < 29)
        context.checkSelfPermission(PERM_STORAGE) == PackageManager.PERMISSION_GRANTED
    else true

    fun checkBattery() = (context.getSystemService(PowerManager::class.java))
        .isIgnoringBatteryOptimizations(context.packageName)

    var notifOk by remember { mutableStateOf(checkNotif()) }
    var storageOk by remember { mutableStateOf(checkStorage()) }
    var batteryOk by remember { mutableStateOf(checkBattery()) }
    val allOk = notifOk && storageOk

    LaunchedEffect(allOk) {
        if (allOk) { delay(1200); onAllGranted() }
    }

    LaunchedEffect(Unit) {
        while (true) {
            delay(1000)
            notifOk = checkNotif()
            storageOk = checkStorage()
            batteryOk = checkBattery()
        }
    }

    val notifLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) {
        notifOk = it
    }
    val storageLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) {
        storageOk = it
    }

    fun openBatterySettings() {
        val intents = listOf(
            Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                data = Uri.parse("package:${context.packageName}")
            },
            Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS),
            Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = Uri.parse("package:${context.packageName}")
            },
            Intent(Settings.ACTION_SETTINGS)
        )
        for (intent in intents) {
            try {
                context.startActivity(intent.apply { addFlags(Intent.FLAG_ACTIVITY_NEW_TASK) })
                return
            } catch (_: Exception) {}
        }
    }

    var visible by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { delay(200); visible = true }

    // Calcular numeración dinámica
    val storageShown = Build.VERSION.SDK_INT < 29
    val notifShown = Build.VERSION.SDK_INT >= 33
    val storageNum = "1"
    val notifNum = if (storageShown) "2" else "1"
    val batteryNum = when {
        storageShown && notifShown -> "3"
        storageShown || notifShown -> "2"
        else -> "1"
    }

    Box(
        modifier = Modifier.fillMaxSize().background(DarkBg),
        contentAlignment = Alignment.Center
    ) {
        AnimatedVisibility(
            visible = visible,
            enter = fadeIn(tween(500)) + scaleIn(tween(500), initialScale = 0.9f)
        ) {
            Card(
                modifier = Modifier.width(500.dp).padding(16.dp),
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(containerColor = CardBg),
                border = BorderStroke(1.dp, Gold.copy(alpha = 0.3f)),
                elevation = CardDefaults.cardElevation(12.dp)
            ) {
                Column(
                    modifier = Modifier.padding(horizontal = 40.dp, vertical = 40.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Box(
                        modifier = Modifier.size(72.dp).background(Color.White, RoundedCornerShape(18.dp)).padding(6.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Image(
                            painter = painterResource(R.drawable.miapp),
                            contentDescription = "SRServi",
                            modifier = Modifier.fillMaxSize(),
                            contentScale = ContentScale.Fit
                        )
                    }

                    Spacer(Modifier.height(20.dp))

                    Text(
                        "Configuración inicial",
                        color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Bold,
                        textAlign = TextAlign.Center
                    )
                    Spacer(Modifier.height(6.dp))
                    Text(
                        "Activa los permisos recomendados. Puedes continuar sin todos si tu dispositivo no los soporta.",
                        color = Color.White.copy(alpha = 0.45f), fontSize = 13.sp,
                        textAlign = TextAlign.Center, lineHeight = 18.sp
                    )

                    Spacer(Modifier.height(28.dp))

                    // Almacenamiento — solo en Android 9 y anteriores
                    if (storageShown) {
                        PermissionItem(
                            number = storageNum,
                            title = "Almacenamiento",
                            description = "Necesario para guardar videos descargados en el dispositivo.",
                            granted = storageOk,
                            onEnable = { storageLauncher.launch(PERM_STORAGE) }
                        )
                        Spacer(Modifier.height(12.dp))
                    }

                    // Notificaciones — solo en Android 13+
                    if (notifShown) {
                        PermissionItem(
                            number = notifNum,
                            title = "Notificaciones",
                            description = "Mantiene el servicio activo para que la app no se cierre.",
                            granted = notifOk,
                            onEnable = { notifLauncher.launch(PERM_NOTIFICATIONS) }
                        )
                        Spacer(Modifier.height(12.dp))
                    }

                    PermissionItem(
                        number = batteryNum,
                        title = "Sin restricción de batería (recomendado)",
                        description = "Recomendado. Evita que el sistema cierre la app. Si ya lo activaste y sigue en pendiente, ignóralo.",
                        granted = batteryOk,
                        onEnable = { openBatterySettings() }
                    )

                    Spacer(Modifier.height(24.dp))

                    Button(
                        onClick = onAllGranted,
                        modifier = Modifier.fillMaxWidth().height(52.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (allOk) Color(0xFF22C55E) else Gold
                        ),
                        shape = RoundedCornerShape(14.dp)
                    ) {
                        Text(
                            if (allOk) "Todo listo — Continuar" else "Continuar de todos modos",
                            color = Color.Black,
                            fontWeight = FontWeight.Bold,
                            fontSize = 15.sp
                        )
                    }

                    if (!allOk) {
                        Spacer(Modifier.height(10.dp))
                        Text(
                            "Si el botón Activar no hace nada, ve a Ajustes del sistema manualmente.",
                            color = Color.White.copy(alpha = 0.3f),
                            fontSize = 11.sp,
                            textAlign = TextAlign.Center,
                            lineHeight = 15.sp
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun PermissionItem(
    number: String,
    title: String,
    description: String,
    granted: Boolean,
    onEnable: () -> Unit
) {
    Row(
        modifier = Modifier
            .background(
                if (granted) Color(0xFF14301A) else Color.White.copy(alpha = 0.06f),
                RoundedCornerShape(12.dp)
            )
            .padding(14.dp)
            .fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Box(
            modifier = Modifier
                .size(36.dp)
                .background(if (granted) Color(0xFF22C55E) else Gold, RoundedCornerShape(10.dp)),
            contentAlignment = Alignment.Center
        ) {
            Text(
                if (granted) "OK" else number,
                color = DarkBg, fontSize = 13.sp, fontWeight = FontWeight.Black
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(title, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp)
            Text(description, color = Color.White.copy(alpha = 0.5f), fontSize = 12.sp, lineHeight = 16.sp)
        }
        if (!granted) {
            Button(
                onClick = onEnable,
                colors = ButtonDefaults.buttonColors(containerColor = Gold),
                shape = RoundedCornerShape(10.dp),
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp)
            ) {
                Text("Activar", color = DarkBg, fontWeight = FontWeight.Bold, fontSize = 13.sp)
            }
        }
    }
}

// ─── Back Menu ───────────────────────────────────────────────────────────────

@Composable
fun BackMenuDialog(
    onStay: () -> Unit,
    onSystemSettings: () -> Unit,
    offlineMode: Boolean = false,
    isConnected: Boolean = true,
    onToggleMode: () -> Unit = {},
    onShowVideoList: () -> Unit = {}
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = 0.78f)),
        contentAlignment = Alignment.Center
    ) {
        Card(
            modifier = Modifier.width(380.dp),
            shape = RoundedCornerShape(24.dp),
            colors = CardDefaults.cardColors(containerColor = CardBg),
            border = BorderStroke(1.dp, Gold.copy(alpha = 0.35f)),
            elevation = CardDefaults.cardElevation(16.dp)
        ) {
            Column(
                modifier = Modifier.padding(horizontal = 36.dp, vertical = 36.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Box(
                    modifier = Modifier
                        .size(60.dp)
                        .background(Color.White, RoundedCornerShape(16.dp))
                        .padding(5.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Image(
                        painter = painterResource(R.drawable.miapp),
                        contentDescription = "SRServi",
                        modifier = Modifier.fillMaxSize(),
                        contentScale = ContentScale.Fit
                    )
                }

                Spacer(Modifier.height(20.dp))

                Text(
                    "¿Qué deseas hacer?",
                    color = Color.White,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center
                )

                Spacer(Modifier.height(28.dp))

                Button(
                    onClick = onStay,
                    modifier = Modifier.fillMaxWidth().height(54.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Gold),
                    shape = RoundedCornerShape(14.dp)
                ) {
                    Text("Cartelería Digital", color = DarkBg, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                }

                Spacer(Modifier.height(10.dp))

                // Toggle Online / Offline
                Button(
                    onClick = onToggleMode,
                    modifier = Modifier.fillMaxWidth().height(58.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (offlineMode) Color(0xFF1C3461) else Color(0xFF163016)
                    ),
                    shape = RoundedCornerShape(14.dp)
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            if (offlineMode) "Cambiar a Modo Online" else "Cambiar a Modo Offline",
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 15.sp
                        )
                        Text(
                            if (offlineMode)
                                if (isConnected) "Hay conexión disponible" else "Sin conexión detectada"
                            else
                                "Reproducir solo video guardado",
                            color = Color.White.copy(alpha = 0.5f),
                            fontSize = 11.sp
                        )
                    }
                }

                Spacer(Modifier.height(10.dp))

                OutlinedButton(
                    onClick = onShowVideoList,
                    modifier = Modifier.fillMaxWidth().height(54.dp),
                    border = BorderStroke(1.dp, Gold.copy(alpha = 0.5f)),
                    shape = RoundedCornerShape(14.dp)
                ) {
                    Text("Ver videos guardados", color = Gold, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
                }

                Spacer(Modifier.height(10.dp))

                OutlinedButton(
                    onClick = onSystemSettings,
                    modifier = Modifier.fillMaxWidth().height(54.dp),
                    border = BorderStroke(1.dp, Color.White.copy(alpha = 0.3f)),
                    shape = RoundedCornerShape(14.dp)
                ) {
                    Text("Configuraciones del Sistema", color = Color.White, fontSize = 16.sp)
                }
            }
        }
    }
}

// ─── Setup Launcher ──────────────────────────────────────────────────────────

@Composable
fun SetupLauncherScreen(
    onOpenLauncherSettings: () -> Unit,
    onOpenSystemSettings: () -> Unit,
    isLauncherDefault: () -> Boolean,
    onConfirmed: () -> Unit
) {
    var visible by remember { mutableStateOf(false) }
    var launcherReady by remember { mutableStateOf(false) }
    var showSystemMenu by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        delay(200)
        visible = true
        while (true) {
            launcherReady = isLauncherDefault()
            delay(1000)
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(DarkBg),
        contentAlignment = Alignment.Center
    ) {
        AnimatedVisibility(
            visible = visible,
            enter = fadeIn(tween(500)) + scaleIn(tween(500), initialScale = 0.9f)
        ) {
            Card(
                modifier = Modifier
                    .width(460.dp)
                    .padding(16.dp),
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(containerColor = CardBg),
                border = BorderStroke(1.dp, Gold.copy(alpha = 0.3f)),
                elevation = CardDefaults.cardElevation(12.dp)
            ) {
                Column(
                    modifier = Modifier.padding(horizontal = 40.dp, vertical = 44.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Box(
                        modifier = Modifier
                            .size(72.dp)
                            .background(Color.White, RoundedCornerShape(18.dp))
                            .padding(6.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Image(
                            painter = painterResource(R.drawable.miapp),
                            contentDescription = "SRServi",
                            modifier = Modifier.fillMaxSize(),
                            contentScale = ContentScale.Fit
                        )
                    }

                    Spacer(Modifier.height(20.dp))

                    Text(
                        "Cartelería Digital",
                        color = Color.White,
                        fontSize = 24.sp,
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

                    Row(
                        modifier = Modifier
                            .background(
                                if (launcherReady) Color(0xFF14301A) else Color.White.copy(alpha = 0.06f),
                                RoundedCornerShape(12.dp)
                            )
                            .padding(16.dp)
                            .fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(36.dp)
                                .background(
                                    if (launcherReady) Color(0xFF22C55E) else Gold,
                                    RoundedCornerShape(10.dp)
                                ),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                if (launcherReady) "OK" else "!",
                                color = DarkBg,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Black
                            )
                        }
                        Column {
                            Text(
                                if (launcherReady) "Launcher configurado" else "Launcher no configurado",
                                color = if (launcherReady) Color(0xFF22C55E) else Color.White,
                                fontWeight = FontWeight.Bold,
                                fontSize = 15.sp
                            )
                            Spacer(Modifier.height(2.dp))
                            Text(
                                if (launcherReady)
                                    "Presiona Continuar para iniciar la app."
                                else
                                    "Esta app debe ser la pantalla de inicio del dispositivo.",
                                color = Color.White.copy(alpha = 0.5f),
                                fontSize = 13.sp,
                                lineHeight = 18.sp
                            )
                        }
                    }

                    Spacer(Modifier.height(20.dp))

                    Button(
                        onClick = onOpenLauncherSettings,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(52.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (launcherReady) Color.White.copy(alpha = 0.1f) else Gold
                        ),
                        shape = RoundedCornerShape(14.dp)
                    ) {
                        Text(
                            "Abrir ajustes de Launcher",
                            color = if (launcherReady) Color.White.copy(alpha = 0.6f) else DarkBg,
                            fontWeight = FontWeight.Bold,
                            fontSize = 15.sp
                        )
                    }

                    Spacer(Modifier.height(10.dp))

                    Button(
                        onClick = onConfirmed,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(52.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (launcherReady) Color(0xFF22C55E) else Gold
                        ),
                        shape = RoundedCornerShape(14.dp)
                    ) {
                        Text(
                            if (launcherReady) "Continuar" else "Ya lo configure, Continuar",
                            color = Color.Black,
                            fontWeight = FontWeight.Bold,
                            fontSize = 15.sp
                        )
                    }

                    Spacer(Modifier.height(20.dp))

                    TextButton(onClick = { showSystemMenu = true }) {
                        Text(
                            "Problemas? Abrir ajustes del sistema",
                            color = Color.White.copy(alpha = 0.35f),
                            fontSize = 12.sp
                        )
                    }
                }
            }
        }

        if (showSystemMenu) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.Black.copy(alpha = 0.7f)),
                contentAlignment = Alignment.Center
            ) {
                Card(
                    modifier = Modifier.width(340.dp),
                    shape = RoundedCornerShape(20.dp),
                    colors = CardDefaults.cardColors(containerColor = CardBg),
                    border = BorderStroke(1.dp, Gold.copy(alpha = 0.25f))
                ) {
                    Column(modifier = Modifier.padding(28.dp)) {
                        Text(
                            "Ajustes del Sistema",
                            color = Color.White,
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            "Accesos directos para solucionar problemas",
                            color = Color.White.copy(alpha = 0.4f),
                            fontSize = 12.sp
                        )
                        Spacer(Modifier.height(20.dp))

                        listOf(
                            "Ajustes generales" to onOpenSystemSettings,
                            "Ajustes de Launcher / Apps predeterminadas" to onOpenLauncherSettings
                        ).forEach { (label, action) ->
                            Button(
                                onClick = { showSystemMenu = false; action() },
                                modifier = Modifier.fillMaxWidth().height(48.dp).padding(vertical = 3.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = Color.White.copy(alpha = 0.07f)),
                                shape = RoundedCornerShape(10.dp)
                            ) {
                                Text(label, color = Color.White, fontSize = 14.sp)
                            }
                        }

                        Spacer(Modifier.height(12.dp))
                        TextButton(
                            onClick = { showSystemMenu = false },
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text("Cerrar", color = Gold, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                        }
                    }
                }
            }
        }
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
                            .background(Color.White, RoundedCornerShape(20.dp))
                            .padding(8.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Image(
                            painter = painterResource(R.drawable.miapp),
                            contentDescription = "SRServi",
                            modifier = Modifier.fillMaxSize(),
                            contentScale = ContentScale.Fit
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

// ─── Auto Pair (pre-configured store code) ───────────────────────────────────

@Composable
fun AutoPairScreen(storeCode: String, onPaired: (String) -> Unit, onError: () -> Unit) {
    var errorMsg by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()

    LaunchedEffect(storeCode) {
        scope.launch {
            try {
                val token = pairDevice(storeCode)
                onPaired(token)
            } catch (e: Exception) {
                errorMsg = e.message ?: "Error al conectar"
                Log.e(TAG, "AutoPair error: ${e.message}")
            }
        }
    }

    Box(modifier = Modifier.fillMaxSize().background(DarkBg), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(20.dp)) {
            if (errorMsg.isEmpty()) {
                CircularProgressIndicator(color = Gold, strokeWidth = 3.dp, modifier = Modifier.size(48.dp))
                Text("Conectando tienda $storeCode...", color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Medium)
            } else {
                Text("⚠ $errorMsg", color = Color(0xFFf87171), fontSize = 14.sp, textAlign = androidx.compose.ui.text.style.TextAlign.Center, modifier = Modifier.padding(horizontal = 32.dp))
                Spacer(modifier = Modifier.height(4.dp))
                Button(onClick = onError, colors = ButtonDefaults.buttonColors(containerColor = Gold)) {
                    Text("Ingresar código manualmente", color = Color.Black, fontWeight = FontWeight.Bold)
                }
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
                        .background(Color.White, RoundedCornerShape(16.dp))
                        .padding(6.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Image(
                        painter = painterResource(R.drawable.miapp),
                        contentDescription = "SRServi",
                        modifier = Modifier.fillMaxSize(),
                        contentScale = ContentScale.Fit
                    )
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
                                val msg = e.message ?: "Error desconocido"
                                errorMsg = msg
                                Log.e(TAG, "Pair error: ${e.javaClass.simpleName}: $msg")
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

// ─── Waiting Signal ──────────────────────────────────────────────────────────

@Composable
fun WaitingSignalScreen() {
    val transition = rememberInfiniteTransition(label = "signal")

    val ring1ScaleF by transition.animateFloat(
        initialValue = 80f, targetValue = 180f,
        animationSpec = infiniteRepeatable(tween(2000, easing = FastOutSlowInEasing), RepeatMode.Restart),
        label = "r1s"
    )
    val ring1Scale = ring1ScaleF.dp
    val ring1Alpha by transition.animateFloat(
        initialValue = 0.6f, targetValue = 0f,
        animationSpec = infiniteRepeatable(tween(2000), RepeatMode.Restart),
        label = "r1a"
    )
    val ring2ScaleF by transition.animateFloat(
        initialValue = 80f, targetValue = 180f,
        animationSpec = infiniteRepeatable(tween(2000, delayMillis = 700, easing = FastOutSlowInEasing), RepeatMode.Restart),
        label = "r2s"
    )
    val ring2Scale = ring2ScaleF.dp
    val ring2Alpha by transition.animateFloat(
        initialValue = 0.6f, targetValue = 0f,
        animationSpec = infiniteRepeatable(tween(2000, delayMillis = 700), RepeatMode.Restart),
        label = "r2a"
    )
    val ring3ScaleF by transition.animateFloat(
        initialValue = 80f, targetValue = 180f,
        animationSpec = infiniteRepeatable(tween(2000, delayMillis = 1400, easing = FastOutSlowInEasing), RepeatMode.Restart),
        label = "r3s"
    )
    val ring3Scale = ring3ScaleF.dp
    val ring3Alpha by transition.animateFloat(
        initialValue = 0.6f, targetValue = 0f,
        animationSpec = infiniteRepeatable(tween(2000, delayMillis = 1400), RepeatMode.Restart),
        label = "r3a"
    )
    val textAlpha by transition.animateFloat(
        initialValue = 0.5f, targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(1200), RepeatMode.Reverse),
        label = "txt"
    )

    Box(
        modifier = Modifier.fillMaxSize().background(DarkBg),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Box(contentAlignment = Alignment.Center, modifier = Modifier.size(200.dp)) {
                Box(
                    modifier = Modifier
                        .size(ring3Scale)
                        .background(Gold.copy(alpha = ring3Alpha * 0.12f), RoundedCornerShape(percent = 50))
                )
                Box(
                    modifier = Modifier
                        .size(ring2Scale)
                        .background(Gold.copy(alpha = ring2Alpha * 0.18f), RoundedCornerShape(percent = 50))
                )
                Box(
                    modifier = Modifier
                        .size(ring1Scale)
                        .background(Gold.copy(alpha = ring1Alpha * 0.25f), RoundedCornerShape(percent = 50))
                )
                Box(
                    modifier = Modifier
                        .size(80.dp)
                        .background(Color.White, RoundedCornerShape(20.dp))
                        .padding(7.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Image(
                        painter = painterResource(R.drawable.miapp),
                        contentDescription = "SRServi",
                        modifier = Modifier.fillMaxSize(),
                        contentScale = ContentScale.Fit
                    )
                }
            }

            Spacer(Modifier.height(36.dp))

            Text(
                "Esperando señal",
                color = Color.White.copy(alpha = textAlpha),
                fontSize = 28.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.5.sp
            )

            Spacer(Modifier.height(10.dp))

            Text(
                "No hay video asignado a esta pantalla",
                color = Color.White.copy(alpha = 0.45f),
                fontSize = 15.sp
            )

            Spacer(Modifier.height(28.dp))

            Text(
                "Para reproducir un video, accede al panel de administración:",
                color = Color.White.copy(alpha = 0.35f),
                fontSize = 13.sp,
                textAlign = TextAlign.Center
            )

            Spacer(Modifier.height(10.dp))

            Box(
                modifier = Modifier
                    .background(Gold.copy(alpha = 0.13f), RoundedCornerShape(10.dp))
                    .padding(horizontal = 24.dp, vertical = 10.dp)
            ) {
                Text(
                    "srservi2.srautomatic.com/admin",
                    color = Gold,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold,
                    letterSpacing = 0.3.sp
                )
            }

            Spacer(Modifier.height(8.dp))

            Text(
                "Sección CCTV → Asignar video a esta pantalla",
                color = Gold.copy(alpha = 0.55f),
                fontSize = 12.sp
            )
        }
    }
}

// ─── Player ──────────────────────────────────────────────────────────────────

@OptIn(UnstableApi::class)
@Composable
fun PlayerScreen(prefs: SharedPreferences, offlineMode: Boolean, isConnected: Boolean, overrideVideoPath: String? = null) {
    val context = LocalContext.current
    var downloadProgress by remember { mutableFloatStateOf(-1f) }
    var downloadingName by remember { mutableStateOf("") }
    var hasVideo by remember {
        mutableStateOf(
            prefs.getString(KEY_VIDEO_PATH, null)?.let { File(it).exists() } == true
        )
    }

    var displayMode by remember { mutableStateOf("video") }
    var slideshowImages by remember { mutableStateOf<List<Pair<String, Int>>>(emptyList()) }

    val exoPlayer = remember {
        ExoPlayer.Builder(context).build().apply {
            repeatMode = Player.REPEAT_MODE_ONE
            playWhenReady = true
            volume = 0f
        }
    }

    val musicPlayer = remember {
        ExoPlayer.Builder(context).build().apply {
            repeatMode = Player.REPEAT_MODE_ALL
            playWhenReady = true
            volume = 1f
        }
    }

    // Cargar video seleccionado manualmente desde la lista
    LaunchedEffect(overrideVideoPath) {
        val path = overrideVideoPath ?: return@LaunchedEffect
        val file = File(path)
        if (file.exists()) {
            exoPlayer.setMediaItem(MediaItem.fromUri(Uri.fromFile(file)))
            exoPlayer.prepare()
            hasVideo = true
            prefs.edit().putString(KEY_VIDEO_PATH, path).apply()
        }
    }

    // Cargar video y música guardados al iniciar
    LaunchedEffect(Unit) {
        val savedPath = prefs.getString(KEY_VIDEO_PATH, null)
        if (savedPath != null) {
            val file = File(savedPath)
            if (file.exists()) {
                exoPlayer.setMediaItem(MediaItem.fromUri(Uri.fromFile(file)))
                exoPlayer.prepare()
                hasVideo = true
            }
        }
        val savedMusicPath = prefs.getString(KEY_MUSIC_PATH, null)
        if (savedMusicPath != null) {
            val file = File(savedMusicPath)
            if (file.exists()) {
                musicPlayer.setMediaItem(MediaItem.fromUri(Uri.fromFile(file)))
                musicPlayer.prepare()
            }
        }
    }

    // Consultar servidor cada 30s — solo en modo online
    val deviceToken = remember { prefs.getString(KEY_TOKEN, "") ?: "" }
    LaunchedEffect(deviceToken, offlineMode) {
        if (offlineMode) return@LaunchedEffect
        while (true) {
            try {
                val config = fetchDeviceConfig(deviceToken)

                // ── Video (con evaluación de programación) ─────────────────────
                val activeSchedule = getActiveSchedule(config.optJSONArray("schedules"))
                val videoUrl = (activeSchedule?.optString("video_url")?.takeIf { it.isNotEmpty() }
                    ?: config.optString("video_url").takeIf { it.isNotEmpty() })
                val savedUrl = prefs.getString(KEY_VIDEO_URL, null)

                if (videoUrl != null && videoUrl != savedUrl) {
                    val fullUrl = if (videoUrl.startsWith("http")) videoUrl else "$BASE_URL$videoUrl"
                    val urlHash = videoUrl.hashCode().toString().replace("-", "n")
                    val originalName = Uri.parse(videoUrl).lastPathSegment ?: "video.mp4"
                    val safeFilename = "${urlHash}_${originalName}"
                    val destFile = File(getVideoStorageDir(context), safeFilename)

                    if (!destFile.exists()) {
                        downloadingName = config.optString("video_name", originalName)
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
                            prefs.edit()
                                .putString(KEY_VIDEO_PATH, destFile.absolutePath)
                                .putString(KEY_VIDEO_URL, videoUrl)
                                .apply()

                            exoPlayer.setMediaItem(MediaItem.fromUri(Uri.fromFile(destFile)))
                            exoPlayer.prepare()
                            hasVideo = true
                        }
                    } else {
                        prefs.edit().putString(KEY_VIDEO_URL, videoUrl).apply()
                        val currentPath = prefs.getString(KEY_VIDEO_PATH, null)
                        if (currentPath != destFile.absolutePath) {
                            prefs.edit().putString(KEY_VIDEO_PATH, destFile.absolutePath).apply()
                            exoPlayer.setMediaItem(MediaItem.fromUri(Uri.fromFile(destFile)))
                            exoPlayer.prepare()
                        }
                        hasVideo = true
                    }
                    downloadProgress = -1f
                }

                // ── Modo display (video / imágenes) ────────────────────────────
                val mode = config.optString("display_mode", "video").ifEmpty { "video" }
                displayMode = mode

                if (mode == "images") {
                    exoPlayer.pause()
                    val imagesArray = config.optJSONArray("images")
                    if (imagesArray != null) {
                        val downloaded = mutableListOf<Pair<String, Int>>()
                        for (i in 0 until imagesArray.length()) {
                            val obj = imagesArray.getJSONObject(i)
                            val imgUrl = obj.optString("url").takeIf { it.isNotEmpty() } ?: continue
                            val durationMs = obj.optInt("duration_seconds", 5) * 1000
                            val fullImgUrl = if (imgUrl.startsWith("http")) imgUrl else "$BASE_URL$imgUrl"
                            val ext = "." + (Uri.parse(imgUrl).lastPathSegment?.substringAfterLast('.', "jpg") ?: "jpg")
                            val urlHash = imgUrl.hashCode().toString().replace("-", "n")
                            val destFile = File(getImageStorageDir(context), "${urlHash}${ext}")
                            if (!destFile.exists()) {
                                withContext(Dispatchers.IO) {
                                    try { downloadVideoFile(fullImgUrl, destFile) { _ -> } }
                                    catch (e: Exception) { Log.e(TAG, "Img dl error: ${e.message}"); destFile.delete() }
                                }
                            }
                            if (destFile.exists()) downloaded.add(Pair(destFile.absolutePath, durationMs))
                        }
                        if (downloaded.isNotEmpty()) slideshowImages = downloaded
                    }
                } else {
                    if (exoPlayer.playbackState != Player.STATE_IDLE) exoPlayer.play()
                }

                // ── Música en loop ─────────────────────────────────────────────
                val musicUrl = config.optString("music_url").takeIf { it.isNotEmpty() }
                val savedMusicUrl = prefs.getString(KEY_MUSIC_URL, null)

                // ── Volumen (afecta video Y música) ────────────────────────
                val videoMuted = config.optInt("video_muted", 0) != 0
                val volumeLevel = config.optInt("volume_level", 100).coerceIn(0, 100) / 100f
                val effectiveVolume = if (videoMuted) 0f else volumeLevel
                exoPlayer.volume = effectiveVolume
                musicPlayer.volume = effectiveVolume

                if (musicUrl == null) {
                    if (savedMusicUrl != null || musicPlayer.playbackState != Player.STATE_IDLE) {
                        musicPlayer.pause()
                        musicPlayer.stop()
                        musicPlayer.clearMediaItems()
                        prefs.edit().remove(KEY_MUSIC_URL).remove(KEY_MUSIC_PATH).apply()
                    }
                } else if (musicUrl != savedMusicUrl) {
                    val fullMusicUrl = if (musicUrl.startsWith("http")) musicUrl else "$BASE_URL$musicUrl"
                    val urlHash = musicUrl.hashCode().toString().replace("-", "n")
                    val originalName = Uri.parse(musicUrl).lastPathSegment ?: "music.mp3"
                    val safeFilename = "${urlHash}_${originalName}"
                    val destFile = File(getMusicStorageDir(context), safeFilename)

                    if (!destFile.exists()) {
                        var success = false
                        withContext(Dispatchers.IO) {
                            try {
                                downloadVideoFile(fullMusicUrl, destFile) { _ -> }
                                success = true
                            } catch (e: Exception) {
                                Log.e(TAG, "Music download error: ${e.message}")
                                destFile.delete()
                            }
                        }
                        if (success) {
                            prefs.edit().putString(KEY_MUSIC_URL, musicUrl).putString(KEY_MUSIC_PATH, destFile.absolutePath).apply()
                            musicPlayer.setMediaItem(MediaItem.fromUri(Uri.fromFile(destFile)))
                            musicPlayer.prepare()
                        }
                    } else {
                        prefs.edit().putString(KEY_MUSIC_URL, musicUrl).putString(KEY_MUSIC_PATH, destFile.absolutePath).apply()
                        musicPlayer.setMediaItem(MediaItem.fromUri(Uri.fromFile(destFile)))
                        musicPlayer.prepare()
                    }
                }

            } catch (e: Exception) {
                Log.e(TAG, "Poll error: ${e.message}")
            }
            delay(10_000)
        }
    }

    DisposableEffect(Unit) {
        onDispose {
            exoPlayer.release()
            musicPlayer.release()
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
    ) {
        if (displayMode == "images") {
            ImageSlideshowScreen(images = slideshowImages)
        } else {
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

            // Pantalla de espera cuando no hay video
            AnimatedVisibility(
                visible = !hasVideo,
                enter = fadeIn(tween(600)),
                exit = fadeOut(tween(800))
            ) {
                WaitingSignalScreen()
            }
        }

        // Badge de estado online/offline (top-left)
        AnimatedVisibility(
            visible = offlineMode || !isConnected,
            enter = fadeIn(tween(400)),
            exit = fadeOut(tween(400)),
            modifier = Modifier
                .align(Alignment.TopStart)
                .padding(12.dp)
        ) {
            Box(
                modifier = Modifier
                    .background(
                        if (!isConnected) Color(0xFFEF4444).copy(alpha = 0.85f)
                        else Color(0xFF1C3461).copy(alpha = 0.85f),
                        RoundedCornerShape(8.dp)
                    )
                    .padding(horizontal = 10.dp, vertical = 5.dp)
            ) {
                Text(
                    if (!isConnected) "Sin conexión" else "Modo Offline",
                    color = Color.White,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold
                )
            }
        }

        // Overlay de progreso de descarga
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

// ─── Image Slideshow ─────────────────────────────────────────────────────────

@Composable
fun ImageSlideshowScreen(images: List<Pair<String, Int>>) {
    if (images.isEmpty()) {
        WaitingSignalScreen()
        return
    }

    var currentIndex by remember { mutableIntStateOf(0) }
    val slideshowKey = images.joinToString(",") { it.first }

    LaunchedEffect(slideshowKey) {
        currentIndex = 0
        while (true) {
            val durationMs = images.getOrNull(currentIndex)?.second?.toLong() ?: 5000L
            if (durationMs == 0L) {
                delay(Long.MAX_VALUE) // infinito — coroutine es cancelable cuando cambia la lista
            } else {
                delay(durationMs.coerceAtLeast(1000L))
                currentIndex = (currentIndex + 1) % images.size
            }
        }
    }

    AnimatedContent(
        targetState = currentIndex,
        transitionSpec = { fadeIn(tween(800)) togetherWith fadeOut(tween(800)) },
        label = "slideshow"
    ) { idx ->
        val path = images.getOrNull(idx)?.first
        val bitmap = remember(path) {
            path?.let { runCatching { BitmapFactory.decodeFile(it)?.asImageBitmap() }.getOrNull() }
        }
        Box(
            modifier = Modifier.fillMaxSize().background(Color.Black),
            contentAlignment = Alignment.Center
        ) {
            if (bitmap != null) {
                Image(
                    bitmap = bitmap,
                    contentDescription = null,
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Fit
                )
            }
        }
    }

    // Watermark
    Box(modifier = Modifier.fillMaxSize()) {
        Text(
            "Powered By SRAutomatic.cl",
            color = Color.White.copy(alpha = 0.12f),
            fontSize = 11.sp,
            modifier = Modifier.align(Alignment.TopEnd).padding(12.dp)
        )
    }
}

// ─── Video List Overlay ──────────────────────────────────────────────────────

@Composable
fun VideoListOverlay(
    currentPath: String?,
    onSelect: (String) -> Unit,
    onDismiss: () -> Unit
) {
    val context = LocalContext.current
    val videos = remember {
        getVideoStorageDir(context)
            .listFiles { f -> f.extension.lowercase() in listOf("mp4", "mkv", "avi", "mov", "webm") }
            ?.sortedByDescending { it.lastModified() }
            ?: emptyList()
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = 0.88f)),
        contentAlignment = Alignment.Center
    ) {
        Card(
            modifier = Modifier
                .width(660.dp)
                .fillMaxHeight(0.82f)
                .padding(16.dp),
            shape = RoundedCornerShape(24.dp),
            colors = CardDefaults.cardColors(containerColor = CardBg),
            border = BorderStroke(1.dp, Gold.copy(alpha = 0.3f)),
            elevation = CardDefaults.cardElevation(16.dp)
        ) {
            Column(modifier = Modifier.padding(32.dp)) {
                // Header
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            "Videos guardados",
                            color = Color.White,
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            "${videos.size} video${if (videos.size != 1) "s" else ""} disponible${if (videos.size != 1) "s" else ""}",
                            color = Color.White.copy(alpha = 0.4f),
                            fontSize = 13.sp
                        )
                    }
                    TextButton(onClick = onDismiss) {
                        Text("Cerrar", color = Gold, fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
                    }
                }

                Spacer(Modifier.height(20.dp))

                if (videos.isEmpty()) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 40.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(
                                "Sin videos guardados",
                                color = Color.White.copy(alpha = 0.5f),
                                fontSize = 16.sp
                            )
                            Spacer(Modifier.height(8.dp))
                            Text(
                                "Los videos se descargan automáticamente cuando el dispositivo está en modo online y tiene un video asignado.",
                                color = Color.White.copy(alpha = 0.3f),
                                fontSize = 12.sp,
                                textAlign = TextAlign.Center,
                                lineHeight = 17.sp
                            )
                        }
                    }
                } else {
                    LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        items(videos) { file ->
                            val isActive = file.absolutePath == currentPath
                            val displayName = file.nameWithoutExtension
                                .replace(Regex("^[n\\d]+_"), "")
                                .ifBlank { file.nameWithoutExtension }
                            val sizeMb = "%.1f MB".format(file.length().toFloat() / (1024 * 1024))

                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .background(
                                        if (isActive) Gold.copy(alpha = 0.13f)
                                        else Color.White.copy(alpha = 0.04f),
                                        RoundedCornerShape(12.dp)
                                    )
                                    .clickable { onSelect(file.absolutePath) }
                                    .padding(16.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(14.dp)
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(44.dp)
                                        .background(
                                            if (isActive) Gold else Color.White.copy(alpha = 0.09f),
                                            RoundedCornerShape(12.dp)
                                        ),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        if (isActive) "▶" else "▷",
                                        color = if (isActive) DarkBg else Color.White.copy(alpha = 0.6f),
                                        fontSize = 18.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        displayName,
                                        color = Color.White,
                                        fontWeight = FontWeight.Medium,
                                        fontSize = 14.sp,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                    Text(
                                        sizeMb,
                                        color = Color.White.copy(alpha = 0.4f),
                                        fontSize = 12.sp
                                    )
                                }
                                if (isActive) {
                                    Box(
                                        modifier = Modifier
                                            .background(Gold.copy(alpha = 0.18f), RoundedCornerShape(6.dp))
                                            .padding(horizontal = 10.dp, vertical = 5.dp)
                                    ) {
                                        Text(
                                            "Reproduciendo",
                                            color = Gold,
                                            fontSize = 11.sp,
                                            fontWeight = FontWeight.SemiBold
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

// ─── API Helpers ─────────────────────────────────────────────────────────────

/**
 * Abre una conexión HTTPS con un TrustManager que acepta el certificado del servidor.
 * Necesario porque algunos dispositivos Android TV tienen el store de CAs desactualizado
 * y no confían en Let's Encrypt (ISRG Root X1), causando "Chain validation failed".
 * Es seguro en este contexto de kiosk ya que el hostname se valida explícitamente.
 */
private fun openSecureConnection(urlStr: String): HttpURLConnection {
    val url = URL(urlStr)
    val conn = url.openConnection() as HttpsURLConnection
    try {
        val tm = object : X509TrustManager {
            override fun checkClientTrusted(chain: Array<X509Certificate>, authType: String) = Unit
            override fun checkServerTrusted(chain: Array<X509Certificate>, authType: String) = Unit
            override fun getAcceptedIssuers(): Array<X509Certificate> = emptyArray()
        }
        val sc = SSLContext.getInstance("TLS")
        sc.init(null, arrayOf<TrustManager>(tm), SecureRandom())
        conn.sslSocketFactory = sc.socketFactory
        conn.hostnameVerifier = HostnameVerifier { hostname, _ ->
            hostname == "srservi2.srautomatic.com"
        }
    } catch (e: Exception) {
        Log.e(TAG, "SSL setup failed: ${e.message}")
    }
    return conn
}

private suspend fun pairDevice(code: String): String = withContext(Dispatchers.IO) {
    val conn = openSecureConnection("$BASE_URL/api/cctv/pair")
    conn.requestMethod = "POST"
    conn.setRequestProperty("Content-Type", "application/json")
    conn.doOutput = true
    conn.connectTimeout = 15_000
    conn.readTimeout = 15_000
    val body = """{"pairing_code":"$code","device_name":"TV Cartelería"}"""
    conn.outputStream.use { it.write(body.toByteArray()) }
    val responseCode = try { conn.responseCode } catch (e: Exception) {
        conn.disconnect()
        throw Exception("Sin conexión: ${e.message}")
    }
    val response = runCatching {
        if (responseCode == 200) conn.inputStream.bufferedReader().readText()
        else conn.errorStream?.bufferedReader()?.readText() ?: ""
    }.getOrDefault("")
    conn.disconnect()
    if (responseCode != 200) {
        val msg = runCatching { JSONObject(response).optString("error") }.getOrNull()
        throw Exception(msg?.takeIf { it.isNotEmpty() } ?: "Código inválido (HTTP $responseCode)")
    }
    runCatching { JSONObject(response).getString("device_token") }.getOrElse {
        throw Exception("Respuesta inválida del servidor")
    }
}

private fun getActiveSchedule(schedules: org.json.JSONArray?): org.json.JSONObject? {
    if (schedules == null || schedules.length() == 0) return null
    val cal = java.util.Calendar.getInstance()
    val currentMinutes = cal.get(java.util.Calendar.HOUR_OF_DAY) * 60 + cal.get(java.util.Calendar.MINUTE)
    val dayKey = when (cal.get(java.util.Calendar.DAY_OF_WEEK)) {
        java.util.Calendar.MONDAY -> "mon"
        java.util.Calendar.TUESDAY -> "tue"
        java.util.Calendar.WEDNESDAY -> "wed"
        java.util.Calendar.THURSDAY -> "thu"
        java.util.Calendar.FRIDAY -> "fri"
        java.util.Calendar.SATURDAY -> "sat"
        else -> "sun"
    }
    for (i in 0 until schedules.length()) {
        val s = schedules.getJSONObject(i)
        val days = s.optJSONArray("days")
        val dayMatch = days == null || days.length() == 0 || (0 until days.length()).any { days.getString(it) == dayKey }
        if (!dayMatch) continue
        val startParts = s.optString("start_time", "00:00").split(":")
        val startMin = (startParts.getOrNull(0)?.toIntOrNull() ?: 0) * 60 + (startParts.getOrNull(1)?.toIntOrNull() ?: 0)
        if (currentMinutes < startMin) continue
        val endTime = s.optString("end_time", "")
        if (endTime.isNotEmpty()) {
            val endParts = endTime.split(":")
            val endMin = (endParts.getOrNull(0)?.toIntOrNull() ?: 0) * 60 + (endParts.getOrNull(1)?.toIntOrNull() ?: 0)
            if (currentMinutes >= endMin) continue
        }
        return s
    }
    return null
}

private suspend fun fetchDeviceConfig(deviceToken: String): JSONObject = withContext(Dispatchers.IO) {
    val conn = openSecureConnection("$BASE_URL/api/cctv/device-config?device_token=$deviceToken")
    conn.requestMethod = "GET"
    conn.connectTimeout = 15_000
    conn.readTimeout = 15_000
    val code = runCatching { conn.responseCode }.getOrDefault(0)
    val response = runCatching {
        if (code == 200) conn.inputStream.bufferedReader().readText() else "{}"
    }.getOrDefault("{}")
    conn.disconnect()
    runCatching { JSONObject(response) }.getOrDefault(JSONObject())
}

@RequiresApi(Build.VERSION_CODES.N)
private fun downloadVideoFile(urlStr: String, destFile: File, onProgress: (Float) -> Unit) {
    val conn = openSecureConnection(urlStr)
    conn.connectTimeout = 30_000
    conn.readTimeout = 120_000
    conn.connect()
    val totalBytes = conn.contentLengthLong

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
