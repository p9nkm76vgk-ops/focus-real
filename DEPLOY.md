# Publicar Focus OS y añadirlo a la pantalla de inicio del iPad
**Estado real:** la app está PREPARADA como PWA (manifest, iconos 180/192/512/maskable, service worker con caché sin conexión, modo standalone, áreas seguras). **No está desplegada en un dominio propio** y no se ha probado en un iPad real. La vista previa de Claude (`claude.ai/artifact/…`) NO sirve para instalar de forma fiable: es otro origen, no sirve `manifest`/`sw.js`/iconos y exige abrir la conversación.

## Requisitos
Hosting estático con **HTTPS** (iOS lo exige para el service worker). Sin servidor propio ni coste: Cloudflare Pages, Netlify, Vercel o GitHub Pages (comprueba los límites vigentes de su plan gratuito).

## Pasos mínimos (elige UNO)
1. `npm run build` (Node ≥ 22.18) → carpeta `dist/`.
2. **Netlify (más rápido):** app.netlify.com → «Add new site» → «Deploy manually» → arrastra la carpeta `dist/`. Obtienes una URL `https://….netlify.app`.
   **Cloudflare Pages:** «Create project» → «Upload assets» → sube `dist/`. **GitHub Pages:** publica el contenido de `dist/` en la rama de Pages.
3. En el iPad, abre esa URL **en Safari** (no en otra app) → botón Compartir → **«Añadir a pantalla de inicio»** → «Añadir». Se abre como app independiente, con su icono oliva.
4. Abre la app una vez con conexión; después abrirá sin conexión (la primera carga debe ser online para guardar la caché).

## ⚠ Datos al cambiar de dirección
Los datos viven en el `localStorage` del **origen** (dirección) y del navegador/app instalada. Una URL nueva (o la app instalada frente a la pestaña de Safari) empieza **vacía**:
1. En la dirección ANTIGUA: Ajustes → **Exportar copia JSON** (guarda el archivo en Archivos/iCloud).
2. En la dirección NUEVA: Ajustes → **Importar copia JSON** → confirma. Se guarda antes una copia automática.
3. Comprueba que ves tus tareas y sesiones antes de dejar de usar la antigua. Exporta una copia cada semana.
Si instalas en pantalla de inicio desde una URL y luego usas otra, los datos NO se comparten entre ambas.

## Actualizaciones y vuelta atrás
Cada `npm run build` cambia la versión del service worker; al reabrir la app se descarga la nueva y se retira la caché anterior (los datos no se tocan). Para volver atrás: vuelve a desplegar el `dist/` anterior (`focus-os-copia-fase2.zip` contiene el proyecto previo a esta fase) o importa tu JSON.
