# Fase nube: Supabase (propuesta mínima, NO implementada ni probada)
Plan gratuito de Supabase: comprobar límites vigentes antes de adoptarlo (p. ej. pausa por inactividad, tamaño de BD); no se han verificado aquí.
**Principios:** localStorage no se elimina (caché local + modo sin conexión); migración aditiva; el cliente solo usa la *anon/publishable key* pública (nunca la service_role); ningún secreto en el repo.
## Modelo
`supabase/migrations/0001_init.sql`: `subjects`, `works`, `blocks`, `user_settings`; PK `(user_id, id)`, FK compuestas (impiden referenciar filas de otro usuario), `CHECK` de rangos/estados, `version` + trigger para concurrencia optimista, RLS `for all` con `auth.uid() = user_id` (USING y WITH CHECK), `anon` sin acceso.
## Operaciones del `SupabaseRepository` (mismo contrato `Repository`)
1. `load`: 4 `select` (RLS filtra por usuario) → `AppState`.
2. `save`: el planificador sigue en el cliente; calcular diff vs. último estado cargado → `upsert` por `(user_id,id)` de filas nuevas/cambiadas y `delete` de las retiradas, en orden subjects → works → blocks. Actualizaciones con `.eq('version', esperada)`; 0 filas = conflicto → recargar y re-planificar (idempotente).
3. Auth: email magic link o contraseña (Supabase Auth); sin sesión → modo local.
## Migración no destructiva desde localStorage
Tras el primer login: si la nube está vacía → subir con `upsert ... ignoreDuplicates`; si no, ofrecer elegir (nube / local / cancelar) mostrando recuentos. Antes de cualquier reemplazo, guardar `focusos.v1.backup` y exportar JSON. Nunca borrar localStorage automáticamente.
## Pruebas pendientes (obligatorias antes de usarlo)
Aplicar el SQL en un proyecto de prueba; con dos usuarios comprobar que A no puede select/insert/update/delete sobre filas de B ni insertar `user_id` ajeno ni referenciar un `subject_id` de B; que `anon` falla; que un `update` con `version` obsoleta no pisa datos; reintento idempotente del `save`.
