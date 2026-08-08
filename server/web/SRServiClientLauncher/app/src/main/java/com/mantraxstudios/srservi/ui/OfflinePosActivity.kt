package com.mantraxstudios.srservi.ui

import android.app.admin.DevicePolicyManager
import android.content.Context
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.EditText
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.GridLayoutManager
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.imageview.ShapeableImageView
import com.mantraxstudios.srservi.R
import com.mantraxstudios.srservi.SRServiApp
import com.mantraxstudios.srservi.admin.SRServiDeviceAdminReceiver
import com.mantraxstudios.srservi.model.Order
import com.mantraxstudios.srservi.model.OrderItem
import com.mantraxstudios.srservi.offline.CartLine
import com.mantraxstudios.srservi.offline.ImageLoader
import com.mantraxstudios.srservi.offline.Money
import com.mantraxstudios.srservi.offline.OfflineCategory
import com.mantraxstudios.srservi.offline.OfflineExtra
import com.mantraxstudios.srservi.offline.OfflineProduct
import com.mantraxstudios.srservi.offline.OfflineRepository
import com.mantraxstudios.srservi.offline.OfflineSale
import com.mantraxstudios.srservi.offline.PosTerminal
import com.mantraxstudios.srservi.offline.PublicStoreResponse
import com.mantraxstudios.srservi.offline.SaleItem
import com.mantraxstudios.srservi.offline.SalesLog
import com.mantraxstudios.srservi.offline.StoreInfo
import com.mantraxstudios.srservi.payment.OfflinePaymentProcessor

/**
 * POS nativo en Modo Offline.
 *
 * Al abrir descarga (o carga de caché) los datos de la tienda por su código, muestra
 * una grilla de productos, permite armar el carrito, cobrar con el método configurado
 * (Mercado Pago / SumUp / Square vía API, o Efectivo/confirmación manual) y, al aprobarse,
 * imprime por Bluetooth y guarda la venta en local (con sync idempotente al servidor).
 */
class OfflinePosActivity : AppCompatActivity() {

    private lateinit var tvStoreName: TextView
    private lateinit var tvOfflineStatus: TextView
    private lateinit var tvDayTotal: TextView
    private lateinit var ivLogo: ShapeableImageView
    private lateinit var etSearch: EditText
    private lateinit var rvCategories: RecyclerView
    private lateinit var rvProducts: RecyclerView
    private lateinit var progress: ProgressBar
    private lateinit var emptyState: View
    private lateinit var tvCartCount: TextView
    private lateinit var tvCartTotal: TextView

    private var store: StoreInfo? = null
    private var allProducts: List<OfflineProduct> = emptyList()
    private var categories: List<OfflineCategory> = emptyList()
    private var terminals: List<PosTerminal> = emptyList()

    private var selectedCategoryId: Int? = null // null = Todos
    private var searchText: String = ""

    private val cart = mutableListOf<CartLine>()

    private lateinit var productAdapter: ProductAdapter
    private lateinit var categoryAdapter: CategoryAdapter

    private var inLockTask = false

    private fun prefs() = getSharedPreferences("srservi_prefs", Context.MODE_PRIVATE)
    private fun storeCode(): String = prefs().getString("store_code", "")?.trim()?.uppercase() ?: ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        setContentView(R.layout.activity_offline_pos)

        tvStoreName = findViewById(R.id.tvStoreName)
        tvOfflineStatus = findViewById(R.id.tvOfflineStatus)
        tvDayTotal = findViewById(R.id.tvDayTotal)
        ivLogo = findViewById(R.id.ivLogo)
        etSearch = findViewById(R.id.etSearch)
        rvCategories = findViewById(R.id.rvCategories)
        rvProducts = findViewById(R.id.rvProducts)
        progress = findViewById(R.id.progress)
        emptyState = findViewById(R.id.emptyState)
        tvCartCount = findViewById(R.id.tvCartCount)
        tvCartTotal = findViewById(R.id.tvCartTotal)

        productAdapter = ProductAdapter()
        categoryAdapter = CategoryAdapter()

        rvProducts.layoutManager = GridLayoutManager(this, 2)
        rvProducts.adapter = productAdapter
        rvCategories.layoutManager = LinearLayoutManager(this, LinearLayoutManager.HORIZONTAL, false)
        rvCategories.adapter = categoryAdapter

        etSearch.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) {}
            override fun onTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) {}
            override fun afterTextChanged(s: Editable?) {
                searchText = s?.toString()?.trim().orEmpty()
                applyFilter()
            }
        })

        findViewById<ImageButton>(R.id.btnExit).setOnClickListener { promptExit() }
        findViewById<ImageButton>(R.id.btnSync).setOnClickListener { syncFromServer() }
        findViewById<View>(R.id.cartSummary).setOnClickListener { openCartSheet() }
        findViewById<View>(R.id.btnCheckout).setOnClickListener { startCheckout() }

        loadData()
    }

    override fun onResume() {
        super.onResume()
        startKioskLock()
        updateCartUi()
    }

    // ── Carga de datos ────────────────────────────────────────────────────────
    private fun loadData() {
        val cached = OfflineRepository.loadStore(this)
        if (cached != null) {
            applyStoreData(cached)
            // Refresca en segundo plano si hay red
            syncFromServer(silent = true)
        } else {
            syncFromServer()
        }
    }

    private fun syncFromServer(silent: Boolean = false) {
        val code = storeCode()
        if (code.isBlank()) {
            Toast.makeText(this, getString(R.string.sell_no_code), Toast.LENGTH_LONG).show()
            finish()
            return
        }
        if (!silent) { progress.visibility = View.VISIBLE; emptyState.visibility = View.GONE }
        tvOfflineStatus.text = "Sincronizando…"
        Thread {
            val result = OfflineRepository.sync(this, code)
            runOnUiThread {
                progress.visibility = View.GONE
                if (result.success) {
                    OfflineRepository.loadStore(this)?.let { applyStoreData(it) }
                    SalesLog.syncPending(this)
                } else if (!silent) {
                    Toast.makeText(this, "No se pudo descargar: ${result.error ?: ""}", Toast.LENGTH_LONG).show()
                    updateOfflineStatus(fromCache = false)
                }
            }
        }.start()
    }

    private fun applyStoreData(data: PublicStoreResponse) {
        store = data.store
        allProducts = data.products
        terminals = OfflineRepository.loadTerminals(this)

        // Solo categorías que tienen productos
        val usedCatIds = allProducts.mapNotNull { it.categoryId }.toSet()
        categories = data.categories.filter { usedCatIds.contains(it.id) }

        tvStoreName.text = data.store?.name ?: "SRServi"
        val logo = OfflineRepository.imageUrl(data.store?.logoUrl)
        if (logo != null) {
            ivLogo.visibility = View.VISIBLE
            ImageLoader.load(ivLogo, logo, R.drawable.bg_image_placeholder)
        } else {
            ivLogo.visibility = View.GONE
        }

        categoryAdapter.notifyDataSetChanged()
        updateOfflineStatus(fromCache = true)
        applyFilter()
        updateCartUi()
    }

    private fun updateOfflineStatus(fromCache: Boolean) {
        val pending = SalesLog.pendingCount(this)
        val base = "● Modo Offline"
        tvOfflineStatus.text = if (pending > 0) "$base · $pending sin sincronizar" else base
        tvDayTotal.text = "Hoy: " + Money.format(store, SalesLog.todayTotal(this))
    }

    private fun applyFilter() {
        var list = allProducts
        selectedCategoryId?.let { catId -> list = list.filter { it.categoryId == catId } }
        if (searchText.isNotBlank()) {
            list = list.filter { it.name.contains(searchText, ignoreCase = true) }
        }
        productAdapter.submit(list)
        emptyState.visibility = if (list.isEmpty()) View.VISIBLE else View.GONE
    }

    // ── Añadir al carrito ─────────────────────────────────────────────────────
    private fun onProductTap(product: OfflineProduct) {
        if (product.outOfStock) {
            Toast.makeText(this, "Producto agotado", Toast.LENGTH_SHORT).show()
            return
        }
        if (product.hasExtras && product.extras.isNotEmpty()) {
            showExtrasDialog(product)
        } else {
            addToCart(product, emptyList())
        }
    }

    private fun showExtrasDialog(product: OfflineProduct) {
        val extras = product.extras
        val labels = extras.map {
            if (it.price > 0) "${it.name}  (+${Money.format(store, it.price)})" else it.name
        }.toTypedArray()
        val checked = BooleanArray(extras.size)
        AlertDialog.Builder(this)
            .setTitle(product.name)
            .setMultiChoiceItems(labels, checked) { _, which, isChecked -> checked[which] = isChecked }
            .setPositiveButton("Agregar") { _, _ ->
                val selected = extras.filterIndexed { i, _ -> checked[i] }
                addToCart(product, selected)
            }
            .setNegativeButton(R.string.cancel, null)
            .show()
    }

    private fun addToCart(product: OfflineProduct, extras: List<OfflineExtra>) {
        val newLine = CartLine(product, 1, extras)
        val existing = cart.find { it.signature == newLine.signature }
        if (existing != null) existing.quantity++ else cart.add(newLine)
        updateCartUi()
        Toast.makeText(this, "Agregado: ${product.name}", Toast.LENGTH_SHORT).show()
    }

    private fun cartTotal(): Double = cart.sumOf { it.lineTotal }
    private fun cartCount(): Int = cart.sumOf { it.quantity }

    private fun updateCartUi() {
        tvCartCount.text = "🛒 ${cartCount()}"
        tvCartTotal.text = Money.format(store, cartTotal())
        tvDayTotal.text = "Hoy: " + Money.format(store, SalesLog.todayTotal(this))
    }

    // ── Bottom sheet del carrito ──────────────────────────────────────────────
    private var cartSheet: BottomSheetDialog? = null
    private var cartAdapter: CartAdapter? = null
    private var tvSheetTotal: TextView? = null

    private fun openCartSheet() {
        if (cart.isEmpty()) {
            Toast.makeText(this, "El carrito está vacío", Toast.LENGTH_SHORT).show()
            return
        }
        val view = LayoutInflater.from(this).inflate(R.layout.dialog_offline_cart, null)
        val rv = view.findViewById<RecyclerView>(R.id.rvCart)
        tvSheetTotal = view.findViewById(R.id.tvCartSheetTotal)
        rv.layoutManager = LinearLayoutManager(this)
        cartAdapter = CartAdapter()
        rv.adapter = cartAdapter
        tvSheetTotal?.text = Money.format(store, cartTotal())

        view.findViewById<TextView>(R.id.btnClearCart).setOnClickListener {
            cart.clear(); updateCartUi(); cartSheet?.dismiss()
        }
        view.findViewById<View>(R.id.btnSheetCheckout).setOnClickListener {
            cartSheet?.dismiss(); startCheckout()
        }

        cartSheet = BottomSheetDialog(this, R.style.Theme_SRServi_BottomSheet).apply {
            setContentView(view)
            show()
        }
    }

    private fun refreshCartSheet() {
        cartAdapter?.notifyDataSetChanged()
        tvSheetTotal?.text = Money.format(store, cartTotal())
        if (cart.isEmpty()) cartSheet?.dismiss()
    }

    // ── Checkout / cobro ──────────────────────────────────────────────────────
    private fun startCheckout() {
        if (cart.isEmpty()) {
            Toast.makeText(this, "El carrito está vacío", Toast.LENGTH_SHORT).show()
            return
        }
        val methods = buildPaymentMethods()
        val view = LayoutInflater.from(this).inflate(R.layout.dialog_offline_checkout, null)
        view.findViewById<TextView>(R.id.tvCheckoutTotal).text = Money.format(store, cartTotal())
        val rv = view.findViewById<RecyclerView>(R.id.rvPayments)
        rv.layoutManager = LinearLayoutManager(this)

        val dialog = BottomSheetDialog(this, R.style.Theme_SRServi_BottomSheet)
        rv.adapter = PaymentAdapter(methods) { method ->
            dialog.dismiss()
            pay(method)
        }
        dialog.setContentView(view)
        dialog.show()
    }

    /** Métodos de pago = terminales descargados + Efectivo (siempre disponible). */
    private fun buildPaymentMethods(): List<PosTerminal> {
        val list = mutableListOf<PosTerminal>()
        list.add(PosTerminal(id = 0, provider = "cash", name = "Efectivo"))
        list.addAll(terminals)
        return list
    }

    private fun pay(method: PosTerminal) {
        val total = cartTotal()
        if (OfflinePaymentProcessor.isAutoCharge(method.provider)) {
            val progressDialog = AlertDialog.Builder(this)
                .setTitle("Cobrando ${method.name}")
                .setMessage("Conectando con el terminal…")
                .setCancelable(false)
                .create()
            progressDialog.show()

            OfflinePaymentProcessor.process(store ?: StoreInfo(), method, total, "pos", object : OfflinePaymentProcessor.Callback {
                override fun onProgress(message: String) {
                    progressDialog.setMessage(message)
                }
                override fun onResult(result: OfflinePaymentProcessor.PaymentResult) {
                    progressDialog.dismiss()
                    when (result) {
                        is OfflinePaymentProcessor.PaymentResult.Approved -> completeSale(method, "card")
                        is OfflinePaymentProcessor.PaymentResult.Canceled ->
                            Toast.makeText(this@OfflinePosActivity, "Pago cancelado", Toast.LENGTH_LONG).show()
                        is OfflinePaymentProcessor.PaymentResult.Failed ->
                            AlertDialog.Builder(this@OfflinePosActivity)
                                .setTitle("No se pudo cobrar")
                                .setMessage(result.reason)
                                .setPositiveButton("OK", null)
                                .show()
                    }
                }
            })
        } else {
            // Efectivo / TUU / otros → confirmación manual del cajero
            val label = if (method.provider == "cash") "en efectivo" else "en el terminal ${method.name}"
            AlertDialog.Builder(this)
                .setTitle("Confirmar cobro")
                .setMessage("¿Se realizó el cobro $label por ${Money.format(store, total)}?")
                .setPositiveButton("Sí, cobrado") { _, _ ->
                    completeSale(method, if (method.provider == "cash") "cash" else "card")
                }
                .setNegativeButton(R.string.cancel, null)
                .show()
        }
    }

    private fun nextOrderNumber(): String {
        val p = prefs()
        val n = p.getInt("offline_order_seq", 0) + 1
        p.edit().putInt("offline_order_seq", n).apply()
        return "OFF-" + n.toString().padStart(5, '0')
    }

    private fun completeSale(method: PosTerminal, paymentMethod: String) {
        val total = cartTotal()
        val orderNumber = nextOrderNumber()
        val st = store

        // 1) Imprimir por Bluetooth
        val orderItems = cart.map { line ->
            OrderItem(
                id = 0,
                productId = line.product.id,
                productName = line.product.name,
                quantity = line.quantity,
                unitPrice = line.unitPrice,
                selectedExtras = line.extras.map { it.name }
            )
        }
        val order = Order(
            id = 0,
            orderNumber = orderNumber,
            orderType = "pos",
            status = "completed",
            total = total,
            subtotal = total,
            discountTotal = 0.0,
            paymentMethod = paymentMethod,
            couponCode = null,
            completedByName = null,
            createdAt = "",
            tableNumber = null,
            serviceType = "servir",
            items = orderItems
        )
        try {
            (application as SRServiApp).printerManager.addToQueue(order)
        } catch (_: Exception) { }

        // 2) Guardar venta local + intentar sincronizar
        val sale = OfflineSale(
            clientUid = SalesLog.newClientUid(),
            orderNumber = orderNumber,
            storeCode = storeCode(),
            storeId = st?.id ?: 0,
            total = total,
            paymentMethod = paymentMethod,
            paymentProvider = method.provider,
            terminalId = if (method.id > 0) method.id else null,
            createdAt = System.currentTimeMillis(),
            items = cart.map { line ->
                SaleItem(line.product.id, line.product.name, line.quantity, line.unitPrice, line.extras.map { it.name })
            }
        )
        SalesLog.add(this, sale)
        SalesLog.syncPending(this)

        // 3) Feedback y limpiar carrito
        cart.clear()
        updateCartUi()
        updateOfflineStatus(fromCache = true)
        showSaleSuccess(orderNumber, total)
    }

    private fun showSaleSuccess(orderNumber: String, total: Double) {
        val printerOk = try { (application as SRServiApp).printerManager.isConnected() } catch (_: Exception) { false }
        val printMsg = if (printerOk) "🖨️ Enviado a la impresora." else "⚠️ Impresora no conectada (venta guardada igual)."
        AlertDialog.Builder(this)
            .setTitle("✅ Venta registrada")
            .setMessage("Pedido $orderNumber\nTotal: ${Money.format(store, total)}\n\n$printMsg")
            .setPositiveButton("Nueva venta", null)
            .show()
    }

    // ── Salir / kiosco ────────────────────────────────────────────────────────
    private fun promptExit() {
        val input = EditText(this)
        input.inputType = android.text.InputType.TYPE_CLASS_NUMBER or android.text.InputType.TYPE_NUMBER_VARIATION_PASSWORD
        input.hint = "PIN"
        AlertDialog.Builder(this)
            .setTitle("Salir del Modo Offline")
            .setMessage("Ingresa el PIN de administrador")
            .setView(input)
            .setPositiveButton("Salir") { _, _ ->
                if (input.text.toString() == "1234") { stopKioskLock(); finish() }
                else Toast.makeText(this, "PIN incorrecto", Toast.LENGTH_SHORT).show()
            }
            .setNegativeButton(R.string.cancel, null)
            .show()
    }

    private fun startKioskLock() {
        try {
            val dpm = getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
            if (dpm.isDeviceOwnerApp(packageName)) {
                val admin = SRServiDeviceAdminReceiver.getComponentName(this)
                dpm.setLockTaskPackages(admin, arrayOf(packageName))
                if (!inLockTask) { startLockTask(); inLockTask = true }
            }
        } catch (_: Exception) { }
    }

    private fun stopKioskLock() {
        try { if (inLockTask) { stopLockTask(); inLockTask = false } } catch (_: Exception) { }
    }

    override fun onDestroy() {
        stopKioskLock()
        super.onDestroy()
    }

    // ══════════════════════════════ Adapters ══════════════════════════════════

    private inner class ProductAdapter : RecyclerView.Adapter<ProductAdapter.VH>() {
        private var items: List<OfflineProduct> = emptyList()
        fun submit(list: List<OfflineProduct>) { items = list; notifyDataSetChanged() }

        inner class VH(v: View) : RecyclerView.ViewHolder(v) {
            val iv: ImageView = v.findViewById(R.id.ivProduct)
            val name: TextView = v.findViewById(R.id.tvName)
            val price: TextView = v.findViewById(R.id.tvPrice)
            val outOfStock: TextView = v.findViewById(R.id.tvOutOfStock)
        }

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
            val v = LayoutInflater.from(parent.context).inflate(R.layout.item_pos_product, parent, false)
            return VH(v)
        }

        override fun onBindViewHolder(holder: VH, position: Int) {
            val p = items[position]
            holder.name.text = p.name
            holder.price.text = Money.format(store, p.price)
            holder.outOfStock.visibility = if (p.outOfStock) View.VISIBLE else View.GONE
            holder.itemView.alpha = if (p.outOfStock) 0.6f else 1f
            ImageLoader.load(holder.iv, OfflineRepository.imageUrl(p.image), R.drawable.bg_image_placeholder)
            holder.itemView.setOnClickListener { onProductTap(p) }
        }

        override fun getItemCount(): Int = items.size
    }

    private inner class CategoryAdapter : RecyclerView.Adapter<CategoryAdapter.VH>() {
        inner class VH(v: View) : RecyclerView.ViewHolder(v) {
            val chip: TextView = v.findViewById(R.id.tvCategory)
        }

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
            val v = LayoutInflater.from(parent.context).inflate(R.layout.item_pos_category, parent, false)
            return VH(v)
        }

        override fun onBindViewHolder(holder: VH, position: Int) {
            if (position == 0) {
                holder.chip.text = "Todos"
                holder.chip.isSelected = selectedCategoryId == null
                holder.chip.setTextColor(chipTextColor(selectedCategoryId == null))
                holder.chip.setOnClickListener { selectCategory(null) }
            } else {
                val cat = categories[position - 1]
                val isSel = selectedCategoryId == cat.id
                holder.chip.text = cat.name
                holder.chip.isSelected = isSel
                holder.chip.setTextColor(chipTextColor(isSel))
                holder.chip.setOnClickListener { selectCategory(cat.id) }
            }
        }

        override fun getItemCount(): Int = categories.size + 1
    }

    private fun chipTextColor(selected: Boolean): Int =
        if (selected) getColor(R.color.primary_dark) else getColor(R.color.text_primary)

    private fun selectCategory(id: Int?) {
        selectedCategoryId = id
        categoryAdapter.notifyDataSetChanged()
        applyFilter()
    }

    private inner class CartAdapter : RecyclerView.Adapter<CartAdapter.VH>() {
        inner class VH(v: View) : RecyclerView.ViewHolder(v) {
            val name: TextView = v.findViewById(R.id.tvCartName)
            val extras: TextView = v.findViewById(R.id.tvCartExtras)
            val lineTotal: TextView = v.findViewById(R.id.tvCartLineTotal)
            val qty: TextView = v.findViewById(R.id.tvQty)
            val minus: ImageButton = v.findViewById(R.id.btnMinus)
            val plus: ImageButton = v.findViewById(R.id.btnPlus)
        }

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
            val v = LayoutInflater.from(parent.context).inflate(R.layout.item_pos_cart, parent, false)
            return VH(v)
        }

        override fun onBindViewHolder(holder: VH, position: Int) {
            val line = cart[position]
            holder.name.text = line.product.name
            if (line.extras.isNotEmpty()) {
                holder.extras.visibility = View.VISIBLE
                holder.extras.text = line.extras.joinToString(", ") { it.name }
            } else {
                holder.extras.visibility = View.GONE
            }
            holder.qty.text = line.quantity.toString()
            holder.lineTotal.text = Money.format(store, line.lineTotal)
            holder.plus.setOnClickListener {
                line.quantity++
                notifyItemChanged(position)
                updateCartUi(); tvSheetTotal?.text = Money.format(store, cartTotal())
            }
            holder.minus.setOnClickListener {
                if (line.quantity > 1) {
                    line.quantity--
                    notifyItemChanged(position)
                } else {
                    cart.removeAt(position)
                    notifyItemRemoved(position)
                }
                updateCartUi(); refreshCartSheet()
            }
        }

        override fun getItemCount(): Int = cart.size
    }

    private class PaymentAdapter(
        private val methods: List<PosTerminal>,
        private val onClick: (PosTerminal) -> Unit
    ) : RecyclerView.Adapter<PaymentAdapter.VH>() {

        class VH(v: View) : RecyclerView.ViewHolder(v) {
            val icon: TextView = v.findViewById(R.id.tvPayIcon)
            val name: TextView = v.findViewById(R.id.tvPayName)
            val sub: TextView = v.findViewById(R.id.tvPaySub)
        }

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
            val v = LayoutInflater.from(parent.context).inflate(R.layout.item_pos_payment, parent, false)
            return VH(v)
        }

        override fun onBindViewHolder(holder: VH, position: Int) {
            val m = methods[position]
            when (m.provider.lowercase()) {
                "cash" -> { holder.icon.text = "💵"; holder.sub.text = "Confirmación manual" }
                "mercadopago" -> { holder.icon.text = "🟦"; holder.sub.text = "Mercado Pago Point" }
                "sumup" -> { holder.icon.text = "🟩"; holder.sub.text = "SumUp" }
                "square" -> { holder.icon.text = "⬛"; holder.sub.text = "Square Terminal" }
                "tuu" -> { holder.icon.text = "🟪"; holder.sub.text = "TUU (confirmación manual)" }
                else -> { holder.icon.text = "💳"; holder.sub.text = m.provider }
            }
            holder.name.text = m.name.ifBlank { m.provider }
            holder.itemView.setOnClickListener { onClick(m) }
        }

        override fun getItemCount(): Int = methods.size
    }
}
