import os
import mysql.connector
from datetime import datetime

DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": int(os.getenv("DB_PORT", "3306")),
    "user": os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASSWORD", "@Fam#+234"),
    "database": os.getenv("DB_NAME", "srservi")
}

# Plugin de autenticación opcional (ej: caching_sha2_password, mysql_native_password)
if os.getenv("DB_AUTH_PLUGIN"):
    DB_CONFIG["auth_plugin"] = os.getenv("DB_AUTH_PLUGIN")

def get_conn():
    return mysql.connector.connect(**DB_CONFIG)

def fetch_all(cursor, query, params=()):
    cursor.execute(query, params)
    cols = [d[0] for d in cursor.description]
    return [dict(zip(cols, row)) for row in cursor.fetchall()]

def fetch_one(cursor, query, params=()):
    cursor.execute(query, params)
    cols = [d[0] for d in cursor.description]
    row = cursor.fetchone()
    return dict(zip(cols, row)) if row else None

DAY_ES = {1: "Domingo", 2: "Lunes", 3: "Martes", 4: "Miércoles",
          5: "Jueves", 6: "Viernes", 7: "Sábado"}

def get_store_data(store_id: int) -> dict:
    conn = get_conn()
    cur = conn.cursor()
    data = {}

    try:
        # Nombre de la tienda
        row = fetch_one(cur,
            "SELECT name, currency_symbol FROM stores WHERE id = %s", (store_id,))
        data["store_name"] = row["name"] if row else "tu tienda"
        data["currency"] = row["currency_symbol"] if row else "$"

        # Resumen de ventas — hoy, semana, mes
        for label, interval in [("hoy", "1 DAY"), ("semana", "7 DAY"), ("mes", "30 DAY")]:
            row = fetch_one(cur, f"""
                SELECT COUNT(*) AS pedidos,
                       COALESCE(SUM(CASE WHEN payment_process = 1 AND status NOT IN ('cancelled','canceled') THEN total END), 0) AS ingresos,
                       COALESCE(AVG(CASE WHEN payment_process = 1 AND status NOT IN ('cancelled','canceled') THEN total END), 0) AS ticket_promedio,
                       SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pendientes
                FROM orders
                WHERE store_id = %s AND created_at >= DATE_SUB(NOW(), INTERVAL {interval})
            """, (store_id,))
            data[f"ventas_{label}"] = {
                "pedidos": int(row["pedidos"] or 0),
                "ingresos": float(row["ingresos"] or 0),
                "ticket_promedio": float(row["ticket_promedio"] or 0),
                "pendientes": int(row["pendientes"] or 0)
            }

        # Top productos esta semana
        data["top_productos"] = fetch_all(cur, """
            SELECT p.name, SUM(oi.quantity) AS unidades, SUM(oi.quantity * oi.unit_price) AS ingresos
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            JOIN products p ON oi.product_id = p.id
            WHERE o.store_id = %s AND o.payment_process = 1 AND o.status NOT IN ('cancelled','canceled')
              AND o.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            GROUP BY p.id, p.name ORDER BY unidades DESC LIMIT 8
        """, (store_id,))

        # Top productos este mes
        data["top_productos_mes"] = fetch_all(cur, """
            SELECT p.name, SUM(oi.quantity) AS unidades, SUM(oi.quantity * oi.unit_price) AS ingresos
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            JOIN products p ON oi.product_id = p.id
            WHERE o.store_id = %s AND o.payment_process = 1 AND o.status NOT IN ('cancelled','canceled')
              AND o.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            GROUP BY p.id, p.name ORDER BY unidades DESC LIMIT 8
        """, (store_id,))

        # Peores productos
        data["peores_productos"] = fetch_all(cur, """
            SELECT p.name, p.price, COALESCE(SUM(oi.quantity), 0) AS unidades
            FROM products p
            LEFT JOIN order_items oi ON oi.product_id = p.id
            LEFT JOIN orders o ON oi.order_id = o.id
              AND o.store_id = %s AND o.payment_process = 1 AND o.status NOT IN ('cancelled','canceled')
              AND o.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            WHERE p.store_id = %s
            GROUP BY p.id, p.name, p.price ORDER BY unidades ASC LIMIT 8
        """, (store_id, store_id))

        # Ventas por día de la semana (último mes)
        rows = fetch_all(cur, """
            SELECT DAYOFWEEK(created_at) AS dia_num, COUNT(*) AS pedidos,
                   SUM(total) AS ingresos
            FROM orders
            WHERE store_id = %s AND payment_process = 1 AND status NOT IN ('cancelled','canceled')
              AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            GROUP BY DAYOFWEEK(created_at) ORDER BY pedidos DESC
        """, (store_id,))
        data["ventas_por_dia"] = [
            {"dia": DAY_ES.get(int(r["dia_num"]), "?"),
             "pedidos": int(r["pedidos"]),
             "ingresos": float(r["ingresos"] or 0)}
            for r in rows
        ]

        # Ventas por hora — intenta 7 días; si no hay ventas, amplía la ventana
        # a 30 y luego 90 días para SIEMPRE poder responder "¿a qué hora vendo más?"
        ventas_por_hora, ventana_horas = [], None
        for dias in (7, 30, 90):
            rows = fetch_all(cur, f"""
                SELECT HOUR(created_at) AS hora, COUNT(*) AS pedidos
                FROM orders
                WHERE store_id = %s AND payment_process = 1 AND status NOT IN ('cancelled','canceled')
                  AND created_at >= DATE_SUB(NOW(), INTERVAL {dias} DAY)
                GROUP BY HOUR(created_at) ORDER BY pedidos DESC LIMIT 8
            """, (store_id,))
            if rows:
                ventas_por_hora, ventana_horas = rows, dias
                break
        # Formato legible de la hora ("18:00–18:59") para que el modelo no dude
        for r in ventas_por_hora:
            h = int(r["hora"])
            r["franja"] = f"{h:02d}:00–{h:02d}:59"
        data["ventas_por_hora"] = ventas_por_hora
        data["ventas_por_hora_ventana_dias"] = ventana_horas  # None = sin ventas registradas

        # Stock crítico
        data["stock_critico"] = fetch_all(cur, """
            SELECT p.name, COALESCE(i.stock, 0) AS stock
            FROM products p
            LEFT JOIN inventory i ON p.id = i.product_id
            WHERE p.store_id = %s AND COALESCE(i.unlimited_stock, 0) = 0
              AND COALESCE(i.stock, 0) <= 3
            ORDER BY stock ASC LIMIT 10
        """, (store_id,))

        # Análisis por categoría (semana)
        data["categorias"] = fetch_all(cur, """
            SELECT COALESCE(c.name, 'Sin categoría') AS categoria,
                   SUM(oi.quantity) AS unidades, SUM(oi.quantity * oi.unit_price) AS ingresos
            FROM order_items oi JOIN orders o ON oi.order_id = o.id
            JOIN products p ON oi.product_id = p.id
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE o.store_id = %s AND o.payment_process = 1 AND o.status NOT IN ('cancelled','canceled')
              AND o.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            GROUP BY c.id, c.name ORDER BY ingresos DESC LIMIT 8
        """, (store_id,))

        # Catálogo de categorías con conteo de productos
        data["catalogo_categorias"] = fetch_all(cur, """
            SELECT c.name AS categoria, COUNT(p.id) AS total_productos,
                   ROUND(AVG(p.price), 2) AS precio_promedio,
                   MIN(p.price) AS precio_min, MAX(p.price) AS precio_max
            FROM categories c
            LEFT JOIN products p ON p.category_id = c.id AND p.store_id = %s
            WHERE c.store_id = %s
            GROUP BY c.id, c.name ORDER BY total_productos DESC
        """, (store_id, store_id))

        # Extras más pedidos
        import json as _json
        rows = fetch_all(cur, """
            SELECT selected_extras FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            WHERE o.store_id = %s AND o.payment_process = 1 AND o.status NOT IN ('cancelled','canceled')
              AND o.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
              AND oi.selected_extras IS NOT NULL AND oi.selected_extras != '[]'
        """, (store_id,))
        counts = {}
        for r in rows:
            try:
                for entry in _json.loads(r["selected_extras"] or "[]"):
                    name = entry if isinstance(entry, str) else entry.get("name", "")
                    if name:
                        counts[name] = counts.get(name, 0) + 1
            except Exception:
                pass
        data["extras_populares"] = sorted(
            [{"extra": k, "veces": v} for k, v in counts.items()],
            key=lambda x: -x["veces"])[:8]

        # Ingredientes / complementos más pedidos
        rows2 = fetch_all(cur, """
            SELECT selected_ingredients FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            WHERE o.store_id = %s AND o.payment_process = 1 AND o.status NOT IN ('cancelled','canceled')
              AND o.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
              AND oi.selected_ingredients IS NOT NULL AND oi.selected_ingredients != '[]'
        """, (store_id,))
        counts2 = {}
        for r in rows2:
            try:
                for entry in _json.loads(r["selected_ingredients"] or "[]"):
                    name = entry if isinstance(entry, str) else entry.get("name", "")
                    if name:
                        counts2[name] = counts2.get(name, 0) + 1
            except Exception:
                pass
        data["ingredientes_populares"] = sorted(
            [{"ingrediente": k, "veces": v} for k, v in counts2.items()],
            key=lambda x: -x["veces"])[:8]

        # Catálogo de extras disponibles
        data["catalogo_extras"] = fetch_all(cur, """
            SELECT name, price FROM extras WHERE store_id = %s ORDER BY name LIMIT 30
        """, (store_id,))

        # Catálogo de ingredientes disponibles
        data["catalogo_ingredientes"] = fetch_all(cur, """
            SELECT name FROM ingredients WHERE store_id = %s ORDER BY name LIMIT 30
        """, (store_id,))

        # ── Insights pre-digeridos (en español, listos para responder) ──────────
        # Le damos al modelo conclusiones ya masticadas para que jamás caiga en
        # consejos genéricos de industria: siempre responde con TUS números.
        cur_sym = data.get("currency", "$")
        insights = []

        vh = data.get("ventas_por_hora") or []
        if vh:
            top = vh[0]
            vent = data.get("ventas_por_hora_ventana_dias")
            periodo = {7: "últimos 7 días", 30: "últimos 30 días", 90: "últimos 90 días"}.get(vent, "el período con datos")
            top3 = ", ".join(f"{h['franja']} ({int(h['pedidos'])} pedidos)" for h in vh[:3])
            insights.append(
                f"La HORA en que más vendes es la franja {top['franja']} con {int(top['pedidos'])} pedidos "
                f"(datos de los {periodo}). Top horarios: {top3}."
            )
        else:
            insights.append(
                "Aún NO hay ventas registradas para calcular tus horas pico. En cuanto tengas "
                "pedidos completados podré decírtelo con exactitud."
            )

        vd = data.get("ventas_por_dia") or []
        if vd:
            d0 = vd[0]
            insights.append(
                f"El DÍA de la semana con más ventas es el {d0['dia']} "
                f"({int(d0['pedidos'])} pedidos, {cur_sym}{int(d0['ingresos']):,} en el último mes)."
            )

        tp = data.get("top_productos") or []
        if tp:
            insights.append(
                f"Tu producto MÁS VENDIDO esta semana es \"{tp[0]['name']}\" "
                f"({int(tp[0]['unidades'])} unidades)."
            )

        vs = data.get("ventas_semana") or {}
        if vs:
            insights.append(
                f"Esta semana llevas {vs.get('pedidos', 0)} pedidos y "
                f"{cur_sym}{int(vs.get('ingresos', 0)):,} en ingresos "
                f"(ticket promedio {cur_sym}{int(vs.get('ticket_promedio', 0)):,})."
            )

        data["resumen_para_responder"] = insights

    finally:
        cur.close()
        conn.close()

    return data
