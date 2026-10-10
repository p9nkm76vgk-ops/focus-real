# Focus OS — guía breve de uso y recuperación de datos
## Uso diario
**Hoy:** sesiones de hoy, prioridades, avisos de déficit y, solo si no hay trabajo urgente sin cubrir, 1–3 *sugerencias opcionales* (etiquetadas «Opcional»; Iniciar, Posponer, Sustituir, Mover, Quitar). Nunca son tareas ni se marcan como hechas solas.
**Tareas y exámenes:** crea con los datos que sepas; los minutos son opcionales (estimación automática). En un examen, un tema por línea: `Nombre; dificultad 1-5; cantidad 1-5; preparación 0-3; unidades (vacío = desconocida)`. «Recalcular con estimador 2.0» compara v1/v2 y puedes cancelar o volver a v1. Las estimaciones son rangos orientativos, no certezas.
**Calendario:** semana con estudio y ejercicio; «Hecho» registra tiempo real, ítems y fase (todo opcional); «Mover» convierte una sesión en manual (protegida).
**Ejercicio físico:** sesiones opcionales sin objetivos de peso ni rendimiento; hora vacía = se reserva un hueco libre; si no hay hueco te lo dice y no mueve nada.
**Ajustes:** disponibilidad semanal, límites de estudio, colores por asignatura (únicos; restablecer paleta), exportar/importar.
## Copias y recuperación (tus datos viven SOLO en este navegador/app instalada)
1. **Exporta una copia JSON cada semana** (Ajustes → Exportar) y guárdala en Archivos/iCloud. Safari puede borrar datos de webs que no abres en 7 días; instalada en la pantalla de inicio y abierta a menudo es más segura (no verificado en iPad).
2. **Restaurar:** Ajustes → Importar copia JSON → confirma. Se guarda antes una copia automática; «Deshacer última importación» la recupera.
3. **Datos dañados:** la app muestra «Datos no válidos» y NO sobrescribe nada; puedes descargar la copia dañada, importar un JSON o empezar de cero (la dañada se conserva aparte).
4. **Copias automáticas en el navegador:** `focusos.v1.premigration` (antes de migrar), `focusos.v1.preupgrade` (antes de pasar un trabajo a v2), `focusos.v1.backup` (antes de importar). Restaurar manualmente (consola de Safari de escritorio): `localStorage.setItem('focusos.v1', localStorage.getItem('focusos.v1.premigration'))` y recargar.
5. **Cambio de dirección (URL):** los datos NO se mueven solos. Exporta en la antigua e importa en la nueva.
6. Las actualizaciones de la app **no tocan tus datos** (verificado en Chromium); solo sustituyen los archivos de la app.
