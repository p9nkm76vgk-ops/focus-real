# Focus OS
App web autónoma (HTML/CSS/JS, sin dependencias en ejecución). Requiere **Node ≥ 22.18** solo para construir y probar.
```
npm run build   # → dist/ (index.html, manifest, iconos, sw.js)
npm test        # 82 pruebas
```
Abrir `dist/index.html` en el navegador o servir `dist/` como estático.
## Estructura
`src/core` planificador+estadísticas (TS puro) · `src/app` UI · `src/data/repository.ts` contrato de persistencia · `public/` PWA · `supabase/`, `docs/CLOUD.md` propuesta de nube · `docs/DEPLOY.md` publicación.
## Pruebas (112, `npm test`)
| Suite | Cubre | Naturaleza |
|---|---|---|
| planner 9 · estimator 14 (v1) · migration 11 · acceptance.v2 19 · v2.integration 5 · lifestyle 12 · pwa 9 | motor, estimadores, migración, paleta, ejercicio, sugerencias, build/manifest/iconos, servidor HTTP local, contrastes del CSS | **Reales** (Node) |
| pwa (service worker) | precarga, sin conexión, versiones | **Simulada** (vm con caches/fetch falsos) |
| smoke 1 · app 13 · migration.app 6 · v2.app 4 · ui2.app 8 | menú, colores, ejercicio, sugerencias, migración, estimador v2 | **DOM simulado** (`test/harness.mjs`) |
| Safari/iPad, instalación PWA, offline real, revisión visual | — | **No ejecutadas** |
Estado completo y pendientes: `docs/ESTADO.md`. Publicación en iPad: `docs/DEPLOY.md`.

## Persistencia
localStorage de un solo navegador (clave `focusos.v1`). Datos inválidos no se sobrescriben (`focusos.v1.corrupt` + pantalla de recuperación). Importar valida, pide confirmación y guarda antes `focusos.v1.backup` (botón «Deshacer última importación»). Escrituras obsoletas entre pestañas se rechazan por `version`.

## Estimador 2.0: ver `docs/ESTIMATOR_V2.md` (decisiones, migración, recuperación y estado)
## Estimador v1 (`src/core/estimator.ts`, se mantiene para trabajos no migrados)
Reglas explícitas en `PARAMS` (ajustables): por tema = cantidad × base × dificultad/tipo/objetivo (acotado 0,6–1,8) × fracción pendiente según dominio (0–3) → aprendizaje + práctica; repaso = 15 % **una vez** sobre el total. Límites por tema, examen y tarea. Rango ±30 % (inicial) / ±15 % (personalizada).
El progreso se mide por **dominio del tema**, no por minutos: el tiempo atribuido a un tema no reduce lo pendiente salvo que el dominio suba. Minutos sin tema sí descuentan.
Personalización: mediana de cociente (tiempo necesario / previsto) de sesiones válidas (no interrumpidas, ≥5 min, avance ≥20 %, sin duplicar), por tipo → asignatura → global; el ajuste crece gradualmente con n y se acota (0,6–1,6). Una corrección manual fija el total y se guarda en `corrections`, nunca como tiempo estudiado.
Compatibilidad: los campos nuevos (`topics`, `estimate`, `learn`, `goal`, `log`, `topicId`) son opcionales; copias antiguas funcionan sin migrar ni borrar nada. Exportación schema 2.
Limitaciones: parámetros iniciales orientativos, no calibrados con datos reales; sin asignación de repaso por tema; sin UI gráfica por tema (se editan en el texto «Temas»).
