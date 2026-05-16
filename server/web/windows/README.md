# FullscreenBrowser — SR Automatica

Aplicación Windows que abre https://srservi2.srautomatic.com/ en pantalla completa.

## Requisitos

- Windows 10 / 11
- .NET 6 SDK o superior → https://dotnet.microsoft.com/download
- Microsoft Edge WebView2 Runtime (ya viene instalado en Windows 11 y en versiones modernas de Windows 10)
  → Si no lo tienes: https://developer.microsoft.com/microsoft-edge/webview2/

## Cómo compilar y ejecutar

### Opción A — Visual Studio 2022
1. Abrir `FullscreenBrowser.csproj` con Visual Studio 2022
2. Presionar **F5** para compilar y ejecutar

### Opción B — Línea de comandos
```cmd
cd FullscreenBrowser
dotnet restore
dotnet run
```

### Opción C — Generar EXE publicable
```cmd
dotnet publish -c Release -r win-x64 --self-contained false -o ./publish
```
El ejecutable quedará en `./publish/FullscreenBrowser.exe`

## Controles en tiempo de ejecución

| Tecla | Acción |
|-------|--------|
| `Esc` | Cerrar la aplicación |
| `F5`  | Recargar la página |

## Notas

- La ventana se abre sin bordes ni barra de tareas, ocupando toda la pantalla
- Se desactiva el menú contextual y las DevTools del navegador
- `TopMost = true` mantiene la ventana siempre al frente
