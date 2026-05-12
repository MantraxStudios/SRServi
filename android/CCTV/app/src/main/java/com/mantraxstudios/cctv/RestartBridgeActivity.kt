package com.mantraxstudios.cctv

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity

/**
 * Actividad puente transparente para relanzar desde background en Android 14/15+.
 * taskAffinity="" crea una tarea nueva sin historial, evitando el bloqueo
 * "balDontBringExistingBackgroundTaskStackToFg".
 */
class RestartBridgeActivity : ComponentActivity() {
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
