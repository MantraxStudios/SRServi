package com.mantraxstudios.srservi.network

import com.google.gson.Gson
import com.mantraxstudios.srservi.model.OrdersResponse
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL

object ApiService {

    private val gson = Gson()
    private const val BASE_URL = "https://srservi2.srautomatic.com/api/store"

    fun fetchOrders(storeCode: String): OrdersResponse? {
        val url = "$BASE_URL/$storeCode/orders"
        val response = httpGet(url)
        return if (response != null) {
            gson.fromJson(response, OrdersResponse::class.java)
        } else {
            null
        }
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
