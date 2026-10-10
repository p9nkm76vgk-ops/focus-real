# Estimador 2.0 — decisiones, migración y estado (para retomar el trabajo)

## 1. Qué está respaldado, qué es heurístico y qué se aprende
**Respaldado por investigación (solo la ESTRUCTURA, no las cifras):** práctica de recuperación sin apuntes y repaso espaciado (Dunlosky et al., 2013, DOI 10.1177/1529100612453266; Carpenter, Pan y Butler, 2022, DOI 10.1038/s44159-022-00089-1; Agarwal, Nunes y Blunt, 2021, DOI 10.1007/s10648-021-09595-9; DOIs aportados por el usuario, no reverificados aquí) y ejemplos resueltos para principiantes con menos peso a medida que sube la pericia (línea de carga cognitiva; Kalyuga et al., 2003, citado de memoria: verificar). **Ninguna fuente da horas por tema o examen.**
**Heurístico inicial (HEURISTICO-PREVIO, `V2` en `estimator2.ts` y `config.ts`):** minutos por unidad y fase (25/30/12/15/8), factor de dificultad (0,7…1,5), corte del aprendizaje con ejemplos (dominio 0,5), objetivo → éxito independiente deseado (0,6/0,75/0,9), extensión desconocida = 4 unidades con factor ×/÷2, peso del autoinforme (2 ítems), olvido (30 días), σ inicial de velocidad 0,4, reservas de repaso (1–5) y días mínimos para espaciar (3).
**Aprendido de tus datos:** velocidad por familia de asignatura y fase (mediana de sesiones válidas con unidades, contraída hacia el previo), dominio por tema (Beta con prior débil + intentos), corrección central y cuantiles del error de predicción por trabajo cerrado.
**Umbrales configurables, no garantías:** `calibrationMinErrors` (10) solo decide cuándo el rango deja de llamarse «orientativo»; cuenta TRABAJOS distintos (las predicciones de un mismo trabajo cuentan una vez). Se informa la cobertura empírica; no equivale a validación en el mundo real.

## 2. Migración, copias y recuperación
- Esquema 3, aditivo (`migrate.ts`): añade `schemaVersion`, `estimateLog`, `estimatorVersion=1`, `selfRating`, `evidence=[]`. No inventa `extent` ni familia. Idempotente.
- Antes de migrar: copia literal en `focusos.v1.premigration` (no se sobrescribe). `lostPaths()` detecta eliminaciones, cambios de valor/tipo, nulos y cambios dentro de arrays; si detecta algo, no migra. Si no puede crear la copia, no migra.
- Importar: valida, migra con la misma guarda, guarda `focusos.v1.backup` y permite «Deshacer última importación».
- «Recalcular con estimador 2.0» (por trabajo): comparación v1/v2 sin efectos; al aplicar guarda `focusos.v1.preupgrade` (pide confirmación antes de sobrescribir una existente). «Volver a estimador v1»: conserva evidencia e historial (`estimatorHistory`). v2 no toca `estMin` ni `readiness`.
- **Restaurar:** (a) Ajustes → importar el JSON exportado; (b) consola: `localStorage.setItem('focusos.v1', localStorage.getItem('focusos.v1.premigration'))` y recargar; idem con `.preupgrade`; (c) `focus-os-copia-fase1.zip` = proyecto completo antes de la fase 2.
- **Compatibilidad con la versión anterior:** probada SOLO con DOM simulado: la app anterior abre datos esquema 3 y conserva los campos nuevos. Una exportación v3 la importa si el esquema ≤ 3. No es una prueba en navegador real.

## 3. Limitaciones conocidas
Diagnóstico solo vía ítems en «Registrar sesión» (no hay pantalla de diagnóstico dedicada) · predicciones a nivel de trabajo (no por tema-fase) y se cierran al marcar el trabajo «Completada» · el planificador aún reserva el 25 % final como «repaso» y no reparte por fase: v2 solo informa de días insuficientes para espaciar · velocidad por familia×fase (no por tipo de unidad concreto) · familias/unidades duplicadas en `app.js` y `config.ts` · v1 mantiene sus defectos conocidos para los trabajos que no migres (sus tests están marcados «LEGADO v1»).

## 4. Estado del proyecto (retomar)
Hecho: tipos, migración con guarda, copias, opt-in/vuelta atrás, estimador v2 (dominio por evidencia, extensión desconocida, 5 fases, velocidad aprendida, intervalos, viabilidad con capacidad real), historial inmutable de predicciones, formularios (familia, unidades, ítems), 82 tests. Siguiente: pantalla de diagnóstico, planificador por fases con espaciado real, retroprueba con datos reales, probar en Safari/iPad.
