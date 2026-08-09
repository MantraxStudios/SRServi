package com.mantraxstudios.srservi.offline

import com.google.gson.annotations.SerializedName
import java.text.DecimalFormat
import java.text.DecimalFormatSymbols
import java.util.Locale

/**
 * Modelos de datos para el Modo Offline.
 *
 * Se descargan desde el servidor (endpoints públicos `/api/public/<code>` y
 * `/api/public/<code>/pos-terminals`) al abrir el modo offline y se cachean en
 * disco. A partir de ahí la venta funciona sin conexión al servidor SRServi;
 * el cobro se envía directamente a la API del proveedor (Mercado Pago, SumUp,
 * TUU, Square…) usando las credenciales que vienen en cada terminal.
 */

data class PublicStoreResponse(
    val store: StoreInfo? = null,
    val products: List<OfflineProduct> = emptyList(),
    val categories: List<OfflineCategory> = emptyList()
)

data class StoreInfo(
    val id: Int = 0,
    val code: String = "",
    val name: String = "",
    @SerializedName("currency_symbol") val currencySymbol: String = "$",
    @SerializedName("currency_code") val currencyCode: String = "USD",
    @SerializedName("hide_decimals") val hideDecimals: Boolean = false,
    @SerializedName("logo_url") val logoUrl: String? = null,
    @SerializedName("accent_color") val accentColor: String? = null
)

data class OfflineCategory(
    val id: Int = 0,
    val name: String = ""
)

data class OfflineExtra(
    val id: Int = 0,
    val name: String = "",
    val price: Double = 0.0
)

/** Ingrediente del producto. Los `includedByDefault` van pre-marcados y son gratis. */
data class OfflineIngredient(
    val id: Int = 0,
    val name: String = "",
    val price: Double = 0.0,
    @SerializedName("included_by_default") val includedByDefault: Boolean = false
)

/** Opción de un grupo de complementos dinámico. */
data class ComplementOption(
    val id: Int = 0,
    val name: String = "",
    val price: Double = 0.0,
    val image: String? = null
)

/** Grupo de complementos dinámico (sección personalizada) con reglas min/max. */
data class ComplementGroup(
    val id: Int = 0,
    val name: String = "",
    @SerializedName("min_select") val minSelect: Int = 0,
    @SerializedName("max_select") val maxSelect: Int = 0, // 0 = sin límite
    val required: Boolean = false,
    val options: List<ComplementOption> = emptyList()
)

/** Complemento seleccionado dentro del carrito. */
data class SelectedComplement(
    val groupId: Int,
    val groupName: String,
    val optionId: Int,
    val name: String,
    val price: Double
)

data class OfflineProduct(
    val id: Int = 0,
    val name: String = "",
    val description: String? = null,
    val price: Double = 0.0,
    val image: String? = null,
    @SerializedName("category_id") val categoryId: Int? = null,
    @SerializedName("category_name") val categoryName: String? = null,
    val stock: Int = 0,
    @SerializedName("unlimited_stock") val unlimitedStock: Boolean = true,
    @SerializedName("has_extras") val hasExtras: Boolean = false,
    @SerializedName("has_ingredients") val hasIngredients: Boolean = false,
    @SerializedName("max_extras") val maxExtras: Int = 0,
    @SerializedName("max_ingredients") val maxIngredients: Int = 0,
    val extras: List<OfflineExtra> = emptyList(),
    val ingredients: List<OfflineIngredient> = emptyList(),
    @SerializedName("complement_groups") val complementGroups: List<ComplementGroup> = emptyList()
) {
    val outOfStock: Boolean get() = !unlimitedStock && stock <= 0

    /** ¿Necesita abrir el modal de configuración (ingredientes/extras/complementos)? */
    val needsConfig: Boolean
        get() = (hasIngredients && ingredients.isNotEmpty()) ||
                (hasExtras && extras.isNotEmpty()) ||
                complementGroups.isNotEmpty()
}

/**
 * Terminal / método de pago configurado en la tienda. `provider` define cómo se
 * procesa el cobro. `api_key` y `device_id` son las credenciales del proveedor.
 */
data class PosTerminal(
    val id: Int = 0,
    val provider: String = "cash",   // cash | mercadopago | sumup | tuu | square | custom
    val name: String = "",
    @SerializedName("api_key") val apiKey: String? = null,
    @SerializedName("device_id") val deviceId: String? = null,
    // Para proveedores tipo "custom": link de API propio configurado en la app.
    @SerializedName("custom_url") val customUrl: String? = null
)

/** Una línea del carrito: producto + cantidad + ingredientes/extras/complementos. */
data class CartLine(
    val product: OfflineProduct,
    var quantity: Int = 1,
    val extras: List<OfflineExtra> = emptyList(),
    val ingredients: List<OfflineIngredient> = emptyList(),   // ingredientes seleccionados
    val complements: List<SelectedComplement> = emptyList()
) {
    /** Identificador estable: mismo producto + mismas selecciones se agrupan. */
    val signature: String
        get() = buildString {
            append(product.id)
            append("|e:"); append(extras.map { it.id }.sorted().joinToString(","))
            append("|i:"); append(ingredients.map { it.id }.sorted().joinToString(","))
            append("|c:"); append(complements.map { it.optionId }.sorted().joinToString(","))
        }

    // Precio = base + ingredientes NO incluidos por defecto + extras + complementos.
    val unitPrice: Double
        get() = product.price +
            ingredients.filter { !it.includedByDefault }.sumOf { it.price } +
            extras.sumOf { it.price } +
            complements.sumOf { it.price }

    val lineTotal: Double get() = unitPrice * quantity

    /** Nombres de ingredientes tal como los imprime el tótem: "Sin X" (quitados) + agregados. */
    fun ingredientLabels(): List<String> {
        val removed = product.ingredients
            .filter { it.includedByDefault && ingredients.none { s -> s.id == it.id } }
            .map { "Sin ${it.name}" }
        val added = ingredients.filter { !it.includedByDefault }.map { it.name }
        return removed + added
    }

    /** Resumen corto de modificadores para la fila del carrito. */
    fun modifierSummary(): String {
        val parts = mutableListOf<String>()
        parts.addAll(ingredientLabels())
        parts.addAll(extras.map { it.name })
        parts.addAll(complements.map { it.name })
        return parts.joinToString(", ")
    }
}

/** Registro local de una venta completada en modo offline. */
data class OfflineSale(
    val clientUid: String,
    val orderNumber: String,
    val storeCode: String,
    val storeId: Int,
    val total: Double,
    val paymentMethod: String,     // cash | card
    val paymentProvider: String,   // cash | mercadopago | sumup | tuu | square | custom
    val terminalId: Int?,
    val createdAt: Long,
    val items: List<SaleItem>,
    var synced: Boolean = false
)

data class SaleItem(
    val productId: Int,
    val productName: String,
    val quantity: Int,
    val unitPrice: Double,
    val extras: List<String> = emptyList()
)

/** Formato de moneda según la config de la tienda. */
object Money {
    fun format(store: StoreInfo?, amount: Double): String {
        val symbol = store?.currencySymbol ?: "$"
        val hideDecimals = store?.hideDecimals ?: false
        val symbols = DecimalFormatSymbols(Locale.getDefault()).apply {
            groupingSeparator = '.'
            decimalSeparator = ','
        }
        val pattern = if (hideDecimals) "#,##0" else "#,##0.00"
        val df = DecimalFormat(pattern, symbols)
        return symbol + df.format(amount)
    }
}
