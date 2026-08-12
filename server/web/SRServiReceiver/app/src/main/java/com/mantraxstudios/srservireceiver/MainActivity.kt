package com.mantraxstudios.srservireceiver

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.mantraxstudios.srservireceiver.ui.theme.SRServiReceiverTheme

class MainActivity : ComponentActivity() {

    private val requestPerms =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
            // Intentamos arrancar igual; el servicio verifica permisos por su cuenta.
            startReceiver()
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            SRServiReceiverTheme {
                Scaffold(modifier = Modifier.fillMaxSize()) { innerPadding ->
                    ReceiverScreen(
                        modifier = Modifier.padding(innerPadding),
                        onStart = { requestPermissionsThenStart() },
                        onStop = { stopReceiver() },
                        onClear = { ReceiverState.clear() }
                    )
                }
            }
        }
    }

    private fun requiredPermissions(): Array<String> {
        val perms = mutableListOf<String>()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            perms.add(Manifest.permission.BLUETOOTH_CONNECT)
            perms.add(Manifest.permission.BLUETOOTH_SCAN)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            perms.add(Manifest.permission.POST_NOTIFICATIONS)
        }
        return perms.toTypedArray()
    }

    private fun requestPermissionsThenStart() {
        val missing = requiredPermissions().filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (missing.isEmpty()) startReceiver()
        else requestPerms.launch(missing.toTypedArray())
    }

    private fun startReceiver() {
        val svc = Intent(this, BluetoothReceiverService::class.java).apply {
            action = BluetoothReceiverService.ACTION_START
        }
        ContextCompat.startForegroundService(this, svc)
    }

    private fun stopReceiver() {
        val svc = Intent(this, BluetoothReceiverService::class.java).apply {
            action = BluetoothReceiverService.ACTION_STOP
        }
        startService(svc)
    }
}

@Composable
private fun ReceiverScreen(
    modifier: Modifier = Modifier,
    onStart: () -> Unit,
    onStop: () -> Unit,
    onClear: () -> Unit
) {
    val status by ReceiverState.status.collectAsState()
    val device by ReceiverState.connectedDevice.collectAsState()
    val messages by ReceiverState.messages.collectAsState()

    val statusText = when (status) {
        ReceiverState.Status.STOPPED -> "Detenido"
        ReceiverState.Status.WAITING -> "Esperando conexión…"
        ReceiverState.Status.CONNECTED -> "Conectado" + (device?.let { " · $it" } ?: "")
    }

    Column(modifier = modifier.fillMaxSize().padding(16.dp)) {
        Text("Receptor Bluetooth", style = MaterialTheme.typography.headlineSmall)
        Spacer(Modifier.height(8.dp))

        Card(modifier = Modifier.fillMaxWidth()) {
            Text(
                text = "Estado: $statusText",
                modifier = Modifier.padding(16.dp),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold
            )
        }

        Spacer(Modifier.height(12.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Button(onClick = onStart, modifier = Modifier.fillMaxWidth(0.5f)) {
                Text("Iniciar")
            }
            OutlinedButton(onClick = onStop, modifier = Modifier.fillMaxWidth()) {
                Text("Detener")
            }
        }

        Spacer(Modifier.height(16.dp))
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text("Datos recibidos", style = MaterialTheme.typography.titleMedium)
            Text(
                text = "Limpiar",
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.clickable(onClick = onClear).padding(4.dp)
            )
        }
        HorizontalDivider()

        LazyColumn(modifier = Modifier.fillMaxSize()) {
            items(messages) { msg ->
                Column(modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp)) {
                    Text(
                        text = msg.time,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.outline
                    )
                    Text(
                        text = msg.text,
                        fontFamily = FontFamily.Monospace,
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
                HorizontalDivider()
            }
        }
    }
}
