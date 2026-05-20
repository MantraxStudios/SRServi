package com.mantraxstudios.srservi

import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity

/**
 * Actividad puente transparente para relanzar la app desde background en Android 10+.
 *
 * Android 15+ bloquea dos cosas:
 *   1. Background Activity Launch (BAL) desde un ForegroundService
 *   2. "balDontBringExistingBackgroundTaskStackToFg" — incluso con BAL permitido,
 *      no se puede traer una tarea existente al frente desde background.
 *
 * Solución: esta actividad tiene taskAffinity="" y launchMode="standard",
 * así que siempre crea una tarea NUEVA sin historial previo.
 * Una vez en el foreground, lanza MainActivity normalmente y se destruye.
 */
class RestartBridgeActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        startActivity(
            Intent(this, MainActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            }
        )
        finish()
    }
}
