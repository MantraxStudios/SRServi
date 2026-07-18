package com.mantraxstudios.srservipaymentapp

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import android.util.Log
import android.widget.Toast
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import com.mantraxstudios.srservipaymentapp.databinding.ActivityMainBinding
import org.json.JSONArray
import org.json.JSONObject

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding

    companion object {

        private const val TAG = "TUU_TEST"

        // DEV
        private const val TUU_PACKAGE_NAME =
            "com.haulmer.paymentapp.dev"

        // PROD
        // private const val TUU_PACKAGE_NAME =
        //    "com.haulmer.paymentapp"
    }

    private val paymentLauncher:
            ActivityResultLauncher<Intent> =

        registerForActivityResult(
            ActivityResultContracts.StartActivityForResult()
        ) { result ->

            val data = result.data

            when (result.resultCode) {

                Activity.RESULT_OK -> {

                    val resultJson =
                        data?.getStringExtra(
                            "transactionResult"
                        )

                    Log.d(
                        TAG,
                        "RESULT_OK -> $resultJson"
                    )

                    showSuccess(resultJson)
                }

                Activity.RESULT_CANCELED -> {

                    val errorJson =
                        data?.getStringExtra(
                            "transactionResult"
                        )

                    Log.e(
                        TAG,
                        "RESULT_CANCELED -> $errorJson"
                    )

                    if (errorJson.isNullOrEmpty()) {

                        // Sin JSON de error: TUU no pudo inicializar
                        // (hardware no compatible, SDK no instalado,
                        //  terminal no configurado, o usuario presionó Atrás)
                        Log.w(
                            TAG,
                            "Sin transactionResult — posible fallo de hardware/SDK o cancelación manual"
                        )

                        showCancelled()

                    } else {

                        showError(errorJson)
                    }
                }

                else -> {

                    Log.e(
                        TAG,
                        "Resultado desconocido: ${result.resultCode}"
                    )

                    showCancelled()
                }
            }
        }

    override fun onCreate(savedInstanceState: Bundle?) {

        super.onCreate(savedInstanceState)

        binding =
            ActivityMainBinding.inflate(layoutInflater)

        setContentView(binding.root)

        binding.btnPay.setOnClickListener {

            sendPaymentIntent()
        }
    }

    private fun sendPaymentIntent() {

        val amountText =
            binding.etAmount.text
                .toString()
                .trim()

        if (amountText.isEmpty()) {

            Toast.makeText(
                this,
                "Ingresa un monto",
                Toast.LENGTH_SHORT
            ).show()

            return
        }

        val amount =
            amountText.toIntOrNull()

        if (amount == null || amount <= 0) {

            Toast.makeText(
                this,
                "Monto inválido",
                Toast.LENGTH_SHORT
            ).show()

            return
        }

        val method =
            when (
                binding.rgMethod.checkedRadioButtonId
            ) {

                R.id.rbMethodCredit -> 1
                R.id.rbMethodDebit  -> 2

                else -> 0
            }

        // FIX: installmentsQuantity debe ser -1 cuando NO es crédito.
        // Si se envía 0 con método débito, TUU devuelve errorCode 4.
        val installmentsQuantity =
            if (method == 1) 0 else -1

        val payload = JSONObject().apply {

            put("amount", amount)

            // -1 = no usar propina
            put("tip", -1)

            // -1 = no usar cashback (solo aplica a débito si > -1)
            put("cashback", -1)

            put("method", method)

            // FIX: -1 para débito/solicitar; 0+ solo para crédito
            put("installmentsQuantity", installmentsQuantity)

            put("printVoucherOnApp", true)

            // 0 para pruebas; en producción usar 33, 34, 44, 48 o 99
            put("dteType", 0)

            put(
                "extraData",
                JSONObject().apply {

                    put("exemptAmount", 0)

                    put("netAmount", amount)

                    put("sourceName", "SRServiPaymentApp")

                    put("sourceVersion", "1.0.0")

                    put(
                        "customFields",
                        JSONArray().apply {

                            put(
                                JSONObject().apply {

                                    put("name", "Orden")
                                    put("value", "12345")
                                    put("print", true)
                                }
                            )
                        }
                    )
                }
            )
        }

        // IMPORTANTE: se construye un Intent NUEVO con ACTION_SEND y se
        // restringe al paquete de TUU con setPackage(). Así Android resuelve
        // la actividad de TUU que declara el intent-filter para
        // ACTION_SEND + "text/json" (la actividad de pago), en vez de abrir
        // la pantalla de inicio. Usar getLaunchIntentForPackage() apuntaba a
        // la actividad LAUNCHER y por eso el flujo de pago nunca iniciaba.
        val launchIntent = Intent(Intent.ACTION_SEND).apply {

            // Tipo esperado por TUU
            type = "text/json"

            // Restringe la resolución al paquete de TUU
            setPackage(TUU_PACKAGE_NAME)

            // Clave principal usada por TUU para recibir el payload
            putExtra(Intent.EXTRA_TEXT, payload.toString())

            // flags = 0 para que el resultado vuelva correctamente
            flags = 0
        }

        // Verificar que TUU está instalada y puede manejar el intent
        if (launchIntent.resolveActivity(packageManager) == null) {

            Log.e(TAG, "TUU no puede manejar el intent o no está instalada: $TUU_PACKAGE_NAME")

            binding.tvStatus.text =
                "TUU no instalada"

            binding.tvStatus.setTextColor(
                Color.parseColor("#FF9800")
            )

            binding.tvResult.text =
                "No se encontró una app que maneje el pago:\n$TUU_PACKAGE_NAME"

            return
        }

        // Log de diagnóstico — útil para verificar que el intent está bien armado
        Log.d(TAG, "Intent resuelto a: ${launchIntent.resolveActivity(packageManager)}")

        Log.d(
            TAG,
            "Payload enviado:\n${payload.toString(2)}"
        )

        try {

            paymentLauncher.launch(launchIntent)

        } catch (e: Exception) {

            Log.e(TAG, "Error lanzando intent", e)

            binding.tvStatus.text =
                "ERROR AL LANZAR"

            binding.tvStatus.setTextColor(Color.RED)

            binding.tvResult.text =
                e.stackTraceToString()
        }
    }

    private fun showSuccess(resultJson: String?) {

        val json =
            runCatching {
                JSONObject(resultJson ?: "")
            }.getOrDefault(JSONObject())

        val approved =
            json.optBoolean("transactionStatus", false)

        val sequence =
            json.optString("sequenceNumber", "")

        binding.tvStatus.text =
            if (approved) "APROBADO #$sequence"
            else          "RECHAZADO"

        binding.tvStatus.setTextColor(
            if (approved)
                Color.parseColor("#4CAF50")
            else
                Color.parseColor("#F44336")
        )

        binding.tvResult.text = json.toString(2)
    }

    private fun showError(errorJson: String?) {

        val json =
            runCatching {
                JSONObject(errorJson ?: "")
            }.getOrDefault(JSONObject())

        val errorCode =
            json.optString("errorCode", "")

        val errorMessage =
            json.optString("errorMessage", "")

        val errorCodeOnApp =
            json.optString("errorCodeOnApp", "")

        val errorMessageOnApp =
            json.optString("errorMessageOnApp", "")

        binding.tvStatus.text = "ERROR"

        binding.tvStatus.setTextColor(Color.RED)

        binding.tvResult.text =
            """
            errorCode: $errorCode
            
            errorMessage:
            $errorMessage
            
            errorCodeOnApp:
            $errorCodeOnApp
            
            errorMessageOnApp:
            $errorMessageOnApp
            
            JSON completo:
            ${json.toString(2)}
            """.trimIndent()
    }

    private fun showCancelled() {

        binding.tvStatus.text = "CANCELADO"

        binding.tvStatus.setTextColor(
            Color.parseColor("#FF9800")
        )

        binding.tvResult.text =
            "La transacción fue cancelada o TUU no pudo inicializar.\n\n" +
                    "Verificar:\n" +
                    "• Dispositivo es terminal TUU (Sunmi/Kozen)\n" +
                    "• SDK SunmiPayHardwareService instalado ≥ 3.3.96\n" +
                    "• Terminal aprobado y configurado en backoffice\n" +
                    "• App TUU abierta al menos una vez (carga de llaves)\n" +
                    "• Conexión a internet activa"
    }
}