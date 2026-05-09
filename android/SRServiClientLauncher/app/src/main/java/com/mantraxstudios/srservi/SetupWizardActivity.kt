package com.mantraxstudios.srservi

import android.Manifest
import android.app.admin.DevicePolicyManager
import android.app.role.RoleManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.view.View
import android.view.inputmethod.EditorInfo
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.mantraxstudios.srservi.admin.SRServiDeviceAdminReceiver
import com.mantraxstudios.srservi.databinding.ActivitySetupWizardBinding

class SetupWizardActivity : AppCompatActivity() {

    private lateinit var binding: ActivitySetupWizardBinding

    /**
     * Cada paso es OBLIGATORIO. No existe botón de omitir.
     * El usuario no puede avanzar ni salir hasta completarlo.
     *
     * [isDone]   → condición verificable que indica si el paso ya fue cumplido.
     * [execute]  → acción que se lanza al pulsar el botón principal.
     */
    private data class Step(
        val id: String,
        val title: String,
        val description: String,
        val actionLabel: String,
        val icon: String,
        val isDone: (Context) -> Boolean,
        val execute: (SetupWizardActivity) -> Unit
    )

    private val permLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { refresh() }

    private val settingsLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { refresh() }

    private val steps by lazy { buildSteps() }
    private var currentIndex = 0

    // ── Ciclo de vida ────────────────────────────────────────────────────────

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivitySetupWizardBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // Bloquear el gesto de "atrás" en todas las versiones de Android.
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                // Bloqueado — el usuario debe completar TODOS los pasos.
            }
        })

        // El botón "omitir" nunca se muestra — todos los pasos son obligatorios.
        binding.btnSkip.visibility = View.GONE

        binding.btnAction.setOnClickListener {
            steps.getOrNull(currentIndex)?.execute?.invoke(this)
        }

        currentIndex = 0
        refresh()
    }

    override fun onResume() {
        super.onResume()
        // Siempre re-escanear desde el inicio para detectar condiciones que
        // cambiaron después de completar el wizard (ej: launcher reemplazado).
        currentIndex = 0
        refresh()
    }

    @Suppress("OVERRIDE_DEPRECATION")
    override fun onBackPressed() {
        // Bloqueado vía onBackPressedDispatcher, esta rama es solo fallback.
    }

    // ── Lógica del wizard ────────────────────────────────────────────────────

    /** Avanza automáticamente sobre pasos ya cumplidos, luego muestra el siguiente pendiente. */
    private fun refresh() {
        while (currentIndex < steps.size && steps[currentIndex].isDone(this)) {
            currentIndex++
        }
        if (currentIndex >= steps.size) {
            completeSetup()
        } else {
            renderStep(steps[currentIndex])
        }
    }

    private fun renderStep(step: Step) {
        val number = currentIndex + 1
        val total  = steps.size

        binding.tvStepProgress.text = "PASO $number DE $total"
        binding.progressBar.max     = total
        binding.progressBar.progress = number
        binding.tvStepIcon.text        = step.icon
        binding.tvStepTitle.text       = step.title
        binding.tvStepDescription.text = step.description
        binding.btnAction.text         = step.actionLabel

        val isStoreCode = step.id == "store_code"
        binding.ivHowTo.visibility    = if (isStoreCode) View.VISIBLE else View.GONE
        binding.tilStoreCode.visibility = if (isStoreCode) View.VISIBLE else View.GONE

        if (isStoreCode) {
            val saved = prefs().getString("store_code", "")
            if (!saved.isNullOrBlank()) binding.etWizardCode.setText(saved)
            binding.etWizardCode.setOnEditorActionListener { _, actionId, _ ->
                if (actionId == EditorInfo.IME_ACTION_DONE) {
                    steps.getOrNull(currentIndex)?.execute?.invoke(this); true
                } else false
            }
        }
    }

    private fun completeSetup() {
        prefs().edit().putBoolean(KEY_WIZARD_DONE, true).apply()
        startActivity(
            Intent(this, MainActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            }
        )
        finish()
    }

    // ── Helpers de lanzamiento ───────────────────────────────────────────────

    internal fun requestRuntimePermissions(perms: List<String>) {
        permLauncher.launch(perms.toTypedArray())
    }

    internal fun openSettings(intent: Intent) {
        try {
            settingsLauncher.launch(intent)
        } catch (_: Exception) {
            refresh()
        }
    }

    private fun openLauncherSettings() {
        // ── Nivel 1: Device Owner → establece sin ninguna UI ────────────────
        val dpm = getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        val admin = SRServiDeviceAdminReceiver.getComponentName(this)
        if (dpm.isDeviceOwnerApp(packageName)) {
            try {
                val filter = IntentFilter(Intent.ACTION_MAIN).apply {
                    addCategory(Intent.CATEGORY_HOME)
                    addCategory(Intent.CATEGORY_DEFAULT)
                }
                dpm.addPersistentPreferredActivity(
                    admin, filter,
                    ComponentName(packageName, MainActivity::class.java.name)
                )
                refresh()
                return
            } catch (_: Exception) { /* fallthrough */ }
        }

        // ── Nivel 2: RoleManager — modal dentro de la app (Android 10+) ─────
        // Esta es la ÚNICA vía que actualiza isRoleHeld() correctamente.
        // createChooser NO actualiza el rol y por eso el check seguiría fallando.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            try {
                val rm = getSystemService(RoleManager::class.java)
                settingsLauncher.launch(rm.createRequestRoleIntent(RoleManager.ROLE_HOME))
                return
            } catch (_: Exception) { /* fallthrough */ }
        }

        // ── Nivel 3: Android < 10 — chooser nativo ──────────────────────────
        try {
            val homeIntent = Intent(Intent.ACTION_MAIN).apply {
                addCategory(Intent.CATEGORY_HOME)
                addCategory(Intent.CATEGORY_DEFAULT)
            }
            settingsLauncher.launch(
                Intent.createChooser(homeIntent, "Seleccionar lanzador predeterminado")
            )
            return
        } catch (_: Exception) { /* fallthrough */ }

        // ── Nivel 4: último recurso — Settings ──────────────────────────────
        try {
            settingsLauncher.launch(Intent(Settings.ACTION_HOME_SETTINGS))
        } catch (_: Exception) {
            settingsLauncher.launch(Intent(Settings.ACTION_MANAGE_DEFAULT_APPS_SETTINGS))
        }
    }

    private fun prefs() = getSharedPreferences(PREFS, MODE_PRIVATE)

    // ── Construcción de pasos ────────────────────────────────────────────────

    private fun saveStoreCode(): Boolean {
        val code = binding.etWizardCode.text?.toString()?.trim()?.uppercase() ?: ""
        return if (code.isBlank()) {
            Toast.makeText(this, "Ingresa el código de tu tienda", Toast.LENGTH_SHORT).show()
            false
        } else {
            prefs().edit().putString("store_code", code).apply()
            // Also persist in the shared "srservi_prefs" used by MainActivity
            getSharedPreferences("srservi_prefs", MODE_PRIVATE)
                .edit().putString("store_code", code).apply()
            true
        }
    }

    private fun buildSteps(): List<Step> {
        val list = mutableListOf<Step>()

        // ── Paso 0: Código de tienda ─────────────────────────────────────────
        list += Step(
            id          = "store_code",
            title       = "Código de tu tienda",
            description = "Para comenzar a vender necesitas ingresar el código de tu tienda.\n\n" +
                          "Encuéntralo en el panel de administrador → menú lateral → debajo del nombre de tu tienda.",
            actionLabel = "Guardar y continuar",
            icon        = "🏪", // 🏪
            isDone      = { ctx ->
                ctx.getSharedPreferences("srservi_prefs", Context.MODE_PRIVATE)
                    .getString("store_code", "").isNullOrBlank().not()
            },
            execute     = { activity -> if (activity.saveStoreCode()) activity.refresh() }
        )

        // ── Paso 1: Permisos de runtime ──────────────────────────────────────
        val runtimePerms = mutableListOf<String>().apply {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                add(Manifest.permission.BLUETOOTH_CONNECT)
                add(Manifest.permission.BLUETOOTH_SCAN)
            }
            add(Manifest.permission.ACCESS_FINE_LOCATION)
            add(Manifest.permission.CAMERA)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                add(Manifest.permission.POST_NOTIFICATIONS)
                add(Manifest.permission.READ_MEDIA_IMAGES)
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN) {
                add(Manifest.permission.READ_EXTERNAL_STORAGE)
            }
        }

        list += Step(
            id          = "runtime_perms",
            title       = "Permisos de funcionamiento",
            description = "SRServi necesita acceso a:\n\n" +
                          "• Bluetooth — conectar impresora de recibos\n" +
                          "• Ubicación — requerida por Bluetooth en Android\n" +
                          "• Cámara y galería — capturar imágenes desde la app\n" +
                          "• Notificaciones — mantenerse activa monitoreando pedidos",
            actionLabel = "Conceder permisos",
            icon        = "\uD83D\uDD10", // 🔐
            isDone      = { ctx ->
                runtimePerms.all {
                    ContextCompat.checkSelfPermission(ctx, it) == PackageManager.PERMISSION_GRANTED
                }
            },
            execute     = { activity -> activity.requestRuntimePermissions(runtimePerms) }
        )

        // ── Paso 2: Exención de optimización de batería ──────────────────────
        list += Step(
            id          = "battery",
            title       = "Optimización de batería",
            description = "Android puede pausar la app para ahorrar batería, lo que " +
                          "impediría recibir pedidos y reimprimiría de forma incorrecta.\n\n" +
                          "En la pantalla que se abrirá, selecciona \"Sin restricciones\" " +
                          "o \"No optimizar\" para SRServi.",
            actionLabel = "Configurar ahora",
            icon        = "\uD83D\uDD0B", // 🔋
            isDone      = { ctx ->
                (ctx.getSystemService(Context.POWER_SERVICE) as PowerManager)
                    .isIgnoringBatteryOptimizations(ctx.packageName)
            },
            execute     = { activity ->
                activity.openSettings(
                    Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                        data = Uri.parse("package:${activity.packageName}")
                    }
                )
            }
        )

        // ── Paso 3: Auto-inicio del fabricante (solo en dispositivos que aplica) ──
        // No se puede verificar si quedó activado, pero se fuerza al usuario
        // a abrir la pantalla de ajustes. isDone = true una vez que abre la pantalla.
        manufacturerAutoStartIntent()?.let { autoStartIntent ->
            list += Step(
                id          = "autostart",
                title       = "Auto-inicio del fabricante",
                description = "Tu dispositivo tiene ajustes especiales que controlan " +
                              "qué apps pueden iniciarse automáticamente.\n\n" +
                              "Busca \"SRServi\" en la lista y activa su auto-inicio " +
                              "para que la app se reabra sola si es cerrada.",
                actionLabel = "Abrir ajustes de auto-inicio",
                icon        = "\uD83D\uDD04", // 🔄
                isDone      = { ctx ->
                    ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                        .getBoolean("autostart_opened", false)
                },
                execute     = { activity ->
                    // Marcar como abierto ANTES de lanzar (al volver, isDone = true)
                    activity.prefs().edit().putBoolean("autostart_opened", true).apply()
                    activity.openSettings(autoStartIntent)
                }
            )
        }

        // ── Paso 4: Lanzador predeterminado ──────────────────────────────────
        list += Step(
            id          = "launcher",
            title       = "Lanzador predeterminado",
            description = "SRServi debe ser la pantalla de inicio del dispositivo.\n\n" +
                          "Esto es obligatorio para que funcione como punto de autoservicio " +
                          "y para que el botón de inicio siempre regrese a SRServi.\n\n" +
                          "Toca el botón y selecciona SRServi cuando el sistema lo solicite.",
            actionLabel = "Establecer como lanzador",
            icon        = "\uD83C\uDFE0", // 🏠
            isDone      = { ctx -> isDefaultLauncher(ctx) },
            execute     = { activity -> activity.openLauncherSettings() }
        )

        return list
    }

    // ── Companion ────────────────────────────────────────────────────────────

    companion object {
        const val PREFS          = "srservi_setup"
        const val KEY_WIZARD_DONE = "wizard_done"

        /**
         * Retorna true si algún requisito obligatorio no está cumplido.
         * Todos los requisitos son forzosos — no hay forma de omitirlos permanentemente.
         */
        fun isSetupNeeded(context: Context): Boolean {
            val storeCode = context.getSharedPreferences("srservi_prefs", Context.MODE_PRIVATE)
                .getString("store_code", "")
            if (storeCode.isNullOrBlank()) return true

            val runtimePerms = mutableListOf<String>().apply {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    add(Manifest.permission.BLUETOOTH_CONNECT)
                    add(Manifest.permission.BLUETOOTH_SCAN)
                }
                add(Manifest.permission.ACCESS_FINE_LOCATION)
                add(Manifest.permission.CAMERA)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    add(Manifest.permission.POST_NOTIFICATIONS)
                    add(Manifest.permission.READ_MEDIA_IMAGES)
                } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN) {
                    add(Manifest.permission.READ_EXTERNAL_STORAGE)
                }
            }

            if (runtimePerms.any {
                    ContextCompat.checkSelfPermission(context, it) != PackageManager.PERMISSION_GRANTED
                }) return true

            val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
            if (!pm.isIgnoringBatteryOptimizations(context.packageName)) return true

            if (!isDefaultLauncher(context)) return true

            return false
        }

        fun isDefaultLauncher(context: Context): Boolean {
            // Android 10+: RoleManager es la única API confiable.
            // resolveActivity da falsos positivos si la app tiene CATEGORY_HOME
            // en su intent-filter aunque el usuario no la haya elegido como launcher.
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                return try {
                    val rm = context.getSystemService(RoleManager::class.java)
                    rm.isRoleHeld(RoleManager.ROLE_HOME)
                } catch (_: Exception) {
                    // Fallback para dispositivos que no implementen RoleManager correctamente
                    val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
                    val info = context.packageManager.resolveActivity(intent, PackageManager.MATCH_DEFAULT_ONLY)
                    info?.activityInfo?.packageName == context.packageName
                }
            }
            // Android < 10: resolveActivity es el único mecanismo disponible
            val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
            val info   = context.packageManager.resolveActivity(intent, PackageManager.MATCH_DEFAULT_ONLY)
            return info?.activityInfo?.packageName == context.packageName
        }

        /**
         * Intent hacia la pantalla de auto-inicio del fabricante,
         * o null si el fabricante no tiene esta opción conocida.
         */
        fun manufacturerAutoStartIntent(): Intent? {
            val brand        = Build.BRAND.lowercase()
            val manufacturer = Build.MANUFACTURER.lowercase()
            return try {
                when {
                    "xiaomi" in brand || "redmi" in brand || "poco" in brand ||
                    "xiaomi" in manufacturer ->
                        Intent().setComponent(ComponentName(
                            "com.miui.securitycenter",
                            "com.miui.permcenter.autostart.AutoStartManagementActivity"
                        ))
                    "huawei" in brand || "honor" in brand || "huawei" in manufacturer ->
                        Intent().setComponent(ComponentName(
                            "com.huawei.systemmanager",
                            "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"
                        ))
                    "samsung" in brand || "samsung" in manufacturer ->
                        Intent().setComponent(ComponentName(
                            "com.samsung.android.lool",
                            "com.samsung.android.sm.ui.battery.BatteryActivity"
                        ))
                    "oppo" in brand || "realme" in brand || "oppo" in manufacturer ->
                        Intent().setComponent(ComponentName(
                            "com.coloros.safecenter",
                            "com.coloros.safecenter.permission.startup.StartupAppListActivity"
                        ))
                    "vivo" in brand || "vivo" in manufacturer ->
                        Intent().setComponent(ComponentName(
                            "com.vivo.permissionmanager",
                            "com.vivo.permissionmanager.activity.BgStartUpManagerActivity"
                        ))
                    "oneplus" in brand || "oneplus" in manufacturer ->
                        Intent().setComponent(ComponentName(
                            "com.oneplus.security",
                            "com.oneplus.security.chainlaunch.view.ChainLaunchAppListActivity"
                        ))
                    else -> null
                }
            } catch (_: Exception) {
                null
            }
        }
    }
}
