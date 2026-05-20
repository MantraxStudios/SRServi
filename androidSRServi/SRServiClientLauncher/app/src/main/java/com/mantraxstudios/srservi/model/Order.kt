package com.mantraxstudios.srservi.model

import com.google.gson.annotations.SerializedName

data class OrdersResponse(
    val store: Store,
    @SerializedName("total_orders") val totalOrders: Int,
    val orders: List<Order>
)

data class Store(
    val code: String,
    val name: String
)

data class Order(
    val id: Int,
    @SerializedName("order_number") val orderNumber: String,
    @SerializedName("order_type") val orderType: String,
    val status: String,
    @SerializedName("cash_approved") val cashApproved: Int = 0,
    @SerializedName("payment_process") val paymentProcess: Int = 0,
    val total: Double,
    val subtotal: Double,
    @SerializedName("discount_total") val discountTotal: Double,
    @SerializedName("payment_method") val paymentMethod: String,
    @SerializedName("coupon_code") val couponCode: String?,
    @SerializedName("completed_by_name") val completedByName: String?,
    @SerializedName("created_at") val createdAt: String,
    @SerializedName("table_number") val tableNumber: Int?,
    @SerializedName("service_type") val serviceType: String?,
    @SerializedName("reprint_count") val reprintCount: Int = 0,
    val items: List<OrderItem>
)

data class OrderItem(
    val id: Int,
    @SerializedName("product_id") val productId: Int,
    @SerializedName("product_name") val productName: String,
    val quantity: Int,
    @SerializedName("unit_price") val unitPrice: Double,
    @SerializedName("selected_ingredients") val selectedIngredients: List<String>,
    @SerializedName("selected_extras") val selectedExtras: List<String>
)
