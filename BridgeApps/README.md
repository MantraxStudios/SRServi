# AforoBridge Android — Contador de aforo desde el celular

App Android que conecta una **cámara IP (RTSP)** con tu panel
`/admin/people-counter` y cuenta el aforo en **segundo plano**, igual que
AforoBridge para Windows pero en el teléfono.

## Qué hace

- **Asistente paso a paso** (no abruma al usuario): bienvenida → sesión → local →
  buscar cámara → clave de la cámara → listo.
- **Escanea tu red Wi-Fi** y te muestra las cámaras encontradas para elegir la IP.
- **Autodetecta el canal de video** (stream1, Streaming/Channels/101, etc.) al
  probar la conexión, así el usuario no necesita saber tecnicismos.
- **Cuenta en segundo plano** con un servicio en primer plano (notificación
  persistente). Usa **Media3 ExoPlayer** para decodificar el RTSP y un
  `ImageReader` para analizar los frames — sin FFmpeg.
- **Reporta cruces y sube snapshots** al servidor (mismos endpoints que la web).
- **Arranca solo al prender el teléfono** (BootReceiver).

## Cómo se cuenta (técnico)

`ExoPlayer (RTSP) → Surface de ImageReader (YUV_420_888) → luminancia 80×60 →
MotionDetector (diff + blobs + cruce de línea) → POST evento + snapshot JPEG`.

Es el mismo algoritmo del panel web, el servidor y AforoBridge Windows
(`MotionDetector.kt`).

## Compilar / instalar

Ya compila correctamente. El APK de depuración queda en:

```
app/build/outputs/apk/debug/app-debug.apk
```

Para generarlo:
```cmd
cd BridgeApps
gradlew.bat :app:assembleDebug
```

Instalar en un teléfono conectado por USB (depuración activada):
```cmd
gradlew.bat :app:installDebug
```

O abre la carpeta `BridgeApps` en **Android Studio** y dale Run ▶.

## Permisos que pide

- Internet / estado de red (conectar al servidor y escanear)
- Servicio en primer plano + notificaciones (conteo en segundo plano)
- Arranque al encender (auto-inicio)

## Notas importantes

- El teléfono debe estar en la **misma red Wi-Fi** que la cámara.
- La captura de frames usa `ImageReader` con formato `YUV_420_888`; funciona en la
  mayoría de dispositivos modernos. Si algún teléfono no entrega frames, conviene
  probar con otro modelo.
- Para que el conteo no se detenga, en algunos teléfonos hay que **desactivar la
  optimización de batería** para AforoBridge (Ajustes → Batería → sin restricción).
- La **vista previa en vivo** del panel requiere el cambio del servidor ya aplicado
  (reenvío de snapshots del agente local).

## Estructura

| Archivo | Rol |
|---|---|
| `MainActivity.kt` | Asistente paso a paso (UI) |
| `Settings.kt` | Configuración persistente |
| `Api.kt` | Cliente HTTP (login, tiendas, eventos, snapshots) |
| `NetworkScanner.kt` | Escaneo de la red (puerto 554) |
| `CameraProbe.kt` | Prueba + autodetección de canal (ExoPlayer) |
| `CountingService.kt` | Servicio en primer plano que cuenta |
| `MotionDetector.kt` | Algoritmo de conteo (luminancia 80×60) |
| `YuvUtils.kt` | YUV → luminancia y → JPEG |
| `BootReceiver.kt` | Auto-inicio al encender el teléfono |
