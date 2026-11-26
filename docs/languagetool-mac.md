# LanguageTool en el Mac (opcional)

Con esto OjoFino suma la revisión gramatical completa de LanguageTool. El texto viaja
cifrado solo entre tu iPad y tu Mac por Tailscale; nunca pasa por servidores públicos de LanguageTool.

## 1. Instalar y dejar corriendo LanguageTool

```sh
brew install languagetool
brew services start languagetool      # arranca ahora y al encender el Mac (puerto 8081)
```

Prueba local:

```sh
curl -s -d "language=es" --data-urlencode "text=Ayer hiba al supermercado." http://localhost:8081/v2/check | head -c 300
```

Debe responder un JSON con `"matches"`.

Notas:
- El servicio de Homebrew arranca con `--allow-origin` (acepta consultas desde cualquier página),
  pero el servidor de LanguageTool **solo escucha en el propio Mac** (no usa `--public`).
  Desde fuera solo se llega a él a través de Tailscale, es decir, desde tus equipos.
- Homebrew no es soportado oficialmente por el equipo de LanguageTool.
- Actualizar: `brew update && brew upgrade languagetool && brew services restart languagetool`.

## 2. Tailscale (Mac + iPad, misma cuenta)

1. Instala Tailscale en el Mac y en el iPad e inicia sesión con la **misma cuenta** en ambos.
2. En la consola web de Tailscale, en **DNS**, activa **MagicDNS** y los **certificados HTTPS**
   (Serve los necesita).
3. En el Mac, publica LanguageTool **solo dentro de tu red privada**:

   ```sh
   tailscale serve --bg 8081
   # Si "tailscale" no está en el PATH (app del App Store):
   # /Applications/Tailscale.app/Contents/MacOS/Tailscale serve --bg 8081
   ```

4. Mira la dirección asignada:

   ```sh
   tailscale serve status
   ```

   Será algo como `https://macbook-pro.tu-red.ts.net`.

> **Nunca uses `tailscale funnel`**: eso lo publicaría en internet.

Para dejar de compartir: `tailscale serve --https=443 off` (o `tailscale serve reset`).

## 3. Configurar OjoFino

En la app: **Mis ajustes → LanguageTool (opcional)** → pega la dirección `https://….ts.net` →
**Probar conexión** → **Guardar**.

Si el Mac está apagado, dormido o sin red, OjoFino sigue solo con el motor local y lo indica
en la pantalla y en el informe ("LanguageTool no disponible").

## 4. Que el Mac no se duerma (si lo quieres disponible desde fuera)

En Ajustes del Sistema, en la sección de batería/energía, activa la opción que evita que el Mac
entre en reposo automáticamente cuando está conectado a la corriente y con la pantalla apagada.
