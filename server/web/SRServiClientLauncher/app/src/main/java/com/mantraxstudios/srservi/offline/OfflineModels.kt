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
    val extras: List<OfflineExtra> = emptyList()
) {
    val outOfStock: Boolean get() = !unlimitedStock && stock <= 0
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

/** Una línea del carrito: producto + cantidad + extras seleccionados. */
data class CartLine(
    val product: OfflineProduct,
    var quantity: Int = 1,
    val extras: List<OfflineExtra> = emptyList()
) {
    /** Identificador estable de la línea (mismo producto + mismos extras se agrupan). */
    val signature: String
        get() = product.id.toString() + "|" + extras.map { it.id }.sorted().joinToString(",")

    val unitPrice: Double get() = product.price + extras.sumOf { it.price }
    val lineTotal: Double get() = unitPrice * quantity
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
