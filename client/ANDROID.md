# SRServi POS — App Android (Capacitor)

Empaqueta la web (SPA React de `client/`) en un **APK nativo** usando Capacitor.
Es una app instalable (Play Store o APK directo) que carga la interfaz empaquetada
y consume la API en la nube (`https://srservi2.srautomatic.com`). El **service
worker** (PWA) cachea el shell, así que abre y navega lo esencial sin conexión.

> No es un POS 100% offline con base de datos embebida como la app de escritorio
> (Electron). Android no puede correr Node + MariaDB embebidos; para offline total
> habría que portar el servidor a SQLite (proyecto aparte).

## Requisitos para compilar el APK

- **JDK 17** (Temurin/OpenJDK).
- **Android SDK** (Android Studio o `cmdline-tools`), con `ANDROID_HOME` /
  `ANDROID_SDK_ROOT` apuntando al SDK y las platform-tools en el PATH.

En esta máquina no hay Java ni Android SDK, por eso el proyecto queda **generado y
sincronizado**, pero el `.exe`… perdón, el `.apk`, se compila donde tengas el SDK.

## Compilar

Desde `client/`:

```bash
# APK de depuración (para probar en tu teléfono)
npm run android:apk:debug
# → client/android/app/build/outputs/apk/debug/app-debug.apk

# APK de release (firmar antes de publicar)
npm run android:apk
# → client/android/app/build/outputs/apk/release/app-release-unsigned.apk
```

Ambos scripts hacen `vite build` + `cap sync android` + Gradle. Si cambiás la web,
volvé a correrlos (o `npm run cap:sync` para solo re-sincronizar).

Alternativa con Android Studio: `npx cap open android` y compilar/ejecutar desde ahí.

## Publicar el APK en el menú de login

El APK pesa ~124 MB y **GitHub no permite archivos de más de 100 MB**, así que NO
se guarda en el repo (`server/public/downloads/`). Se hospeda en un servicio
externo (MediaFire) y el botón **"Descargar App Android"** de la pantalla de login
apunta a ese enlace:

```
https://www.mediafire.com/file/0vyuh0m129gx6ky/SRServi-POS-Offline.apk/file
```

Cuando generes un APK nuevo, subilo a MediaFire (reemplazando el archivo) y, si
cambia la URL, actualizá el enlace en `client/src/pages/Login.jsx`.

## Íconos / splash (opcional)

```bash
npm i -D @capacitor/assets
npx @capacitor/assets generate --android   # usa resources/icon.png y splash.png
```
