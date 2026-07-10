# AforoBridge — Puente Cámara → Contador de Aforo SRServi

App de Windows que conecta una **cámara IP (RTSP)** con tu panel
`https://srservi2.srautomatic.com/admin/people-counter`.

Hace el conteo de entradas/salidas **localmente** (la cámara está en tu red, no es
accesible desde el servidor remoto) y reporta cada cruce + una vista previa al panel,
para que veas el aforo en vivo desde cualquier lugar.

## Qué hace

- Pones la **IP de la cámara** (usuario, contraseña, canal) en un formulario simple.
- Inicias sesión con tu **cuenta SRServi** y eliges la **tienda**.
- Cuenta personas en **segundo plano** usando FFmpeg + detección de movimiento
  (mismo algoritmo que el panel web).
- Reporta cada entrada/salida al servidor y sube snapshots → el panel muestra
  "🔴 agente activo", la vista previa y el conteo en vivo.
- **Abre el panel web auto-logueado** (inyecta tu sesión en el WebView, no tienes
  que volver a escribir la contraseña).
- **Arranca junto con Windows** y vive en la **bandeja del sistema**.

> La **línea de conteo** se ajusta en el panel web (pestaña "En Vivo" → "Ajustar
> línea"). AforoBridge la lee del servidor y se actualiza sola cada 60 s.

## Requisitos

- Windows 10 / 11
- .NET 9 (Desktop Runtime) — o publica self-contained para no depender de él
- Microsoft Edge WebView2 Runtime (ya viene en Windows 11)
- FFmpeg → si no está, AforoBridge lo **descarga solo** la primera vez

## Compilar y ejecutar

```cmd
cd AforoBridge
dotnet run -c Release
```

## Generar EXE distribuible (recomendado para el PC del local)

Self-contained (incluye .NET, no requiere instalar nada):

```cmd
dotnet publish -c Release -r win-x64 --self-contained true ^
  -p:PublishSingleFile=true -o .\publish
```

El ejecutable queda en `.\publish\AforoBridge.exe`. Cópialo al PC del local y ábrelo.

## Primer uso

1. Abre `AforoBridge.exe`. Se mostrará la **Configuración**.
2. **Cuenta SRServi**: servidor, email y contraseña → *Iniciar sesión* → elige tienda.
3. **Cámara IP**: IP, puerto (554), usuario, contraseña y canal (ej. `stream1`).
4. Marca *Arrancar junto con Windows* y *Iniciar conteo automáticamente*.
5. *Guardar y aplicar*. Empieza a contar y abre el panel.

A partir de ahí, cada vez que se prenda el PC, AforoBridge arranca minimizado en la
bandeja y cuenta solo.

## Controles

| Acción | Cómo |
|--------|------|
| Ver panel | Doble clic en el icono de la bandeja |
| Iniciar/Detener conteo | Botón en la barra o menú de la bandeja |
| Cambiar cámara/cuenta | Botón **Configuración** |
| Cerrar (sigue contando) | La X esconde en la bandeja |
| Salir de verdad | Menú bandeja → **Salir** |

## Dónde se guarda la config

`%AppData%\AforoBridge\config.json` — las contraseñas se cifran con DPAPI
(atadas a tu usuario de Windows). FFmpeg y la caché del WebView también viven ahí.

## Notas técnicas

- No activa el conteo RTSP del lado servidor (el servidor no puede ver tu cámara
  local); el conteo lo hace AforoBridge y solo envía los eventos.
- Algoritmo idéntico a `server/local-rtsp-agent.js` y `PeopleCounter.jsx`:
  frames 80×60 RGB a 2fps → diff de píxeles → blobs → cruce de línea con cooldown.
