/** Migración de esquema (puro, aditivo, idempotente). Solo AÑADE campos opcionales; nunca borra, reordena ni reescribe valores. */
export const SCHEMA_VERSION = 3;
import { DEFAULT_SUBJECT_COLORS } from './palette.ts';
const clone = (x: any) => JSON.parse(JSON.stringify(x));

export function migrateState(input: any): { state: any; changed: boolean; steps: string[] } {
  const s = clone(input), steps: string[] = [];
  if ((s.schemaVersion ?? 2) < SCHEMA_VERSION) migrateV3(s, steps);
  ensureFeatures(s, steps); // aditivo y por presencia (no sube el esquema: la versión anterior de la app sigue abriendo estos datos)
  return { state: s, changed: steps.length > 0, steps };
}
function ensureFeatures(s: any, steps: string[]) {
  if (!Array.isArray(s.activities)) { s.activities = []; steps.push('activities=[]'); }
  if (!Array.isArray(s.suggestionLog)) { s.suggestionLog = []; steps.push('suggestionLog=[]'); }
  for (const sj of s.subjects ?? []) if (sj.colorKey === undefined && sj.name in DEFAULT_SUBJECT_COLORS) { sj.colorKey = sj.name; steps.push(`subjects.${sj.id}.colorKey`); } // el color heredado `color` no se toca
}
function migrateV3(s: any, steps: string[]) {
  s.schemaVersion = SCHEMA_VERSION; steps.push('schemaVersion=3');
  if (!Array.isArray(s.estimateLog)) { s.estimateLog = []; steps.push('estimateLog=[]'); }
  for (const w of s.works ?? []) {
    if (w.estimatorVersion === undefined) { w.estimatorVersion = 1; steps.push(`works.${w.id}.estimatorVersion=1`); } // v1 hasta que el usuario elija v2
    for (const t of w.topics ?? []) {
      if (t.selfRating === undefined && typeof t.mastery === 'number') t.selfRating = t.mastery; // copia, no sustituye a `mastery`
      if (t.evidence === undefined) t.evidence = []; // sin evidencia: NO se infiere ni se inventa extensión (`extent` queda ausente)
    }
  }
}

/** Rutas cuyo valor original ya no está idéntico en `after`. Vacío = no se perdió ni cambió nada. `schemaVersion` es la única excepción. */
export function lostPaths(before: any, after: any, path = ''): string[] {
  if (before === null || typeof before !== 'object') return Object.is(before, after) || path === 'schemaVersion' ? [] : [path || '(raíz)'];
  if (after === null || typeof after !== 'object' || Array.isArray(before) !== Array.isArray(after)) return [path || '(raíz)'];
  if (Array.isArray(before)) return after.length < before.length ? [path + '[longitud]'] : before.flatMap((v: any, i: number) => lostPaths(v, after[i], `${path}[${i}]`));
  return Object.keys(before).flatMap(k => k in after ? lostPaths(before[k], after[k], path ? `${path}.${k}` : k) : [path ? `${path}.${k}` : k]);
}

/** Cambio de versión de estimador por trabajo (el estado original no se muta). Conserva todo lo demás y deja traza para volver atrás. */
export function setEstimatorVersion(state: any, workId: string, to: 1 | 2, at: number): any {
  const s = clone(state), w = (s.works ?? []).find((x: any) => x.id === workId);
  if (!w) throw new Error('Trabajo no encontrado: ' + workId);
  w.estimatorHistory = [...(w.estimatorHistory ?? []), { at, from: w.estimatorVersion ?? 1, to, estimate: w.estimate ?? null }];
  w.estimatorVersion = to; return s;
}
/** Comparación antes/después SIN aplicar nada; `estimate` es la función del estimador a probar. */
export function previewUpgrade(state: any, workId: string, estimate: (w: any) => any) {
  const w = (state.works ?? []).find((x: any) => x.id === workId);
  if (!w) throw new Error('Trabajo no encontrado: ' + workId);
  return { before: w.estimate ?? null, after: estimate({ ...clone(w), estimatorVersion: 2 }) };
}
