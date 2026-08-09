package com.mantraxstudios.srservi.ui

import android.content.Context
import android.graphics.Typeface
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.CheckBox
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.mantraxstudios.srservi.R
import com.mantraxstudios.srservi.offline.CartLine
import com.mantraxstudios.srservi.offline.ComplementGroup
import com.mantraxstudios.srservi.offline.ImageLoader
import com.mantraxstudios.srservi.offline.Money
import com.mantraxstudios.srservi.offline.OfflineExtra
import com.mantraxstudios.srservi.offline.OfflineIngredient
import com.mantraxstudios.srservi.offline.OfflineProduct
import com.mantraxstudios.srservi.offline.OfflineRepository
import com.mantraxstudios.srservi.offline.SelectedComplement
import com.mantraxstudios.srservi.offline.StoreInfo

/**
 * Modal de configuración de producto calcado del tótem (Store.jsx openProductModal):
 * ingredientes (con `included_by_default` y `max_ingredients`), extras (con `max_extras`
 * y precio) y grupos de complementos dinámicos (min/max/required). Calcula el precio en
 * vivo y devuelve un [CartLine] listo para el carrito.
 */
object ProductConfigSheet {

    fun show(activity: AppCompatActivity, store: StoreInfo?, product: OfflineProduct, onAdd: (CartLine) -> Unit) {
        val ctx = activity
        val dp = ctx.resources.displayMetrics.density
        fun dp(v: Int) = (v * dp).toInt()

        // Estado de selección
        val selIngredients = product.ingredients.filter { it.includedByDefault }.toMutableList()
        val selExtras = mutableListOf<OfflineExtra>()
        val selComplements = mutableListOf<SelectedComplement>()
        var qty = 1

        // Cajas de complementos por grupo → para poder desmarcar hermanos cuando max=1
        val groupBoxes = HashMap<Int, MutableList<Pair<Int, CheckBox>>>()

        fun unitPrice(): Double = product.price +
            selIngredients.filter { !it.includedByDefault }.sumOf { it.price } +
            selExtras.sumOf { it.price } +
            selComplements.sumOf { it.price }

        // ── Construcción de la vista ──
        val content = LinearLayout(ctx).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(ctx.getColor(R.color.kiosk_bg))
            setPadding(dp(20), dp(16), dp(20), dp(16))
        }

        fun addSectionTitle(text: String, hint: String? = null) {
            content.addView(TextView(ctx).apply {
                this.text = text
                setTextColor(ctx.getColor(R.color.kiosk_dark))
                textSize = 16f
                setTypeface(typeface, Typeface.BOLD)
                setPadding(0, dp(16), 0, dp(2))
            })
            if (!hint.isNullOrBlank()) {
                content.addView(TextView(ctx).apply {
                    this.text = hint
                    setTextColor(ctx.getColor(R.color.kiosk_muted))
                    textSize = 12f
                    setPadding(0, 0, 0, dp(4))
                })
            }
        }

        // Imagen + nombre + descripción
        val img = OfflineRepository.imageUrl(product.image)
        if (img != null) {
            content.addView(ImageView(ctx).apply {
                layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(160))
                scaleType = ImageView.ScaleType.FIT_CENTER
                setBackgroundResource(R.drawable.bg_image_placeholder)
                ImageLoader.load(this, img, R.drawable.bg_image_placeholder)
            })
        }
        content.addView(TextView(ctx).apply {
            text = product.name
            setTextColor(ctx.getColor(R.color.kiosk_dark))
            textSize = 20f
            setTypeface(typeface, Typeface.BOLD)
            setPadding(0, dp(12), 0, 0)
        })
        if (!product.description.isNullOrBlank()) {
            content.addView(TextView(ctx).apply {
                text = product.description
                setTextColor(ctx.getColor(R.color.kiosk_muted))
                textSize = 13f
                setPadding(0, dp(2), 0, 0)
            })
        }

        // Botón de agregar (se define antes para poder actualizar su texto)
        val btnAdd = TextView(ctx).apply {
            gravity = Gravity.CENTER
            setBackgroundResource(R.drawable.bg_pill_accent)
            setTextColor(ctx.getColor(R.color.kiosk_dark))
            textSize = 17f
            setTypeface(typeface, Typeface.BOLD)
            setPadding(0, dp(16), 0, dp(16))
        }
        fun refreshTotal() {
            btnAdd.text = "Agregar · ${Money.format(store, unitPrice() * qty)}"
        }

        fun makeRow(label: String, priceSuffix: String, checked: Boolean, onToggle: (CheckBox, Boolean) -> Unit): CheckBox {
            val box = CheckBox(ctx)
            box.text = if (priceSuffix.isNotBlank()) "$label   $priceSuffix" else label
            box.isChecked = checked
            box.setTextColor(ctx.getColor(R.color.kiosk_dark))
            box.textSize = 15f
            box.setPadding(dp(6), dp(8), 0, dp(8))
            box.buttonTintList = android.content.res.ColorStateList.valueOf(ctx.getColor(R.color.kiosk_orange))
            box.setOnCheckedChangeListener { _, isChecked -> onToggle(box, isChecked) }
            return box
        }

        // ── Ingredientes ──
        if (product.hasIngredients && product.ingredients.isNotEmpty()) {
            val hint = if (product.maxIngredients > 0) "Hasta ${product.maxIngredients}" else null
            addSectionTitle("Ingredientes", hint)
            for (ing in product.ingredients) {
                val suffix = if (!ing.includedByDefault && ing.price > 0) "+${Money.format(store, ing.price)}" else ""
                val row = makeRow(ing.name, suffix, ing.includedByDefault) { cb, isChecked ->
                    if (isChecked) {
                        val max = product.maxIngredients
                        if (max > 0 && selIngredients.size >= max && selIngredients.none { it.id == ing.id }) {
                            cb.isChecked = false
                            Toast.makeText(ctx, "Máximo $max ingredientes", Toast.LENGTH_SHORT).show()
                            return@makeRow
                        }
                        if (selIngredients.none { it.id == ing.id }) selIngredients.add(ing)
                    } else {
                        selIngredients.removeAll { it.id == ing.id }
                    }
                    refreshTotal()
                }
                content.addView(row)
            }
        }

        // ── Extras ──
        if (product.hasExtras && product.extras.isNotEmpty()) {
            val hint = if (product.maxExtras > 0) "Hasta ${product.maxExtras}" else null
            addSectionTitle("Extras", hint)
            for (ex in product.extras) {
                val suffix = if (ex.price > 0) "+${Money.format(store, ex.price)}" else ""
                val row = makeRow(ex.name, suffix, false) { cb, isChecked ->
                    if (isChecked) {
                        val max = product.maxExtras
                        if (max > 0 && selExtras.size >= max && selExtras.none { it.id == ex.id }) {
                            cb.isChecked = false
                            Toast.makeText(ctx, "Máximo $max extras", Toast.LENGTH_SHORT).show()
                            return@makeRow
                        }
                        if (selExtras.none { it.id == ex.id }) selExtras.add(ex)
                    } else {
                        selExtras.removeAll { it.id == ex.id }
                    }
                    refreshTotal()
                }
                content.addView(row)
            }
        }

        // ── Grupos de complementos dinámicos ──
        for (group in product.complementGroups) {
            val hint = buildGroupHint(group)
            addSectionTitle(group.name, hint)
            val boxes = mutableListOf<Pair<Int, CheckBox>>()
            groupBoxes[group.id] = boxes
            for (opt in group.options) {
                val suffix = if (opt.price > 0) "+${Money.format(store, opt.price)}" else ""
                val row = makeRow(opt.name, suffix, false) { cb, isChecked ->
                    if (isChecked) {
                        val inGroup = selComplements.filter { it.groupId == group.id }
                        if (group.maxSelect > 0 && inGroup.size >= group.maxSelect) {
                            if (group.maxSelect == 1) {
                                // Reemplazar: quitar selección previa y desmarcar hermanos
                                selComplements.removeAll { it.groupId == group.id }
                                boxes.forEach { (oid, box) -> if (oid != opt.id && box.isChecked) box.isChecked = false }
                            } else {
                                cb.isChecked = false
                                Toast.makeText(ctx, "Máximo ${group.maxSelect} en ${group.name}", Toast.LENGTH_SHORT).show()
                                return@makeRow
                            }
                        }
                        if (selComplements.none { it.optionId == opt.id }) {
                            selComplements.add(SelectedComplement(group.id, group.name, opt.id, opt.name, opt.price))
                        }
                    } else {
                        selComplements.removeAll { it.optionId == opt.id }
                    }
                    refreshTotal()
                }
                boxes.add(opt.id to row)
                content.addView(row)
            }
        }

        // ── Cantidad ──
        addSectionTitle("Cantidad")
        val tvQty = TextView(ctx).apply {
            text = "1"
            gravity = Gravity.CENTER
            setTextColor(ctx.getColor(R.color.kiosk_dark))
            textSize = 20f
            setTypeface(typeface, Typeface.BOLD)
            layoutParams = LinearLayout.LayoutParams(dp(56), ViewGroup.LayoutParams.WRAP_CONTENT)
        }
        val qtyRow = LinearLayout(ctx).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            val minus = ImageButton(ctx).apply {
                setBackgroundResource(R.drawable.bg_qty_button)
                setImageResource(android.R.drawable.ic_media_previous)
                imageTintList = android.content.res.ColorStateList.valueOf(ctx.getColor(R.color.kiosk_dark))
                layoutParams = LinearLayout.LayoutParams(dp(42), dp(42))
                setOnClickListener {
                    if (qty > 1) { qty--; tvQty.text = qty.toString(); refreshTotal() }
                }
            }
            val plus = ImageButton(ctx).apply {
                setBackgroundResource(R.drawable.bg_qty_button)
                setImageResource(android.R.drawable.ic_media_next)
                imageTintList = android.content.res.ColorStateList.valueOf(ctx.getColor(R.color.kiosk_dark))
                layoutParams = LinearLayout.LayoutParams(dp(42), dp(42))
                setOnClickListener { qty++; tvQty.text = qty.toString(); refreshTotal() }
            }
            addView(minus); addView(tvQty); addView(plus)
        }
        content.addView(qtyRow)

        // ── Botón agregar ──
        btnAdd.apply {
            val lp = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
            lp.topMargin = dp(20)
            layoutParams = lp
        }
        refreshTotal()
        content.addView(btnAdd)

        val scroll = ScrollView(ctx).apply {
            isFillViewport = true
            addView(content)
            // Limitar altura para que sea desplazable en pantallas chicas
            val maxH = (ctx.resources.displayMetrics.heightPixels * 0.88f).toInt()
            layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, maxH)
        }

        val dialog = BottomSheetDialog(ctx, R.style.Theme_SRServi_BottomSheet)
        dialog.setContentView(scroll)

        btnAdd.setOnClickListener {
            // Validar grupos requeridos (min_select)
            for (g in product.complementGroups) {
                val count = selComplements.count { it.groupId == g.id }
                val min = if (g.required) maxOf(1, g.minSelect) else g.minSelect
                if (count < min) {
                    Toast.makeText(ctx, "En \"${g.name}\" elige al menos $min", Toast.LENGTH_LONG).show()
                    return@setOnClickListener
                }
            }
            onAdd(CartLine(product, qty, selExtras.toList(), selIngredients.toList(), selComplements.toList()))
            dialog.dismiss()
        }

        dialog.show()
    }

    private fun buildGroupHint(group: ComplementGroup): String {
        val min = if (group.required) maxOf(1, group.minSelect) else group.minSelect
        return when {
            group.maxSelect == 1 && min >= 1 -> "Elige 1 (obligatorio)"
            group.maxSelect == 1 -> "Elige 1"
            group.maxSelect > 0 && min > 0 -> "Elige entre $min y ${group.maxSelect}"
            group.maxSelect > 0 -> "Hasta ${group.maxSelect}"
            min > 0 -> "Elige al menos $min"
            else -> "Opcional"
        }
    }
}
