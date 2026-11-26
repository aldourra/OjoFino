# Publicar OjoFino en GitHub Pages

Solo se publica el **código** de la app. Los PDF, el diccionario personal y las ignoradas
nunca salen del dispositivo.

## Una sola vez

1. En GitHub, crea un repositorio nuevo:
   - Nombre: `OjoFino`
   - Visibilidad: **Public** (GitHub Pages gratis lo requiere)
   - **Sin** README, `.gitignore` ni licencia (el proyecto ya los trae)
2. En el repositorio: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. En el Mac:

   ```sh
   cd ~/git/OjoFino
   git remote add origin https://github.com/<tu-usuario>/OjoFino.git
   git push -u origin master
   ```

4. En la pestaña **Actions** del repositorio espera que "Publicar en GitHub Pages" quede en verde
   (1–2 minutos). Si falló porque Pages aún no estaba activado, actívalo (paso 2) y pulsa **Re-run jobs**.
5. La app queda en `https://<tu-usuario>.github.io/OjoFino/`.

## Cada vez que haya cambios

```sh
npm run sw        # si cambiaste archivos de la app: actualiza la lista del modo sin conexión
npm test
git add -A && git commit -m "…"
git push
```

El workflow vuelve a correr todas las pruebas y solo publica si pasan. En el iPad, la app
mostrará "Hay una versión nueva de OjoFino — Actualizar".
