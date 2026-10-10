import type { Block, Now, Work } from './types.ts';
const dur = (b: Block) => b.end - b.start;
/**
 * Definiciones:
 *  - Planificados: sesiones planned|done|skipped (las 'rescheduled' se excluyen: su trabajo pasó a otra sesión → no se cuenta dos veces).
 *  - Completados: solo sesiones done (actualMin si existe, si no la duración).
 *  - Cumplimiento = min programados de sesiones done / min programados de sesiones done+skipped (null si no hay ninguna resuelta).
 */
export function stats(blocks: Block[], works: Work[], _now: Now) {
  const subj = new Map(works.map(w => [w.id, w.subjectId]));
  const counts = { planned: 0, done: 0, skipped: 0, rescheduled: 0 };
  const byDay: Record<string, { plannedMin: number; completedMin: number }> = {};
  const bySubject: Record<string, number> = {};
  let plannedMin = 0, completedMin = 0, doneSched = 0, skippedSched = 0;
  for (const b of blocks) {
    counts[b.status]++;
    if (b.status === 'rescheduled') continue;
    const d = (byDay[b.date] ??= { plannedMin: 0, completedMin: 0 });
    d.plannedMin += dur(b); plannedMin += dur(b);
    if (b.status === 'done') {
      const m = b.actualMin ?? dur(b); d.completedMin += m; completedMin += m; doneSched += dur(b);
      const s = subj.get(b.workId) ?? '?'; bySubject[s] = (bySubject[s] ?? 0) + m;
    } else if (b.status === 'skipped') skippedSched += dur(b);
  }
  const base = doneSched + skippedSched;
  return { plannedMin, completedMin, counts, byDay, bySubject, compliance: base ? Math.round(100 * doneSched / base) : null };
}
