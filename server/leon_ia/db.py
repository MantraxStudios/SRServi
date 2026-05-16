import mysql.connector
from datetime import datetime

DB_CONFIG = {
    "host": "localhost",
    "port": 3306,
    "user": "root",
    "password": "SDVDttniogreireg@2024",
    "database": "srservi"
}

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
                       COALESCE(SUM(CASE WHEN status IN ('paid','processed','completed','approved') THEN total END), 0) AS ingresos,
                       COALESCE(AVG(CASE WHEN status IN ('paid','processed','completed','approved') THEN total END), 0) AS ticket_promedio,
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
            WHERE o.store_id = %s AND o.status IN ('paid','processed','completed','approved')
              AND o.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            GROUP BY p.id, p.name ORDER BY unidades DESC LIMIT 8
        """, (store_id,))

        # Top productos este mes
        data["top_productos_mes"] = fetch_all(cur, """
            SELECT p.name, SUM(oi.quantity) AS unidades, SUM(oi.quantity * oi.unit_price) AS ingresos
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            JOIN products p ON oi.product_id = p.id
            WHERE o.store_id = %s AND o.status IN ('paid','processed','completed','approved')
              AND o.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            GROUP BY p.id, p.name ORDER BY unidades DESC LIMIT 8
        """, (store_id,))

        # Peores productos
        data["peores_productos"] = fetch_all(cur, """
            SELECT p.name, p.price, COALESCE(SUM(oi.quantity), 0) AS unidades
            FROM products p
            LEFT JOIN order_items oi ON oi.product_id = p.id
            LEFT JOIN orders o ON oi.order_id = o.id
              AND o.store_id = %s AND o.status IN ('paid','processed','completed','approved')
              AND o.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            WHERE p.store_id = %s
            GROUP BY p.id, p.name, p.price ORDER BY unidades ASC LIMIT 8
        """, (store_id, store_id))

        # Ventas por día de la semana (último mes)
        rows = fetch_all(cur, """
            SELECT DAYOFWEEK(created_at) AS dia_num, COUNT(*) AS pedidos,
                   SUM(total) AS ingresos
            FROM orders
            WHERE store_id = %s AND status IN ('paid','processed','completed','approved')
              AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            GROUP BY DAYOFWEEK(created_at) ORDER BY pedidos DESC
        """, (store_id,))
        data["ventas_por_dia"] = [
            {"dia": DAY_ES.get(int(r["dia_num"]), "?"),
             "pedidos": int(r["pedidos"]),
             "ingresos": float(r["ingresos"] or 0)}
            for r in rows
        ]

        # Ventas por hora (última semana)
        data["ventas_por_hora"] = fetch_all(cur, """
            SELECT HOUR(created_at) AS hora, COUNT(*) AS pedidos
            FROM orders
            WHERE store_id = %s AND status IN ('paid','processed','completed','approved')
              AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            GROUP BY HOUR(created_at) ORDER BY pedidos DESC LIMIT 8
        """, (store_id,))

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
            WHERE o.store_id = %s AND o.status IN ('paid','processed','completed','approved')
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
            WHERE o.store_id = %s AND o.status IN ('paid','processed','completed','approved')
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
            WHERE o.store_id = %s AND o.status IN ('paid','processed','completed','approved')
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

    finally:
        cur.close()
        conn.close()

    return data
