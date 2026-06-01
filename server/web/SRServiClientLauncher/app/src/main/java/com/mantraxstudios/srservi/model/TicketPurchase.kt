package com.mantraxstudios.srservi.model

import com.google.gson.annotations.SerializedName

data class TicketPurchasesResponse(
    val store: Store,
    val total: Int,
    val purchases: List<TicketPurchase>
)

data class TicketPurchase(
    val id: Int,
    @SerializedName("viewer_code") val viewerCode: String,
    @SerializedName("qr_url") val qrUrl: String,
    @SerializedName("event_name") val eventName: String?,
    @SerializedName("show_time") val showTime: String?,
    @SerializedName("total_amount") val totalAmount: Double,
    @SerializedName("paid_at") val paidAt: String,
    val items: List<TicketPurchaseItem>
)

data class TicketPurchaseItem(
    @SerializedName("category_name") val categoryName: String,
    val quantity: Int,
    @SerializedName("unit_price") val unitPrice: Double
)
