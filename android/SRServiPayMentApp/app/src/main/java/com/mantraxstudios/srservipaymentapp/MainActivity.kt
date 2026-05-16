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
        private const val TUU_PACKAGE_NAME = "com.haulmer.paymentapp.dev"
    }

    // ── Exactamente como muestra la documentación TUU ──
    private val paymentLauncher: ActivityResultLauncher<Intent> = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            val data = result.data
            if (data != null && data.hasExtra("transactionResult")) {
                val resultJson = try { data.getStringExtra("transactionResult") } catch (e: Exception) { null }
                Log.d(TAG, "Resultado OK: $resultJson")
                showSuccess(resultJson)
            }
        } else if (result.resultCode == Activity.RESULT_CANCELED) {
            val data = result.data
            if (data != null && data.hasExtra("transactionResult")) {
                val errorJson = try { data.getStringExtra("transactionResult") } catch (e: Exception) { null }
                Log.e(TAG, "Error: $errorJson")
                showError(errorJson)
            } else {
                Log.w(TAG, "Operación cancelada por el usuario.")
                showCancelled()
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
        setSupportActionBar(binding.toolbar)
        binding.btnPay.setOnClickListener { sendPaymentIntent() }
    }

    // ── Exactamente como muestra la documentación TUU ──
    private fun sendPaymentIntent() {
        if (isFinishing || isDestroyed) {
            Log.d(TAG, "La actividad está finalizando. No se puede enviar el intent.")
            return
        }

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

        // Payload según ejemplo exacto de la documentación TUU
        val payload = JSONObject().apply {
            put("amount", amount)
            put("tip", 0)
            put("cashback", 0)
            put("method", method)
            put("installmentsQuantity", 0)
            put("printVoucherOnApp", true)
            put("dteType", 48)
            put("extraData", JSONObject().apply {
                put("taxIdnValidation", "")
                put("exemptAmount", 0)
                put("netAmount", amount)
                put("sourceName", "SRServiPayMentApp")
                put("sourceVersion", "1.0.0")
            })
        }

        val packageManager = packageManager
        if (packageManager == null) {
            Log.d(TAG, "PackageManager no disponible.")
            return
        }

        val sendIntent = packageManager.getLaunchIntentForPackage(TUU_PACKAGE_NAME)
        if (sendIntent == null) {
            Log.d(TAG, "App TUU Negocio no encontrada: $TUU_PACKAGE_NAME")
            binding.tvStatus.text = "TUU no instalada"
            binding.tvStatus.setTextColor(Color.parseColor("#FF9800"))
            binding.tvResult.text = "Paquete no encontrado:\n$TUU_PACKAGE_NAME"
            return
        }

        sendIntent.action = Intent.ACTION_SEND
        sendIntent.flags = 0
        sendIntent.putExtra(Intent.EXTRA_TEXT, payload.toString())
        sendIntent.type = "text/json"

        Log.d(TAG, "Lanzando TUU con payload: $payload")
        paymentLauncher.launch(sendIntent)
    }

    private fun showSuccess(resultJson: String?) {
        if (isFinishing || isDestroyed) return
        val json = runCatching { JSONObject(resultJson ?: "") }.getOrDefault(JSONObject())
        val approved = json.optBoolean("transactionStatus", false)
        val seq = json.optString("sequenceNumber", "")

        if (approved) {
            binding.tvStatus.text = if (seq.isNotEmpty()) "APROBADO  #$seq" else "APROBADO"
            binding.tvStatus.setTextColor(Color.parseColor("#4CAF50"))
        } else {
            binding.tvStatus.text = "RECHAZADO"
            binding.tvStatus.setTextColor(Color.parseColor("#F44336"))
        }
        binding.tvResult.text = runCatching { JSONObject(resultJson ?: "").toString(2) }.getOrDefault(resultJson ?: "")
        binding.tvResult.setTextColor(Color.parseColor("#DDDDDD"))
    }

    private fun showError(errorJson: String?) {
        if (isFinishing || isDestroyed) return
        val json = runCatching { JSONObject(errorJson ?: "") }.getOrDefault(JSONObject())
        val code = json.optInt("errorCode", -1)
        val msg = json.optString("errorMessage", "")

        binding.tvStatus.text = "ERROR  código $code"
        binding.tvStatus.setTextColor(Color.parseColor("#F44336"))
        binding.tvResult.text = "errorCode: $code\nerrorMessage: $msg\n\n${runCatching { JSONObject(errorJson ?: "").toString(2) }.getOrDefault(errorJson ?: "")}"
        binding.tvResult.setTextColor(Color.parseColor("#DDDDDD"))

        Log.e(TAG, "errorCode=$code  errorMessage=$msg")
    }

    private fun showCancelled() {
        if (isFinishing || isDestroyed) return
        binding.tvStatus.text = "CANCELADO por usuario"
        binding.tvStatus.setTextColor(Color.parseColor("#FF9800"))
        binding.tvResult.text = "El usuario canceló la operación en el terminal TUU."
        binding.tvResult.setTextColor(Color.parseColor("#DDDDDD"))
    }
}
