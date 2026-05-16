package com.mantraxstudios.srservipaymentapp

import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.fragment.app.Fragment
import com.mantraxstudios.srservipaymentapp.databinding.FragmentFirstBinding
import org.json.JSONObject

class FirstFragment : Fragment() {

    private var _binding: FragmentFirstBinding? = null
    private val binding get() = _binding!!

    companion object {
        private const val TAG = "TUU_TEST"
        private const val TUU_DEV = "com.haulmer.paymentapp.dev"
    }

    private val paymentLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        Log.d(TAG, "=== RESULTADO RECIBIDO ===")
        Log.d(TAG, "resultCode: ${result.resultCode}")
        Log.d(TAG, "data: ${result.data}")
        Log.d(TAG, "extras: ${result.data?.extras}")
        val raw = result.data?.getStringExtra("transactionResult")
        Log.d(TAG, "transactionResult: $raw")

        Toast.makeText(requireContext(), "TUU respondió — código: ${result.resultCode}", Toast.LENGTH_LONG).show()
        handlePaymentResult(result.resultCode, result.data)
    }

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentFirstBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        binding.btnPay.setOnClickListener { launchPayment() }
    }

    private fun launchPayment() {
        val amountStr = binding.etAmount.text?.toString()?.trim()
        if (amountStr.isNullOrEmpty()) {
            Toast.makeText(requireContext(), "Ingresa un monto", Toast.LENGTH_SHORT).show()
            return
        }
        val amount = amountStr.toIntOrNull()
        if (amount == null || amount <= 0) {
            Toast.makeText(requireContext(), "Monto inválido", Toast.LENGTH_SHORT).show()
            return
        }

        val method = when (binding.rgMethod.checkedRadioButtonId) {
            R.id.rbMethodCredit -> 1
            R.id.rbMethodDebit -> 2
            else -> 0
        }
        val tip = if (binding.rgTip.checkedRadioButtonId == R.id.rbTipPrompt) 0 else -1

        val payload = JSONObject().apply {
            put("amount", amount)
            put("tip", tip)
            put("cashback", -1)
            put("method", method)
            put("installmentsQuantity", 0)
            put("printVoucherOnApp", true)
            put("dteType", 0)
            put("extraData", JSONObject().apply {
                put("sourceName", "SRServiPayMentApp")
                put("sourceVersion", "1.0.0")
            })
        }

        Log.d(TAG, "=== INICIANDO PAGO ===")
        Log.d(TAG, "payload: $payload")

        // Paso 1: buscar la app TUU DEV instalada
        val launchIntent = requireContext().packageManager.getLaunchIntentForPackage(TUU_DEV)
        Log.d(TAG, "getLaunchIntentForPackage($TUU_DEV) = $launchIntent")

        if (launchIntent == null) {
            Log.e(TAG, "TUU DEV NO encontrada en el dispositivo")
            Toast.makeText(requireContext(), "TUU DEV no está instalada ($TUU_DEV)", Toast.LENGTH_LONG).show()
            binding.tvStatus.text = "No instalada"
            binding.tvStatus.setTextColor(Color.parseColor("#FF9800"))
            binding.tvResult.text = "No se encontró: $TUU_DEV\n\nVerifica que la app TUU Negocio DEV esté instalada."
            return
        }

        Log.d(TAG, "TUU encontrada. Component: ${launchIntent.component}")
        Toast.makeText(requireContext(), "TUU DEV encontrada. Lanzando...", Toast.LENGTH_SHORT).show()

        // Paso 2: sobreescribir según documentación TUU
        launchIntent.action = Intent.ACTION_SEND
        launchIntent.flags = 0
        launchIntent.putExtra(Intent.EXTRA_TEXT, payload.toString())
        launchIntent.type = "text/json"

        Log.d(TAG, "Intent final: $launchIntent")

        try {
            paymentLauncher.launch(launchIntent)
            Log.d(TAG, "paymentLauncher.launch() llamado OK")
        } catch (e: Exception) {
            Log.e(TAG, "Error al lanzar: ${e.message}", e)
            Toast.makeText(requireContext(), "Error: ${e.message}", Toast.LENGTH_LONG).show()
            binding.tvStatus.text = "Error al lanzar"
            binding.tvStatus.setTextColor(Color.parseColor("#FF9800"))
            binding.tvResult.text = e.toString()
        }
    }

    private fun handlePaymentResult(resultCode: Int, data: Intent?) {
        val rawJson = data?.getStringExtra("transactionResult") ?: ""
        val formatted = if (rawJson.isNotEmpty()) {
            runCatching { JSONObject(rawJson).toString(2) }.getOrDefault(rawJson)
        } else {
            "(sin datos — data=${data})"
        }

        when (resultCode) {
            Activity.RESULT_OK -> {
                val json = runCatching { JSONObject(rawJson) }.getOrDefault(JSONObject())
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
                val json = runCatching { JSONObject(rawJson) }.getOrDefault(JSONObject())
                val code = json.optInt("errorCode", -1)
                val msg = json.optString("errorMessage", "sin mensaje")
                binding.tvStatus.text = "CANCELADO  errorCode=$code"
                binding.tvStatus.setTextColor(Color.parseColor("#F44336"))

                // Dialog para que sea imposible no verlo
                AlertDialog.Builder(requireContext())
                    .setTitle("TUU RESULT_CANCELED")
                    .setMessage("errorCode: $code\nerrorMessage: $msg\n\nJSON completo:\n$formatted")
                    .setPositiveButton("OK", null)
                    .show()
            }
            else -> {
                binding.tvStatus.text = "Código desconocido: $resultCode"
                binding.tvStatus.setTextColor(Color.parseColor("#FF9800"))
            }
        }

        binding.tvResult.text = formatted.ifEmpty { "(respuesta vacía)" }
        binding.tvResult.setTextColor(Color.parseColor("#DDDDDD"))
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
