package com.mantraxstudios.srservituuorders

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.mantraxstudios.srservituuorders.ui.theme.SRserviTuuOrdersTheme
import kotlinx.coroutines.*
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.*

val Gold = Color(0xFFD4AF37)
val OffWhite = Color(0xFFF8F8F8)

data class PendingOrder(val id: String, val orderNumber: String, val date: String)

class MainActivity : ComponentActivity() {

    private val notifPermLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) {}

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            notifPermLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        }

        setContent {
            SRserviTuuOrdersTheme {
                MainScreen(context = this)
            }
        }
    }
}

@Composable
fun MainScreen(context: Context) {
    val prefs = remember { context.getSharedPreferences("srservi_prefs", Context.MODE_PRIVATE) }
    val scope = rememberCoroutineScope()

    var pin by remember { mutableStateOf(prefs.getString("pos_pin", "") ?: "") }
    var serviceRunning by remember { mutableStateOf(OrderPollingService.isRunning) }
    var showPinDialog by remember { mutableStateOf(pin.isEmpty()) }
    var pinInput by remember { mutableStateOf(pin) }
    var isChecking by remember { mutableStateOf(false) }

    // Pending orders dialog state
    var pendingOrders by remember { mutableStateOf<List<PendingOrder>>(emptyList()) }
    var showPendingDialog by remember { mutableStateOf(false) }

    // Keep service state in sync
    LaunchedEffect(Unit) {
        while (true) {
            serviceRunning = OrderPollingService.isRunning
            delay(1_000)
        }
    }

    // PIN config dialog
    if (showPinDialog) {
        AlertDialog(
            onDismissRequest = { if (pin.isNotEmpty()) showPinDialog = false },
            title = {
                Text("Configurar PIN", color = Gold, fontWeight = FontWeight.Bold, fontSize = 20.sp)
            },
            text = {
                Column {
                    Text("Ingresa el PIN del terminal POS", color = Color.Black)
                    Spacer(Modifier.height(12.dp))
                    OutlinedTextField(
                        value = pinInput,
                        onValueChange = { pinInput = it },
                        label = { Text("PIN") },
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = Gold,
                            unfocusedBorderColor = Color.Gray,
                            cursorColor = Gold,
                            focusedLabelColor = Gold,
                            unfocusedLabelColor = Color.Gray
                        )
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (pinInput.isNotEmpty()) {
                            prefs.edit().putString("pos_pin", pinInput).apply()
                            pin = pinInput
                            showPinDialog = false
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Gold)
                ) {
                    Text("Guardar", color = Color.Black, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                if (pin.isNotEmpty()) {
                    TextButton(onClick = { showPinDialog = false }) {
                        Text("Cancelar", color = Color.Gray)
                    }
                }
            },
            containerColor = Color.White,
            shape = RoundedCornerShape(16.dp)
        )
    }

    // Pending orders dialog
    if (showPendingDialog) {
        AlertDialog(
            onDismissRequest = {},
            title = {
                Text(
                    "Pedidos pendientes",
                    color = Gold,
                    fontWeight = FontWeight.Bold,
                    fontSize = 20.sp
                )
            },
            text = {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(
                        modifier = Modifier
                            .size(72.dp)
                            .background(Color.Black, CircleShape),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "${pendingOrders.size}",
                            color = Gold,
                            fontSize = 30.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                    Spacer(Modifier.height(16.dp))
                    Text(
                        text = if (pendingOrders.size == 1)
                            "Hay 1 pedido pendiente anterior."
                        else
                            "Hay ${pendingOrders.size} pedidos pendientes anteriores.",
                        color = Color.Black,
                        textAlign = TextAlign.Center,
                        fontWeight = FontWeight.Medium,
                        fontSize = 15.sp
                    )
                    Spacer(Modifier.height(6.dp))
                    Text(
                        "¿Deseas imprimirlos ahora?",
                        color = Color.Gray,
                        textAlign = TextAlign.Center,
                        fontSize = 13.sp
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        showPendingDialog = false
                        scope.launch(Dispatchers.IO) {
                            val printed = prefs.getStringSet("printed_orders", emptySet())!!.toMutableSet()
                            for (order in pendingOrders) {
                                PrintHelper.print(context, order.orderNumber, order.date)
                                printed.add(order.id)
                            }
                            prefs.edit().putStringSet("printed_orders", printed).apply()
                            withContext(Dispatchers.Main) { launchService(context) }
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Gold)
                ) {
                    Text("Sí, imprimir", color = Color.Black, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(
                    onClick = {
                        showPendingDialog = false
                        scope.launch(Dispatchers.IO) {
                            // Mark all as seen without printing
                            val printed = prefs.getStringSet("printed_orders", emptySet())!!.toMutableSet()
                            pendingOrders.forEach { printed.add(it.id) }
                            prefs.edit().putStringSet("printed_orders", printed).apply()
                            withContext(Dispatchers.Main) { launchService(context) }
                        }
                    },
                    border = androidx.compose.foundation.BorderStroke(1.dp, Color.Gray),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text("No, omitir", color = Color.Gray, fontWeight = FontWeight.SemiBold)
                }
            },
            containerColor = Color.White,
            shape = RoundedCornerShape(16.dp)
        )
    }

    // Main screen
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(OffWhite)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Spacer(Modifier.height(64.dp))

            Box(
                modifier = Modifier
                    .size(80.dp)
                    .background(Color.Black, CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Text("SR", color = Gold, fontSize = 28.sp, fontWeight = FontWeight.Bold)
            }

            Spacer(Modifier.height(16.dp))

            Text("SRServi", color = Color.Black, fontSize = 32.sp, fontWeight = FontWeight.Bold)
            Text("Auto Print", color = Gold, fontSize = 16.sp, fontWeight = FontWeight.Medium)

            Spacer(Modifier.height(40.dp))

            // PIN Card
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                elevation = CardDefaults.cardElevation(defaultElevation = 4.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier
                        .padding(horizontal = 20.dp, vertical = 16.dp)
                        .fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text("PIN Terminal", color = Color.Gray, fontSize = 12.sp)
                        Spacer(Modifier.height(2.dp))
                        Text(
                            text = if (pin.isNotEmpty()) pin else "No configurado",
                            color = if (pin.isNotEmpty()) Color.Black else Color.Red,
                            fontSize = 22.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                    TextButton(
                        onClick = { pinInput = pin; showPinDialog = true },
                        border = androidx.compose.foundation.BorderStroke(1.5.dp, Gold),
                        shape = RoundedCornerShape(8.dp),
                        colors = ButtonDefaults.textButtonColors(contentColor = Gold)
                    ) {
                        Text("Cambiar", fontWeight = FontWeight.SemiBold)
                    }
                }
            }

            Spacer(Modifier.height(32.dp))

            // Start / Stop Button
            Button(
                onClick = {
                    if (serviceRunning) {
                        context.stopService(Intent(context, OrderPollingService::class.java))
                        serviceRunning = false
                    } else {
                        isChecking = true
                        scope.launch(Dispatchers.IO) {
                            val unprinted = fetchUnprinted(pin, prefs)
                            withContext(Dispatchers.Main) {
                                isChecking = false
                                if (unprinted.isNotEmpty()) {
                                    pendingOrders = unprinted
                                    showPendingDialog = true
                                } else {
                                    launchService(context)
                                }
                            }
                        }
                    }
                },
                enabled = pin.isNotEmpty() && !isChecking,
                shape = RoundedCornerShape(16.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (serviceRunning) Color.Black else Gold,
                    disabledContainerColor = Color(0xFFCCCCCC)
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(64.dp)
            ) {
                if (isChecking) {
                    CircularProgressIndicator(
                        color = Color.Black,
                        modifier = Modifier.size(24.dp),
                        strokeWidth = 2.dp
                    )
                } else {
                    Text(
                        text = if (serviceRunning) "DETENER SERVICIO" else "INICIAR SERVICIO",
                        fontSize = 17.sp,
                        fontWeight = FontWeight.Bold,
                        color = if (serviceRunning) Gold else Color.Black
                    )
                }
            }

            Spacer(Modifier.height(20.dp))

            // Status pill
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier
                    .background(
                        color = if (serviceRunning) Color(0xFFE8F5E9) else Color(0xFFF0F0F0),
                        shape = RoundedCornerShape(50)
                    )
                    .padding(horizontal = 16.dp, vertical = 8.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(8.dp)
                        .background(
                            color = if (serviceRunning) Color(0xFF43A047) else Color.Gray,
                            shape = CircleShape
                        )
                )
                Text(
                    text = if (serviceRunning) "Monitoreando pedidos cada 3 seg" else "Servicio detenido",
                    color = if (serviceRunning) Color(0xFF2E7D32) else Color.Gray,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium
                )
            }
        }

        Text(
            "SRServi © 2026",
            color = Color.LightGray,
            fontSize = 11.sp,
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 16.dp)
        )
    }
}

private fun launchService(context: Context) {
    val intent = Intent(context, OrderPollingService::class.java)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
        context.startForegroundService(intent)
    else
        context.startService(intent)
}

private fun fetchUnprinted(pin: String, prefs: SharedPreferences): List<PendingOrder> {
    return try {
        clearDailyIfNeeded(prefs)

        val conn = URL("https://srservi2.srautomatic.com/api/getCashOrders?pin=$pin")
            .openConnection() as HttpURLConnection
        conn.connectTimeout = 10_000
        conn.readTimeout = 10_000

        val body = try {
            conn.inputStream.bufferedReader().readText()
        } finally {
            conn.disconnect()
        }

        val orders = JSONObject(body).getJSONArray("orders")
        val printed = prefs.getStringSet("printed_orders", emptySet())!!

        (0 until orders.length())
            .map { orders.getJSONObject(it) }
            .filter { it.getString("status") == "pending" && !printed.contains(it.getInt("id").toString()) }
            .map {
                PendingOrder(
                    id = it.getInt("id").toString(),
                    orderNumber = it.getString("order_number"),
                    date = formatDate(it.getString("created_at"))
                )
            }
    } catch (e: Exception) {
        emptyList()
    }
}

private fun clearDailyIfNeeded(prefs: SharedPreferences) {
    val today = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
    if (prefs.getString("last_clear_date", "") != today) {
        prefs.edit()
            .remove("printed_orders")
            .putString("last_clear_date", today)
            .apply()
    }
}

private fun formatDate(iso: String): String = try {
    val inFmt = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault())
    inFmt.timeZone = TimeZone.getTimeZone("UTC")
    val outFmt = SimpleDateFormat("dd/MM/yyyy HH:mm", Locale.getDefault())
    outFmt.format(inFmt.parse(iso)!!)
} catch (e: Exception) {
    iso.take(16).replace("T", " ")
}
