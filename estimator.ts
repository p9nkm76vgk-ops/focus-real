import type { Block, Estimate, EstimateV2, Goal, Learn, PredictionRecord, SessionLog, Topic, Work } from './types.ts';
import { estimateV2 } from './estimator2.ts';

/** Parámetros explícitos y ajustables. Son reglas orientativas, NO un modelo científico. */
export const PARAMS = {
  baseMin: 35,   // min de un tema de cantidad 1, dificultad media, desde cero
  taskBase: 25,  // min por unidad de cantidad en una tarea
  diff: { 1: 0.7, 2: 0.85, 3: 1, 4: 1.2, 5: 1.4 } as Record<number, number>,
  type: { comprension: 1, memorizacion: 1.1, ejercicios: 1.15, problemas: 1.3, comentario: 1.2, practica: 1.1, mixto: 1.1 } as Record<Learn, number>,
  goal: { aprobar: 0.8, notable: 1, excelente: 1.25 } as Record<Goal, number>,
  mastery: [1, 0.6, 0.3, 0.12],  // fracción del trabajo que queda en 0,1,2,3 (interpolada)
  split: { comprension: [0.7, 0.3], memorizacion: [0.6, 0.4], ejercicios: [0.3, 0.7], problemas: [0.35, 0.65], comentario: [0.4, 0.6], practica: [0.2, 0.8], mixto: [0.5, 0.5] } as Record<Learn, [number, number]>, // [aprendizaje, práctica]
  review: 0.15,                  // repaso: UNA sola vez, sobre (aprendizaje+práctica)
  multClamp: [0.6, 1.8], topicClamp: [5, 300], examClamp: [20, 3000], taskClamp: [10, 600],
  rangeInitial: 0.3, rangePersonal: 0.15, rangeProvisional: 0.1,
  calClamp: [0.6, 1.6], window: 20, minValidMin: 5, maxOverrun: 3, minProgress: 0.2,
};
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const pct = (x: number) => `${x >= 0 ? '+' : '−'}${Math.abs(Math.round(x * 100))}%`;
export const fracMastery = (m: number) => { const t = PARAMS.mastery, x = clamp(m, 0, 3), i = Math.min(2, Math.floor(x)); return t[i] + (t[i + 1] - t[i]) * (x - i); };
const mult = (d: number, k: Learn, g: Goal) => clamp((PARAMS.diff[Math.round(d)] ?? 1) * PARAMS.type[k] * PARAMS.goal[g], PARAMS.multClamp[0], PARAMS.multClamp[1]);

// ---------- Aprendizaje personal: medianas robustas ----------
export interface Sample { subjectId: string; kind: Learn; planned: number; log: SessionLog }
export interface Calib { factor: number; n: number; level: string }
/** Cociente (tiempo necesario / tiempo previsto). null = registro no fiable (interrumpida, sin avance real, absurda). */
export function ratioOf(s: Sample): number | null {
  const { planned, log } = s;
  if (log.interrupted || !(planned > 0) || !(log.actualMin >= PARAMS.minValidMin) || log.actualMin > planned * PARAMS.maxOverrun + 30) return null;
  const p = log.goalMet ? 1 : clamp(log.progress / 100, 0, 1);
  if (p < PARAMS.minProgress) return null;
  return clamp(log.actualMin / p / planned, 0.5, 2);
}
export const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
/** Nivel más específico con datos suficientes (tipo≥5, asignatura≥5, global≥3); el ajuste crece gradualmente con n. */
export function calibrate(samples: Sample[], subjectId: string, kind: Learn): Calib {
  const pick = (f: (s: Sample) => boolean) => samples.filter(f).map(ratioOf).filter((r): r is number => r !== null).slice(-PARAMS.window);
  const levels: [string, number[], number][] = [['tipo', pick(s => s.subjectId === subjectId && s.kind === kind), 5], ['asignatura', pick(s => s.subjectId === subjectId), 5], ['global', pick(() => true), 3]];
  for (const [level, r, min] of levels) if (r.length >= min) {
    const w = Math.min(1, (r.length - 2) / 8);
    return { factor: clamp(1 + (median(r) - 1) * w, PARAMS.calClamp[0], PARAMS.calClamp[1]), n: r.length, level };
  }
  return { factor: 1, n: 0, level: 'ninguno' };
}
const NOCAL: Calib = { factor: 1, n: 0, level: 'ninguno' };

function build(a: { L: number; Pr: number; R: number; per: { id: string; name: string; t: number }[]; cal: Calib; invested: number; unattributed: number; manualMin?: number; factors: string[]; provisional: boolean }): Estimate {
  const raw = (a.L + a.Pr + a.R) * a.cal.factor;
  const rem = a.manualMin != null ? Math.max(0, a.manualMin - a.invested) : Math.max(0, raw - a.unattributed);
  const s = raw > 0 ? rem / (raw) : 0, f = a.cal.factor * s;
  const range = (a.cal.level !== 'ninguno' ? PARAMS.rangePersonal : PARAMS.rangeInitial) + (a.provisional ? PARAMS.rangeProvisional : 0);
  const factors = [...a.factors];
  if (a.manualMin != null) factors.push('Corregida manualmente por ti (total fijado; no cuenta como tiempo estudiado)');
  factors.push(a.cal.level === 'ninguno' ? 'Estimación inicial: aún no hay historial suficiente' : `Ajustada a tu historial (${a.cal.level}, ${a.cal.n} sesiones válidas): ${pct(a.cal.factor - 1)}`);
  const R = (x: number) => Math.round(x);
  return { totalMin: R(a.invested + rem), investedMin: R(a.invested), remainingMin: R(rem), lowMin: R(rem * (1 - range)), highMin: R(rem * (1 + range)), learnMin: R(a.L * f), practiceMin: R(a.Pr * f), reviewMin: R(a.R * f),
    perTopic: a.per.map(t => ({ id: t.id, name: t.name, remainingMin: R(t.t * f) })), factors, confidence: a.cal.level === 'ninguno' ? 'inicial' : 'personalizada', provisional: a.provisional, calibration: a.cal };
}

export function estimateExam(i: { topics: Topic[]; kind: Learn; goal: Goal; cal?: Calib; invested?: number; unattributed?: number; manualMin?: number }): Estimate {
  const P = PARAMS; let L = 0, Pr = 0, full = 0, dm = 0, sz = 0; const per: { id: string; name: string; t: number }[] = [];
  const [a, b] = P.split[i.kind];
  for (const t of i.topics) {
    const m = mult(t.difficulty, i.kind, i.goal), at0 = clamp(t.size * P.baseMin * m, P.topicClamp[0], P.topicClamp[1]);
    const tt = clamp(t.size * P.baseMin * m * fracMastery(t.mastery), P.topicClamp[0], P.topicClamp[1]);
    L += tt * a; Pr += tt * b; full += at0; per.push({ id: t.id, name: t.name, t: tt * (1 + P.review) }); dm += t.size * (P.diff[Math.round(t.difficulty)] ?? 1); sz += t.size;
  }
  let R = P.review * (L + Pr); const raw = L + Pr + R, c = clamp(raw, P.examClamp[0], P.examClamp[1]) / (raw || 1);
  L *= c; Pr *= c; R *= c; per.forEach(t => t.t *= c);
  const cur = L + Pr, dAvg = dm / (sz || 1), red = 1 - (cur / (c || 1)) / (full || 1);
  const factors = [`${i.topics.length} tema(s), cantidad media ${(sz / (i.topics.length || 1)).toFixed(1)}/5`, `Dificultad ${dAvg > 1.1 ? 'alta' : dAvg < 0.92 ? 'baja' : 'media'} (${pct(dAvg - 1)})`,
    ...(red > 0.02 ? [`Preparación previa: ${pct(-red)} del trabajo`] : []), `Tipo: ${i.kind} (${pct(P.type[i.kind] - 1)}) · objetivo: ${i.goal}`, `Repaso final incluido una vez: ${Math.round(R)} min`];
  return build({ L, Pr, R, per, cal: i.cal ?? NOCAL, invested: i.invested ?? 0, unattributed: i.unattributed ?? 0, manualMin: i.manualMin, factors, provisional: i.topics.every(t => !t.explicit) });
}
export function estimateTask(i: { kind: Learn; size: number; difficulty: number; cal?: Calib; invested?: number; manualMin?: number }): Estimate {
  const P = PARAMS, m = mult(i.difficulty, i.kind, 'notable'), base = clamp(i.size * P.taskBase * m, P.taskClamp[0], P.taskClamp[1]);
  const factors = [`Cantidad ${i.size}/5 · dificultad ${i.difficulty}/5 (${pct(m - 1)} por dificultad y tipo)`];
  return build({ L: 0, Pr: base, R: 0, per: [], cal: i.cal ?? NOCAL, invested: i.invested ?? 0, unattributed: i.invested ?? 0, manualMin: i.manualMin, factors, provisional: i.size === 3 && i.difficulty === 3 });
}

const cmp = (a: Block, b: Block) => a.date.localeCompare(b.date) || a.start - b.start || a.id.localeCompare(b.id);
/** Recalcula la estimación de los trabajos ACTIVOS con estimador. No toca sesiones ni historial. Pura e idempotente. */
export interface EstCtx { families?: Record<string, string>; predictions?: PredictionRecord[]; now?: string; capacityFor?: (w: Work) => { freeMin: number; freeDays: number } }
/** Forma compatible con la UI y el planificador a partir de la estimación v2 (el central p50 es lo que se planifica). */
const toV1 = (e: EstimateV2): Estimate => { const m = (p: string) => e.phases.find(x => x.phase === p)?.minutes ?? 0;
  return { totalMin: e.totalMin, investedMin: e.investedMin, remainingMin: e.interval.p50, lowMin: e.interval.p10, highMin: e.interval.p90, learnMin: m('aprendizaje'), practiceMin: m('practica') + m('recuperacion') + m('errores'), reviewMin: m('repaso'),
    perTopic: (e.perTopic ?? []).map(t => ({ id: t.id, name: t.name, remainingMin: t.remainingMin })), factors: e.factors ?? [], confidence: e.interval.kind === 'calibrado' ? 'personalizada' : 'inicial', provisional: e.provisional, calibration: { factor: 1, n: e.calibration?.speedSamples ?? 0, level: 'v2' } }; };
export function reestimate(works: Work[], blocks: Block[], ctx?: EstCtx): Work[] {
  const byW = new Map(works.map(w => [w.id, w]));
  const samples = blocks.filter(b => b.status === 'done' && b.log).sort(cmp).flatMap(b => { const w = byW.get(b.workId); return w ? [{ subjectId: w.subjectId, kind: (w.learn ?? 'mixto') as Learn, planned: b.end - b.start, log: b.log! }] : []; });
  return works.map(w => {
    if (w.estimatorVersion === 2 && (w.status === 'pending' || w.status === 'in_progress')) { // v2 SOLO si el usuario lo eligió; no toca estMin ni readiness (vuelta atrás limpia)
      const fam = ctx?.families?.[w.subjectId] ?? 'generico', fb = blocks.filter(b => b.status === 'done' && (ctx?.families?.[byW.get(b.workId)?.subjectId ?? ''] ?? 'generico') === fam);
      const e2 = estimateV2({ workId: w.id, now: ctx?.now, kind: w.kind, learn: w.learn ?? (w.kind === 'exam' ? 'mixto' : 'ejercicios'), goal: w.goal ?? 'notable', family: fam, topics: w.topics, task: w.kind === 'task' ? { difficulty: w.difficulty, units: w.units } : undefined, blocks: fb, predictions: ctx?.predictions ?? [], capacity: ctx?.capacityFor?.(w), manualMin: w.manualEstMin });
      return { ...w, estimateV2: e2, estimate: toV1(e2) };
    }
    if ((w.status !== 'pending' && w.status !== 'in_progress') || !(w.topics?.length || w.autoEst)) return w;
    const done = blocks.filter(b => b.workId === w.id && b.status === 'done'), mins = (b: Block) => b.actualMin ?? b.end - b.start;
    const invested = done.reduce((x, b) => x + mins(b), 0), unattributed = done.filter(b => !b.log?.topicId).reduce((x, b) => x + mins(b), 0);
    const kind = w.learn ?? (w.kind === 'exam' ? 'mixto' : 'ejercicios'), cal = calibrate(samples, w.subjectId, kind);
    if (w.topics?.length) {
      const e = estimateExam({ topics: w.topics, kind, goal: w.goal ?? 'notable', cal, invested, unattributed, manualMin: w.manualEstMin });
      const rd = Math.round(100 * w.topics.reduce((x, t) => x + t.mastery, 0) / (3 * w.topics.length));
      return { ...w, estimate: e, estMin: Math.max(5, Math.round(e.totalMin / 5) * 5), readiness: rd };
    }
    const e = estimateTask({ kind, size: w.size ?? 3, difficulty: w.difficulty, cal, invested, manualMin: w.manualEstMin });
    return { ...w, estimate: e, estMin: Math.max(5, Math.round(e.totalMin / 5) * 5) };
  });
}
/** Asigna tema a cada sesión futura automática: primero los temas con más trabajo pendiente (difíciles y poco dominados). */
export function assignTopics(w: Work, blocks: Block[]): Record<string, string> {
  if (!w.topics?.length || !w.estimate) return {};
  const rem = new Map(w.estimate.perTopic.map(t => [t.id, t.remainingMin])), out: Record<string, string> = {};
  for (const b of blocks.filter(x => x.workId === w.id && x.status === 'planned' && !x.manual).sort(cmp)) {
    let best: string | null = null; for (const [id, r] of rem) if (best === null || r > rem.get(best)!) best = id;
    if (best !== null) { out[b.id] = best; rem.set(best, rem.get(best)! - (b.end - b.start)); }
  }
  return out;
}
