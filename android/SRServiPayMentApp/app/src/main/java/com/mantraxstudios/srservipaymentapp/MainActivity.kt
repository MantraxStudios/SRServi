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
import org.json.JSONObject

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding

    companion object {
        private const val TAG = "TUU_TEST"
        private const val TUU_DEV = "com.haulmer.paymentapp.dev"
    }

    // Registrar en la Activity, tal como indica la documentación TUU
    private val paymentLauncher: ActivityResultLauncher<Intent> = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        // NO llamar result.data.toString() — puede crashear si TUU incluye Parcelables desconocidos
        Log.d(TAG, "=== RESULTADO ===  resultCode=${result.resultCode}  dataIsNull=${result.data == null}")
        Toast.makeText(this, "TUU respondió — código: ${result.resultCode}", Toast.LENGTH_LONG).show()
        handlePaymentResult(result.resultCode, result.data)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
        setSupportActionBar(binding.toolbar)

        binding.btnPay.setOnClickListener { sendPaymentIntent() }
    }

    private fun sendPaymentIntent() {
        if (isFinishing || isDestroyed) return

        val amountStr = binding.etAmount.text?.toString()?.trim()
        if (amountStr.isNullOrEmpty()) {
            Toast.makeText(this, "Ingresa un monto", Toast.LENGTH_SHORT).show()
            return
        }
        val amount = amountStr.toIntOrNull()
        if (amount == null || amount <= 0) {
            Toast.makeText(this, "Monto inválido", Toast.LENGTH_SHORT).show()
            return
        }

        val method = when (binding.rgMethod.checkedRadioButtonId) {
            R.id.rbMethodCredit -> 1
            R.id.rbMethodDebit -> 2
            else -> 0
        }
        // tip=0 → TUU pregunta propina en el terminal (requerido cuando el terminal tiene tips activos)
        // tip=-1 solo funciona si TUU tiene tips deshabilitados en back office
        val tip = 0

        val payload = JSONObject().apply {
            put("amount", amount)
            put("tip", tip)
            put("cashback", -1)
            put("method", method)
            put("installmentsQuantity", 0)
            put("printVoucherOnApp", true)
            put("dteType", 99)
            put("extraData", JSONObject().apply {
                put("sourceName", "SRServiPayMentApp")
                put("sourceVersion", "1.0.0")
            })
        }

        Log.d(TAG, "=== INICIANDO PAGO ===")
        Log.d(TAG, "payload: $payload")

        val pm = packageManager
        if (pm == null) {
            Log.e(TAG, "PackageManager no disponible")
            return
        }

        val sendIntent = pm.getLaunchIntentForPackage(TUU_DEV)
        Log.d(TAG, "getLaunchIntentForPackage($TUU_DEV) = $sendIntent")

        if (sendIntent == null) {
            Log.e(TAG, "TUU DEV no encontrada")
            Toast.makeText(this, "TUU DEV no instalada ($TUU_DEV)", Toast.LENGTH_LONG).show()
            binding.tvStatus.text = "TUU DEV no instalada"
            binding.tvStatus.setTextColor(Color.parseColor("#FF9800"))
            binding.tvResult.text = "Paquete no encontrado: $TUU_DEV"
            return
        }

        Log.d(TAG, "Component TUU: ${sendIntent.component}")
        Toast.makeText(this, "TUU encontrada — lanzando...", Toast.LENGTH_SHORT).show()

        // Exactamente como muestra la documentación TUU
        sendIntent.action = Intent.ACTION_SEND
        sendIntent.flags = 0
        sendIntent.putExtra(Intent.EXTRA_TEXT, payload.toString())
        sendIntent.type = "text/json"

        Log.d(TAG, "Intent final: $sendIntent")

        try {
            paymentLauncher.launch(sendIntent)
        } catch (e: Exception) {
            Log.e(TAG, "Error al lanzar TUU: ${e.message}", e)
            Toast.makeText(this, "Error: ${e.message}", Toast.LENGTH_LONG).show()
            binding.tvStatus.text = "Error al lanzar"
            binding.tvStatus.setTextColor(Color.parseColor("#FF9800"))
            binding.tvResult.text = e.toString()
        }
    }

    private fun handlePaymentResult(resultCode: Int, data: Intent?) {
        if (isFinishing || isDestroyed) return

        // getStringExtra puede crashear si el Bundle de TUU tiene Parcelables desconocidos
        val rawJson: String? = try {
            data?.getStringExtra("transactionResult")
        } catch (e: Exception) {
            Log.e(TAG, "Error leyendo transactionResult: ${e.javaClass.simpleName}: ${e.message}")
            null
        }
        Log.d(TAG, "rawJson=$rawJson")

        // NO usar data.toString() ni data.extras — pueden deserializar el Bundle y crashear
        val dataDesc = if (data == null) "null" else "Intent presente"
        val formatted = when {
            rawJson.isNullOrBlank() -> "TUU no devolvió 'transactionResult'\n$dataDesc"
            else -> try { JSONObject(rawJson).toString(2) } catch (e: Exception) { rawJson }
        }

        when (resultCode) {
            Activity.RESULT_OK -> {
                val json = if (!rawJson.isNullOrBlank()) {
                    try { JSONObject(rawJson) } catch (e: Exception) { JSONObject() }
                } else JSONObject()

                val approved = json.optBoolean("transactionStatus", false)
                val seq = json.optString("sequenceNumber", "")
                if (approved) {
                    binding.tvStatus.text = if (seq.isNotEmpty()) "APROBADO  #$seq" else "APROBADO"
                    binding.tvStatus.setTextColor(Color.parseColor("#4CAF50"))
                } else {
                    binding.tvStatus.text = "RECHAZADO"
                    binding.tvStatus.setTextColor(Color.parseColor("#F44336"))
                }
            }
            Activity.RESULT_CANCELED -> {
                val json = if (!rawJson.isNullOrBlank()) {
                    try { JSONObject(rawJson) } catch (e: Exception) { JSONObject() }
                } else JSONObject()

                val code = json.optInt("errorCode", -1)
                val msg = json.optString("errorMessage", "sin mensaje")

                binding.tvStatus.text = "CANCELADO  errorCode=$code"
                binding.tvStatus.setTextColor(Color.parseColor("#F44336"))

                Log.d(TAG, "CANCELADO — errorCode=$code  errorMessage=$msg")
                Toast.makeText(this, "Cancelado — errorCode=$code: $msg", Toast.LENGTH_LONG).show()
            }
            else -> {
                binding.tvStatus.text = "Código inesperado: $resultCode"
                binding.tvStatus.setTextColor(Color.parseColor("#FF9800"))
            }
        }

        binding.tvResult.text = formatted
        binding.tvResult.setTextColor(Color.parseColor("#DDDDDD"))
    }
}
