import type { Activity, Block, Now, Settings, SuggLog, Warning, Win, Work } from './types.ts';
import { addDays, weekday, subtract } from './planner.ts';

export const EXERCISE_TYPES: [string, string][] = [['caminar', 'Caminar'], ['correr', 'Correr'], ['gimnasio', 'Gimnasio'], ['estiramientos', 'Estiramientos / yoga'], ['deporte', 'Deporte'], ['bicicleta', 'Bicicleta'], ['natacion', 'Natación'], ['otro', 'Otro']];
/** Sesiones moderadas por diseño: sin objetivos de peso, calorías ni cargas extremas. */
export const LIMITS = { minDur: 10, maxDur: 180, maxActual: 300 };
const up5 = (m: number) => Math.ceil(m / 5) * 5, fm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const okDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
export const mondayOf = (d: string) => addDays(d, -((weekday(d) + 6) % 7));

export function freeWindows(s: Settings, blocks: Block[], acts: Activity[], date: string, now?: Now, skipId?: string): Win[] {
  const pad = (b: { start: number; end: number }) => ({ start: b.start - s.minGapMin, end: b.end + s.minGapMin });
  const cuts: Win[] = [...s.blockedDates.filter(b => b.date === date), ...blocks.filter(b => b.date === date && (b.status === 'planned' || b.status === 'done')).map(pad),
    ...acts.filter(a => a.date === date && a.status !== 'skipped' && a.start != null && a.id !== skipId).map(a => pad({ start: a.start!, end: a.end! }))];
  if (now && date === now.date) cuts.push({ start: 0, end: up5(now.minute) });
  return subtract(s.availability[weekday(date)] ?? [], cuts);
}
/** Primer hueco libre dentro de la disponibilidad (misma que el estudio), sin tocar nada. null = no hay: se informa, no se desplaza nada. */
export function findSlot(s: Settings, blocks: Block[], acts: Activity[], from: Now, durMin: number, days = 7, skipId?: string): { date: string; start: number; end: number } | null {
  for (let i = 0; i < days; i++) { const date = addDays(from.date, i); for (const w of freeWindows(s, blocks, acts, date, i === 0 ? from : undefined, skipId)) { const st = up5(w.start); if (w.end - st >= durMin) return { date, start: st, end: st + durMin }; } }
  return null;
}
/** Mensaje de conflicto o null. NUNCA desplaza en silencio: el usuario decide. */
export function conflictOf(a: Activity, blocks: Block[], acts: Activity[]): string | null {
  if (a.start == null || a.end == null) return null;
  const hit = blocks.find(b => b.date === a.date && (b.status === 'planned' || b.status === 'done') && b.start < a.end! && a.start! < b.end);
  if (hit) return `Se solapa con una sesión de estudio (${fm(hit.start)}–${fm(hit.end)}${hit.manual ? ', manual' : ''}${hit.status === 'done' ? ', completada' : ''}).`;
  const other = acts.find(x => x.id !== a.id && x.date === a.date && x.status !== 'skipped' && x.start != null && x.start < a.end! && a.start! < x.end!);
  return other ? `Se solapa con otra actividad (${fm(other.start!)}–${fm(other.end!)}).` : null;
}
export function validateActivity(a: Activity, now: Now): string | null {
  if (!okDate(a.date)) return 'Indica una fecha válida.';
  if (!(a.durMin >= LIMITS.minDur && a.durMin <= LIMITS.maxDur)) return `La duración va de ${LIMITS.minDur} a ${LIMITS.maxDur} minutos.`;
  if (a.start != null && !(a.end! > a.start && a.end! <= 1440 && a.start >= 0)) return 'Revisa la hora.';
  if (a.status === 'done' && !(a.actualMin! >= 1 && a.actualMin! <= LIMITS.maxActual)) return `El tiempo real va de 1 a ${LIMITS.maxActual} minutos.`;
  if (a.status === 'planned' && (a.date < now.date || (a.date === now.date && a.start != null && a.start < now.minute))) return 'No se puede planificar en el pasado: márcala como completada u omitida.';
  return null;
}
export function weekMinutes(acts: Activity[], monday: string) {
  const mine = acts.filter(a => a.category === 'exercise' && a.date >= monday && a.date <= addDays(monday, 6));
  return { doneMin: mine.filter(a => a.status === 'done').reduce((x, a) => x + (a.actualMin ?? 0), 0), plannedMin: mine.filter(a => a.status === 'planned').reduce((x, a) => x + a.durMin, 0), sessions: mine.filter(a => a.status === 'done').length };
}

// ---------- Actividades de reserva (solo SUGERENCIAS: no son tareas, bloques ni evidencia) ----------
export type SuggKind = 'descanso' | 'repaso' | 'tarjetas' | 'practica' | 'apuntes' | 'preparar' | 'lectura' | 'ejercicio';
export interface Suggestion { id: string; kind: SuggKind; title: string; minutes: number; energy: 'baja' | 'media' | 'alta'; reason: string; subjectId?: string; slot: { start: number; end: number } }
const CAT: { kind: SuggKind; min: number; ideal: number; energy: 'baja' | 'media' | 'alta'; subj?: boolean }[] = [
  { kind: 'repaso', min: 10, ideal: 15, energy: 'media', subj: true }, { kind: 'tarjetas', min: 10, ideal: 15, energy: 'media', subj: true }, { kind: 'practica', min: 20, ideal: 25, energy: 'alta', subj: true },
  { kind: 'apuntes', min: 15, ideal: 20, energy: 'baja', subj: true }, { kind: 'preparar', min: 10, ideal: 15, energy: 'baja' }, { kind: 'lectura', min: 15, ideal: 25, energy: 'baja' },
  { kind: 'ejercicio', min: 30, ideal: 30, energy: 'media' }, { kind: 'descanso', min: 10, ideal: 10, energy: 'baja' }];
const EN = { baja: 0, media: 1, alta: 2 } as const;
const remaining = (w: Work, blocks: Block[]) => w.estimate?.remainingMin ?? Math.max(0, w.estMin - blocks.filter(b => b.workId === w.id && b.status === 'done').reduce((a, b) => a + (b.actualMin ?? b.end - b.start), 0));
export function suggest(i: { settings: Settings; works: Work[]; blocks: Block[]; activities: Activity[]; log: SuggLog[]; now: Now; forced?: boolean; max?: number; warnings?: Warning[]; names?: Record<string, string> }) {
  const { now } = i, active = i.works.filter(w => w.status === 'pending' || w.status === 'in_progress'), lim = addDays(now.date, 2);
  const deficit = new Set((i.warnings ?? []).filter(w => w.type === 'deficit').map(w => w.workId));
  const planned = (w: Work) => i.blocks.filter(b => b.workId === w.id && b.status === 'planned' && (b.date > now.date || (b.date === now.date && b.end > now.minute))).reduce((a, b) => a + b.end - b.start, 0);
  // Prioritario = hay déficit, está atrasado, o vence pronto y su trabajo restante NO está cubierto por sesiones ya planificadas.
  const priority = active.filter(w => { const rem = remaining(w, i.blocks); return rem > 0 && (deficit.has(w.id) || w.dueDate < now.date || (w.dueDate <= lim && rem - planned(w) > 0)); }).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const started = i.log.filter(l => l.date === now.date && l.status === 'started' && !i.log.some(x => x.id === l.id && x.status !== 'started'));
  if (priority.length && !i.forced) return { mode: 'prioridad' as const, priority, items: [] as Suggestion[], started, note: 'Hay trabajo prioritario: primero eso. Las alternativas opcionales quedan ocultas (puedes consultarlas igualmente).' };
  const wins = freeWindows(i.settings, i.blocks, i.activities, now.date, now).filter(w => w.end - up5(w.start) >= 10).sort((a, b) => (b.end - b.start) - (a.end - a.start));
  if (!wins.length) return { mode: 'sin-hueco' as const, priority, items: [], started, note: 'No quedan huecos libres hoy. Descansar también es un buen plan.' };
  const win = wins[0], st = up5(win.start), room = win.end - st, h = now.minute, want = h < 720 ? 2 : h < 1020 ? 1 : h < 1200 ? 1 : 0;
  const exam = active.filter(w => w.kind === 'exam' && w.dueDate >= now.date).sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0], subj = (exam ?? active[0])?.subjectId;
  const tomorrow = addDays(now.date, 1), wk = weekMinutes(i.activities, mondayOf(now.date));
  const blocked = (id: string) => i.log.some(l => l.id === id && (l.status !== 'postponed' ? true : (l.until ?? 0) > now.minute));
  const items: Suggestion[] = [];
  CAT.forEach((c, idx) => {
    const id = `${now.date}|${c.kind}`; if (blocked(id) || c.min > room || (c.subj && !subj)) return;
    if (c.kind === 'preparar' && !(h >= 1020 && (i.blocks.some(b => b.date === tomorrow && b.status === 'planned') || active.some(w => w.dueDate === tomorrow)))) return;
    if (c.kind === 'ejercicio' && !(h < 1200 && wk.sessions < 2)) return;
    const minutes = Math.min(c.ideal, room), score = 2 - Math.abs(EN[c.energy] - want), name = subj ? i.names?.[subj] ?? '' : '';
    const T: Record<SuggKind, [string, string]> = { repaso: [`Repaso breve sin apuntes${name ? ' de ' + name : ''}`, 'Intentar recordar sin mirar suele rendir más que releer.'], tarjetas: [`Tarjetas de memoria${name ? ' de ' + name : ''}`, 'Práctica de recuperación corta.'], practica: [`Ejercicios de práctica${name ? ' de ' + name : ''}`, 'Hay hueco largo y energía adecuada.'], apuntes: [`Organizar apuntes${name ? ' de ' + name : ''}`, 'Tarea ligera, poco esfuerzo.'], preparar: ['Preparar el día de mañana', 'Mañana tienes estudio o entregas.'], lectura: ['Lectura tranquila', 'Baja exigencia para cerrar la jornada.'], ejercicio: ['Ejercicio físico suave', 'Esta semana llevas pocas sesiones; es opcional.'], descanso: ['Descanso de 10 minutos', 'Parar también cuenta.'] };
    items.push({ id, kind: c.kind, title: T[c.kind][0], minutes, energy: c.energy, reason: T[c.kind][1], subjectId: c.subj ? subj : undefined, slot: { start: st, end: st + minutes }, ...{ _s: score * 10 - idx } } as any);
  });
  items.sort((a: any, b: any) => b._s - a._s); items.forEach((x: any) => delete x._s);
  return { mode: 'libre' as const, priority: i.forced ? priority : [], items: items.slice(0, i.max ?? 3), started, note: 'No hace falta ocupar cada minuto: puedes terminar la jornada cuando quieras.' };
}
