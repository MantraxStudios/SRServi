package com.mantraxstudios.srservi.network

import com.google.gson.Gson
import com.mantraxstudios.srservi.model.OrdersResponse
import com.mantraxstudios.srservi.model.TicketPurchasesResponse
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL

data class PlanInfo(val planName: String, val maxPrinters: Int)

object ApiService {

    private val gson = Gson()
    private const val BASE_URL = "https://srservi3.srautomatic.com/api/store"
    private const val PUBLIC_URL = "https://srservi3.srautomatic.com/api/public"

    fun fetchOrders(storeCode: String): OrdersResponse? {
        val url = "$BASE_URL/$storeCode/orders"
        val response = httpGet(url)
        return if (response != null) gson.fromJson(response, OrdersResponse::class.java) else null
    }

    fun fetchTicketPurchases(storeCode: String): TicketPurchasesResponse? {
        val url = "$BASE_URL/$storeCode/ticket-purchases"
        val response = httpGet(url)
        return if (response != null) gson.fromJson(response, TicketPurchasesResponse::class.java) else null
    }

    fun fetchPlanInfo(storeCode: String): PlanInfo? {
        val url = "$PUBLIC_URL/$storeCode/plan-info"
        val response = httpGet(url)
        return if (response != null) {
            try { gson.fromJson(response, PlanInfo::class.java) } catch (_: Exception) { null }
        } else null
    }

    fun fetchAppVersion(appName: String): String? {
        val url = "https://srservi3.srautomatic.com/api/apps/android/version/$appName"
        val response = httpGet(url) ?: return null
        return try {
            val map = gson.fromJson(response, Map::class.java)
            map["version"] as? String
        } catch (_: Exception) { null }
    }

    private fun httpGet(urlString: String): String? {
        try {
            val url = URL(urlString)
            val connection = url.openConnection() as HttpURLConnection
            connection.requestMethod = "GET"
            connection.connectTimeout = 10000
            connection.readTimeout = 10000
            connection.setRequestProperty("Accept", "application/json")

            if (connection.responseCode == HttpURLConnection.HTTP_OK) {
                val reader = BufferedReader(InputStreamReader(connection.inputStream))
                val response = StringBuilder()
                var line: String?
                while (reader.readLine().also { line = it } != null) {
                    response.append(line)
                }
                reader.close()
                connection.disconnect()
                return response.toString()
            }
            connection.disconnect()
            return null
        } catch (e: Exception) {
            return null
        }
    }
}
