package com.mantraxstudios.srservi.model

import com.google.gson.JsonArray
import com.google.gson.JsonDeserializationContext
import com.google.gson.JsonDeserializer
import com.google.gson.JsonElement
import com.google.gson.JsonParser
import java.lang.reflect.Type

/**
 * Una opción seleccionada (extra o complemento) junto con la categoría/grupo
 * que el administrador definió para ella. Permite que la boleta impresa
 * encabece cada categoría personalizada en vez de un único rótulo genérico.
 */
data class SelectedOption(
    val name: String,
    val group: String = ""
)

/**
 * Deserializa selected_extras_detail / selected_complements_detail. Tolera:
 *   - [{"name":"Queso","group":"Salsas"}]   (formato nuevo del server)
 *   - [{"name":"Queso"}] / ["Queso"]        (sin categoría -> group vacío)
 *   - "[...]"                               (string con JSON dentro)
 */
class SelectedOptionListAdapter : JsonDeserializer<List<SelectedOption>> {
    override fun deserialize(
        json: JsonElement?,
        typeOfT: Type?,
        context: JsonDeserializationContext?
    ): List<SelectedOption> {
        if (json == null || json.isJsonNull) return emptyList()

        val array: JsonArray = when {
            json.isJsonArray -> json.asJsonArray
            json.isJsonPrimitive && json.asJsonPrimitive.isString -> {
                val raw = json.asString.trim()
                if (raw.isEmpty()) return emptyList()
                try {
                    val parsed = JsonParser.parseString(raw)
                    if (parsed.isJsonArray) parsed.asJsonArray else return emptyList()
                } catch (_: Exception) {
                    return listOf(SelectedOption(raw))
                }
            }
            else -> return emptyList()
        }

        val result = ArrayList<SelectedOption>()
        for (el in array) {
            if (el == null || el.isJsonNull) continue
            when {
                el.isJsonPrimitive -> {
                    val s = el.asString.trim()
                    if (s.isNotEmpty()) result.add(SelectedOption(s))
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
                    if (name.isEmpty()) continue
                    val groupEl = when {
                        obj.has("group") && !obj.get("group").isJsonNull -> obj.get("group")
                        obj.has("group_name") && !obj.get("group_name").isJsonNull -> obj.get("group_name")
                        obj.has("category") && !obj.get("category").isJsonNull -> obj.get("category")
                        obj.has("category_name") && !obj.get("category_name").isJsonNull -> obj.get("category_name")
                        else -> null
                    }
                    val group = groupEl?.asString?.trim().orEmpty()
                    result.add(SelectedOption(name, group))
                }
            }
        }
        return result
    }
}
