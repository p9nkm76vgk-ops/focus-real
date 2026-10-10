#!/bin/sh
# Genera el paquete definitivo desde el código actual: sh scripts/package.sh <salida.zip>
set -e; OUT=${1:-focus-os-final.zip}; ROOT=$(pwd); case "$OUT" in /*) ;; *) OUT="$ROOT/$OUT";; esac; T=$(mktemp -d)/focus-os-final
npm run build >/dev/null
mkdir -p "$T/1-publicar" "$T/2-proyecto" "$T/3-docs" "$T/4-copias-de-seguridad"
cp -R dist/. "$T/1-publicar/"
tar --exclude=./dist --exclude=./node_modules -cf - . | (cd "$T/2-proyecto" && tar xf -)
cp docs/GUIA_USO_Y_RECUPERACION.md docs/DEPLOY.md docs/ESTIMATOR_V2.md docs/ESTADO.md "$T/3-docs/"
for f in /home/claude/backups/*.zip; do [ -e "$f" ] && cp "$f" "$T/4-copias-de-seguridad/"; done
cat > "$T/LEEME.md" <<'EOT'
# Focus OS — paquete final
- **1-publicar/**: la app lista para subir a un hosting HTTPS (arrastra esta carpeta a Netlify/Cloudflare Pages). Ver 3-docs/DEPLOY.md.
- **2-proyecto/**: código fuente y pruebas (`npm run build`, `npm test`; Node ≥ 22.18).
- **3-docs/**: GUIA_USO_Y_RECUPERACION.md, DEPLOY.md (instalar en iPad), ESTIMATOR_V2.md, ESTADO.md.
- **4-copias-de-seguridad/**: proyecto anterior a cada fase (se conservan intactas).
Estado: la app NO está publicada todavía; hace falta subir 1-publicar/ a un hosting HTTPS para instalarla desde Safari.
EOT
rm -f "$OUT"; (cd "$(dirname "$T")" && zip -qr "$OUT" focus-os-final); echo "paquete: $OUT"
