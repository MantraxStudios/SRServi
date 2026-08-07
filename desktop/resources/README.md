# Binarios de MariaDB portable

Coloca aquí la distribución **portable (ZIP, no instalador)** de MariaDB para
Windows x64, de modo que quede así:

```
desktop/resources/mariadb/
  bin/
    mysqld.exe
    mysql.exe
    mysqladmin.exe
    mariadb-install-db.exe   (o mysql_install_db.exe)
  share/                     (necesario para la inicialización)
  lib/ ...
```

## Cómo obtenerlo

1. Descarga el ZIP "Windows x86_64" desde https://mariadb.org/download/
   (por ejemplo `mariadb-11.x.x-winx64.zip`).
2. Descomprímelo.
3. Copia el **contenido** de la carpeta descomprimida dentro de
   `desktop/resources/mariadb/` (que exista `bin/mysqld.exe`).

Esta carpeta está en `.gitignore` (los binarios no se versionan). El instalador
(`npm run dist`) la empaqueta como recurso de la app.

## Prueba rápida (sin empaquetar)

Con los binarios en su sitio, desde `desktop/`:

```
npm install
npm start
```

La app inicializará la BD en `%APPDATA%/SRServi POS/db-data`, levantará MariaDB
en el puerto 3307, el servidor Express en el 8888 y abrirá la ventana en `/admin`.
