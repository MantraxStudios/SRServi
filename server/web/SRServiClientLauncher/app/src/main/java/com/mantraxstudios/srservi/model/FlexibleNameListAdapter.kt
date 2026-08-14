package com.mantraxstudios.srservi.model

import com.google.gson.JsonArray
import com.google.gson.JsonDeserializationContext
import com.google.gson.JsonDeserializer
import com.google.gson.JsonElement
import com.google.gson.JsonParser
import java.lang.reflect.Type

/**
 * Los campos selected_ingredients / selected_extras / selected_complements
 * llegan en distintos formatos segun de donde venga el pedido:
 *   - Items normales del totem:  ["Queso", "Tomate"]            (array de strings)
 *   - Items de combo / dinamicos: [{"id":1,"name":"Queso"}]     (array de objetos)
 *   - Instalaciones antiguas:     "[\"Queso\"]"                  (string con JSON)
 *
 * Antes el modelo esperaba List<String> y, al toparse con objetos, Gson fallaba
 * y dejaba la lista vacia: por eso los extras dinamicos del administrador NO se
 * detectaban ni se imprimian en la comanda. Este adapter normaliza cualquiera
 * de esos formatos a la lista de nombres visibles.
 */
class FlexibleNameListAdapter : JsonDeserializer<List<String>> {
    override fun deserialize(
        json: JsonElement?,
        typeOfT: Type?,
        context: JsonDeserializationContext?
    ): List<String> {
        if (json == null || json.isJsonNull) return emptyList()

        // A veces la columna llega como string con JSON dentro: "[...]"
        val array: JsonArray = when {
            json.isJsonArray -> json.asJsonArray
            json.isJsonPrimitive && json.asJsonPrimitive.isString -> {
                val raw = json.asString.trim()
                if (raw.isEmpty()) return emptyList()
                try {
                    val parsed = JsonParser.parseString(raw)
                    if (parsed.isJsonArray) parsed.asJsonArray else return emptyList()
                } catch (_: Exception) {
                    return listOf(raw)
                }
            }
            else -> return emptyList()
        }

        val result = ArrayList<String>()
        for (el in array) {
            if (el == null || el.isJsonNull) continue
            when {
                el.isJsonPrimitive -> {
                    val s = el.asString.trim()
                    if (s.isNotEmpty()) result.add(s)
                }
                el.isJsonObject -> {
                    val obj = el.asJsonObject
                    val nameEl = when {
                        obj.has("name") && !obj.get("name").isJsonNull -> obj.get("name")
                        obj.has("label") && !obj.get("label").isJsonNull -> obj.get("label")
                        obj.has("title") && !obj.get("title").isJsonNull -> obj.get("title")
                        else -> null
                    }
                    val name = nameEl?.asString?.trim().orEmpty()
                    if (name.isNotEmpty()) result.add(name)
                }
            }
        }
        return result
    }
}
