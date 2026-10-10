/** Contrato de persistencia. La app solo conoce esta interfaz.
 *  Hoy: LocalRepo (localStorage, un único dispositivo/navegador, SIN multiusuario ni nube).
 *  Mañana: implementar el mismo contrato sobre Postgres/Supabase con auth y RLS (user_id = auth.uid()),
 *  usando `version` para control de concurrencia optimista entre dispositivos. */
export interface AppState { version: number; subjects: unknown[]; works: unknown[]; blocks: unknown[]; settings: unknown }
export interface Repository {
  load(): Promise<AppState | null>;
  /** Debe rechazar si `expectedVersion` no coincide con la almacenada (conflicto multi-dispositivo). */
  save(state: AppState, expectedVersion?: number): Promise<void>;
}
