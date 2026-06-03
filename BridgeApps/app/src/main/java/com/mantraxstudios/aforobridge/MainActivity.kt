package com.mantraxstudios.aforobridge

import android.Manifest
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.text.InputType
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.ViewFlipper
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

/**
 * Asistente paso a paso para configurar el contador de aforo.
 * 0) Bienvenida → 1) Sesión → 2) Local → 3) Buscar cámara → 4) Clave cámara → 5) Listo.
 */
class MainActivity : AppCompatActivity() {

    private val ui = CoroutineScope(Dispatchers.Main + SupervisorJob())
    private lateinit var settings: Settings
    private lateinit var api: Api

    private lateinit var flipper: ViewFlipper

    private var stores: List<StoreInfo> = emptyList()
    private var selectedStore: StoreInfo? = null
    private var foundIps: List<String> = emptyList()
    private var selectedIp: String = ""
    private var detectedChannel: String = ""
    private var autoStartOn = true

    private lateinit var loginStatus: TextView
    private lateinit var storeSelector: TextView
    private lateinit var scanStatus: TextView
    private lateinit var ipSelector: TextView
    private lateinit var camUser: EditText
    private lateinit var camPass: EditText
    private lateinit var testStatus: TextView
    private lateinit var finishStatus: TextView

    private val bg = Color.parseColor("#121212")
    private val card = Color.parseColor("#1C1C1E")
    private val input = Color.parseColor("#262629")
    private val gold = Color.parseColor("#D4AF37")
    private val muted = Color.parseColor("#9A9A9F")
    private val green = Color.parseColor("#50DC78")
    private val red = Color.parseColor("#F06464")

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        supportActionBar?.hide()
        settings = Settings(this)
        api = Api(settings.serverUrl)
        requestNotifPermission()

        selectedIp = settings.camIp
        detectedChannel = settings.camChannel
        autoStartOn = settings.autoStart

        flipper = ViewFlipper(this).apply {
            layoutParams = FrameLayout.LayoutParams(MATCH, MATCH)
            setBackgroundColor(bg)
        }
        flipper.addView(stepWelcome())
        flipper.addView(stepLogin())
        flipper.addView(stepStore())
        flipper.addView(stepScan())
        flipper.addView(stepCamera())
        flipper.addView(stepFinish())
        setContentView(flipper)

        if (settings.isConfigured) go(5)
        observeServiceState()
    }

    private fun go(i: Int) {
        flipper.displayedChild = i
        if (i == 2) refreshStoreSelector()
        if (i == 4) { camUser.setText(settings.camUser); camPass.setText(settings.camPass) }
    }

    // ── Paso 0 · Bienvenida ──────────────────────────────────────────────────
    private fun stepWelcome(): View = page {
        it.addView(title("Bienvenido 👋"))
        it.addView(subtitle("Vamos a conectar tu cámara para contar el aforo de tu local. Te guío paso a paso."))
        it.addView(space(20))
        it.addView(infoCard("Necesitarás:\n• Tu correo y clave de SRServi\n• Tu cámara IP encendida en la misma red Wi-Fi\n• El usuario y clave de la cámara"))
        it.addView(space(24))
        it.addView(primaryButton("Empezar") { go(1) })
    }

    // ── Paso 1 · Sesión ──────────────────────────────────────────────────────
    private fun stepLogin(): View {
        val email = inputField("Tu correo", false).also { it.setText(settings.email) }
        val pass = inputField("Tu contraseña", true).also { it.setText(settings.password) }
        loginStatus = hint("")
        return page {
            it.addView(stepTag("Paso 1 de 5"))
            it.addView(title("Inicia sesión"))
            it.addView(subtitle("Con tu cuenta de SRServi."))
            it.addView(space(12))
            it.addView(label("Correo")); it.addView(email)
            it.addView(label("Contraseña")); it.addView(pass)
            it.addView(space(6)); it.addView(loginStatus); it.addView(space(8))
            it.addView(primaryButton("Entrar") {
                settings.email = email.text.toString().trim()
                settings.password = pass.text.toString()
                doLogin()
            })
            it.addView(secondaryButton("Atrás") { go(0) })
        }
    }

    private fun doLogin() {
        loginStatus.setTextColor(muted); loginStatus.text = "Conectando…"
        ui.launch {
            try {
                api.setBaseUrl(settings.serverUrl)
                val res = api.login(settings.email, settings.password)
                stores = api.getStores()
                loginStatus.setTextColor(green)
                loginStatus.text = "✓ ¡Hola, ${res.userName}!"
                go(2)
            } catch (e: Exception) {
                loginStatus.setTextColor(red)
                loginStatus.text = "✗ ${e.message}"
            }
        }
    }

    // ── Paso 2 · Local ───────────────────────────────────────────────────────
    private fun stepStore(): View {
        storeSelector = selector("Toca para elegir") { showStoreChooser() }
        return page {
            it.addView(stepTag("Paso 2 de 5"))
            it.addView(title("¿Qué local?"))
            it.addView(subtitle("Elige la tienda donde está la cámara."))
            it.addView(space(12))
            it.addView(label("Local")); it.addView(storeSelector)
            it.addView(space(20))
            it.addView(primaryButton("Siguiente") {
                val st = selectedStore ?: run { toast("Elige un local"); return@primaryButton }
                settings.storeId = st.id; settings.storeName = st.name
                go(3)
            })
            it.addView(secondaryButton("Atrás") { go(1) })
        }
    }

    private fun refreshStoreSelector() {
        if (selectedStore == null && stores.isNotEmpty())
            selectedStore = stores.firstOrNull { it.id == settings.storeId } ?: stores.first()
        storeSelector.text = selectedStore?.name ?: "Toca para elegir"
    }

    private fun showStoreChooser() {
        if (stores.isEmpty()) { toast("Inicia sesión primero"); return }
        val names = stores.map { it.name }.toTypedArray()
        AlertDialog.Builder(this)
            .setTitle("Elige tu local")
            .setItems(names) { _, w -> selectedStore = stores[w]; storeSelector.text = stores[w].name }
            .show()
    }

    // ── Paso 3 · Buscar cámara ───────────────────────────────────────────────
    private fun stepScan(): View {
        scanStatus = hint("")
        ipSelector = selector("Aún no hay cámaras") { showIpChooser() }
        return page {
            it.addView(stepTag("Paso 3 de 5"))
            it.addView(title("Busca tu cámara"))
            it.addView(subtitle("Buscaré las cámaras conectadas a tu red Wi-Fi."))
            it.addView(space(16))
            it.addView(primaryButton("🔍  Buscar mi cámara") { doScan() })
            it.addView(space(8)); it.addView(scanStatus); it.addView(space(8))
            it.addView(label("Tu cámara")); it.addView(ipSelector)
            it.addView(space(20))
            it.addView(primaryButton("Siguiente") {
                if (selectedIp.isBlank()) { toast("Busca y elige tu cámara"); return@primaryButton }
                settings.camIp = selectedIp
                go(4)
            })
            it.addView(secondaryButton("Atrás") { go(2) })
        }
    }

    private fun doScan() {
        scanStatus.setTextColor(muted); scanStatus.text = "Buscando cámaras en tu red…"
        ui.launch {
            val found = NetworkScanner.scan(554) { done, total ->
                if (done % 25 == 0 || done == total)
                    ui.launch { scanStatus.text = "Buscando… ${done * 100 / total}%" }
            }
            foundIps = found
            if (found.isNotEmpty()) {
                selectedIp = found.firstOrNull { it == settings.camIp } ?: found.first()
                ipSelector.text = selectedIp
                scanStatus.setTextColor(green)
                scanStatus.text = if (found.size == 1) "✓ 1 cámara encontrada"
                                  else "✓ ${found.size} cámaras encontradas — elige la tuya"
            } else {
                scanStatus.setTextColor(Color.parseColor("#F0B45A"))
                scanStatus.text = "No encontré cámaras. Toca para escribir la IP a mano."
            }
        }
    }

    private fun showIpChooser() {
        if (foundIps.isEmpty()) { manualIpDialog(); return }
        val items = (foundIps + "✏ Escribir IP manualmente").toTypedArray()
        AlertDialog.Builder(this)
            .setTitle("Elige tu cámara")
            .setItems(items) { _, w ->
                if (w == foundIps.size) manualIpDialog()
                else { selectedIp = foundIps[w]; ipSelector.text = selectedIp }
            }.show()
    }

    private fun manualIpDialog() {
        val et = inputField("Ej: 192.168.1.10", false)
        et.setText(selectedIp)
        AlertDialog.Builder(this)
            .setTitle("Escribe la IP de la cámara")
            .setView(et)
            .setPositiveButton("OK") { _, _ -> selectedIp = et.text.toString().trim(); ipSelector.text = selectedIp }
            .setNegativeButton("Cancelar", null)
            .show()
    }

    // ── Paso 4 · Clave de la cámara ──────────────────────────────────────────
    private fun stepCamera(): View {
        camUser = inputField("Usuario de la cámara", false)
        camPass = inputField("Contraseña de la cámara", true)
        testStatus = hint("")
        return page {
            it.addView(stepTag("Paso 4 de 5"))
            it.addView(title("Clave de la cámara"))
            it.addView(subtitle("La que creaste en la app de tu cámara (no es tu correo)."))
            it.addView(space(12))
            it.addView(label("Usuario")); it.addView(camUser)
            it.addView(label("Contraseña")); it.addView(camPass)
            it.addView(space(8))
            it.addView(primaryButton("Probar conexión") { doTest() })
            it.addView(space(6)); it.addView(testStatus); it.addView(space(8))
            it.addView(primaryButton("Siguiente") {
                settings.camUser = camUser.text.toString().trim()
                settings.camPass = camPass.text.toString()
                if (detectedChannel.isNotBlank()) settings.camChannel = detectedChannel
                go(5)
            })
            it.addView(secondaryButton("Atrás") { go(3) })
        }
    }

    private fun doTest() {
        settings.camUser = camUser.text.toString().trim()
        settings.camPass = camPass.text.toString()
        settings.camIp = selectedIp
        testStatus.setTextColor(muted); testStatus.text = "Probando… (unos segundos)"
        ui.launch {
            val r = CameraProbe.autoDetect(this@MainActivity, settings, detectedChannel.ifBlank { null })
            if (r.ok) {
                detectedChannel = r.channel ?: "stream1"
                settings.camChannel = detectedChannel
                testStatus.setTextColor(green)
            } else testStatus.setTextColor(red)
            testStatus.text = r.message
        }
    }

    // ── Paso 5 · Listo ───────────────────────────────────────────────────────
    private fun stepFinish(): View {
        finishStatus = hint("")
        val toggle = toggleRow("Encender solo al prender el teléfono", autoStartOn) { autoStartOn = it }
        return page {
            it.addView(stepTag("Paso 5 de 5"))
            it.addView(title("¡Todo listo! 🎉"))
            it.addView(subtitle("Tu teléfono contará el aforo y lo enviará a tu panel automáticamente."))
            it.addView(space(16))
            it.addView(toggle)
            it.addView(space(16))
            it.addView(primaryButton("Guardar y empezar") { saveAndStart() })
            it.addView(space(10)); it.addView(finishStatus); it.addView(space(8))
            it.addView(secondaryButton("Detener conteo") { CountingService.stop(this) })
            it.addView(secondaryButton("Editar configuración") { go(1) })
        }
    }

    private fun saveAndStart() {
        if (!settings.isConfigured) { toast("Faltan datos. Revisa los pasos anteriores."); return }
        settings.autoStart = autoStartOn
        requestNotifPermission()
        CountingService.start(this)
        finishStatus.setTextColor(gold)
        finishStatus.text = "Iniciando conteo en segundo plano…"
    }

    private fun observeServiceState() {
        ui.launch {
            CountingService.status.collectLatest { st ->
                if (::finishStatus.isInitialized && flipper.displayedChild == 5) {
                    val inN = CountingService.countIn.value
                    val outN = CountingService.countOut.value
                    finishStatus.setTextColor(if (st == "Contando") green else gold)
                    finishStatus.text = "$st · Entradas $inN · Salidas $outN"
                }
            }
        }
    }

    // ── Constructores de UI ──────────────────────────────────────────────────
    private val MATCH = ViewGroup.LayoutParams.MATCH_PARENT
    private val WRAP = ViewGroup.LayoutParams.WRAP_CONTENT
    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()

    private fun page(build: (LinearLayout) -> Unit): View {
        val content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(24), dp(36), dp(24), dp(28))
        }
        build(content)
        return ScrollView(this).apply {
            layoutParams = FrameLayout.LayoutParams(MATCH, MATCH)
            setBackgroundColor(bg)
            addView(content)
        }
    }

    private fun lp(h: Int = WRAP, topMargin: Int = 0) =
        LinearLayout.LayoutParams(MATCH, h).apply { setMargins(0, dp(topMargin), 0, 0) }

    private fun title(t: String) = TextView(this).apply {
        text = t; setTextColor(Color.WHITE); textSize = 24f
        setTypeface(typeface, Typeface.BOLD); layoutParams = lp(topMargin = 4)
    }

    private fun subtitle(t: String) = TextView(this).apply {
        text = t; setTextColor(muted); textSize = 14f; layoutParams = lp(topMargin = 6)
    }

    private fun stepTag(t: String) = TextView(this).apply {
        text = t; setTextColor(gold); textSize = 12f
        setTypeface(typeface, Typeface.BOLD); layoutParams = lp()
    }

    private fun label(t: String) = TextView(this).apply {
        text = t; setTextColor(muted); textSize = 12f; layoutParams = lp(topMargin = 12)
    }

    private fun hint(t: String) = TextView(this).apply {
        text = t; setTextColor(muted); textSize = 13f; layoutParams = lp(topMargin = 4)
    }

    private fun space(h: Int) = View(this).apply { layoutParams = lp(dp(h)) }

    private fun infoCard(t: String) = TextView(this).apply {
        text = t; setTextColor(Color.parseColor("#D8D8DC")); textSize = 14f
        setPadding(dp(16), dp(16), dp(16), dp(16))
        background = rounded(card, 14); layoutParams = lp(topMargin = 8)
    }

    private fun inputField(hint: String, password: Boolean) = EditText(this).apply {
        this.hint = hint
        setHintTextColor(muted); setTextColor(Color.WHITE); textSize = 16f
        setPadding(dp(14), dp(12), dp(14), dp(12))
        background = rounded(input, 10)
        inputType = if (password) InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
                    else InputType.TYPE_CLASS_TEXT
        layoutParams = lp(dp(48), topMargin = 4)
    }

    private fun selector(placeholder: String, onClick: () -> Unit) = TextView(this).apply {
        text = placeholder; setTextColor(Color.WHITE); textSize = 16f
        setPadding(dp(14), dp(14), dp(14), dp(14))
        background = rounded(input, 10); layoutParams = lp(topMargin = 4)
        setOnClickListener { onClick() }
    }

    private fun primaryButton(t: String, onClick: () -> Unit) = Button(this).apply {
        text = t; setTextColor(Color.BLACK); textSize = 16f
        setTypeface(typeface, Typeface.BOLD); isAllCaps = false
        background = rounded(gold, 12); stateListAnimator = null
        layoutParams = lp(dp(52), topMargin = 12)
        setOnClickListener { onClick() }
    }

    private fun secondaryButton(t: String, onClick: () -> Unit) = Button(this).apply {
        text = t; setTextColor(muted); textSize = 14f; isAllCaps = false
        background = rounded(Color.parseColor("#2A2A2E"), 10); stateListAnimator = null
        layoutParams = lp(dp(46), topMargin = 8)
        setOnClickListener { onClick() }
    }

    private fun toggleRow(text: String, initial: Boolean, onChange: (Boolean) -> Unit): View {
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            background = rounded(card, 14)
            setPadding(dp(16), dp(14), dp(16), dp(14))
            layoutParams = lp(topMargin = 8)
        }
        val sw = androidx.appcompat.widget.SwitchCompat(this).apply {
            isChecked = initial
            setOnCheckedChangeListener { _, b -> onChange(b) }
        }
        val lbl = TextView(this).apply {
            this.text = text; setTextColor(Color.WHITE); textSize = 15f
            layoutParams = LinearLayout.LayoutParams(0, WRAP, 1f)
        }
        row.addView(lbl); row.addView(sw)
        return row
    }

    private fun rounded(color: Int, radius: Int) = GradientDrawable().apply {
        setColor(color); cornerRadius = dp(radius).toFloat()
    }

    private fun toast(t: String) =
        android.widget.Toast.makeText(this, t, android.widget.Toast.LENGTH_SHORT).show()

    private fun requestNotifPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
            != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.POST_NOTIFICATIONS), 7)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        ui.cancel()
    }
}
