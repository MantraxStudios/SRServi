package com.mantraxstudios.srservipaymentapp

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.os.Bundle
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

    // Registrar el launcher ANTES de que el fragmento entre en STARTED
    private val paymentLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        handlePaymentResult(result.resultCode, result.data)
    }

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
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

        // tip: -1 = sin propina, 0 = preguntar en app
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

        val intent = Intent(Intent.ACTION_SEND).apply {
            setPackage("com.haulmer.paymentapp.dev")
            type = "text/json"
            flags = 0
            putExtra(Intent.EXTRA_TEXT, payload.toString())
        }

        try {
            paymentLauncher.launch(intent)
        } catch (e: Exception) {
            binding.tvStatus.text = "TUU DEV no instalada"
            binding.tvStatus.setTextColor(Color.parseColor("#FF9800"))
            binding.tvResult.text = "Instala la app 'TUU Negocio DEV' (com.haulmer.paymentapp.dev) en el dispositivo.\n\n${e.message}"
        }
    }

    private fun handlePaymentResult(resultCode: Int, data: android.content.Intent?) {
        val rawJson = data?.getStringExtra("transactionResult") ?: "{}"
        val formatted = try {
            JSONObject(rawJson).toString(2)
        } catch (e: Exception) {
            rawJson
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
                val msg = json.optString("errorMessage", "Cancelado")
                binding.tvStatus.text = "ERROR $code: $msg"
                binding.tvStatus.setTextColor(Color.parseColor("#F44336"))
            }
            else -> {
                binding.tvStatus.text = "Resultado desconocido ($resultCode)"
                binding.tvStatus.setTextColor(Color.parseColor("#FF9800"))
            }
        }

        binding.tvResult.text = formatted
        binding.tvResult.setTextColor(Color.parseColor("#DDDDDD"))
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
