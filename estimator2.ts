/** ESTIMADOR 2.0. Estructura respaldada por la literatura (recuperación sin apuntes, repaso espaciado, ejemplos resueltos para novatos);
 *  TODOS los valores numéricos de V2 son HEURISTICO-PREVIO (valores iniciales sin respaldo empírico) y se sustituyen por datos del usuario.
 *  El dominio es una estimación probabilística (Beta con prior débil), NO una medición objetiva. Sin dependencias. */
import type { Attempt, Block, EstimateInputV2, EstimateV2, EvidenceLevel, Phase, PredictionRecord, Topic } from './types.ts';
import { DEFAULT_ESTIMATOR_CONFIG, UNIT_PROFILES } from './config.ts';

export const V2 = {
  diff: { 1: 0.7, 2: 0.85, 3: 1, 4: 1.25, 5: 1.5 } as Record<number, number>,           // sin saturación: cada nivel es distinto
  speed: { aprendizaje: 25, practica: 30, recuperacion: 12, errores: 15, repaso: 8 } as Record<Phase, number>, // min/unidad (previo)
  sigma0: 0.4, unknownExtent: 4, unknownSpread: 2, learnCut: 0.5, reviewMax: 5, z: 1.2816, winsor: 4,
};
const PH: Phase[] = ['aprendizaje', 'practica', 'recuperacion', 'errores', 'repaso'];
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const LV: EvidenceLevel[] = ['ninguna', 'baja', 'media', 'alta'];
const days = (a: string, b: string) => Math.max(0, (Date.parse(b) - Date.parse(a)) / 864e5);

/** Dominio: Beta(α,β). Prior débil desde el autoinforme (selfRatingPseudoItems ítems); solo los aciertos INDEPENDIENTES cuentan como éxito;
 *  con ayuda y omitidos cuentan como medio fallo; la evidencia antigua pesa menos (olvido exponencial). */
export function masteryOf(t: Topic, cfg = DEFAULT_ESTIMATOR_CONFIG, now?: string) {
  const r = 0.15 + 0.7 * clamp(t.selfRating ?? t.mastery ?? 0, 0, 3) / 3, n0 = cfg.selfRatingPseudoItems;
  let a = 1 + n0 * r, b = 1 + n0 * (1 - r), items = 0;
  for (const x of (t.evidence ?? []) as Attempt[]) {
    const w = now ? Math.exp(-days(x.at, now) / cfg.forgettingDays) : 1;
    a += w * x.independent; b += w * (x.wrong + 0.5 * x.assisted + 0.5 * x.skipped); items += x.independent + x.assisted + x.wrong + x.skipped;
  }
  const m = a / (a + b), sd = Math.sqrt(m * (1 - m) / (a + b + 1));
  const level: EvidenceLevel = items === 0 ? 'ninguna' : items >= cfg.evidenceItemsHigh ? 'alta' : items >= cfg.evidenceItemsMedium ? 'media' : 'baja';
  return { m, lo: clamp(m - V2.z * sd, 0, 1), hi: clamp(m + V2.z * sd, 0, 1), level, items };
}
/** Velocidad por fase (min/unidad): mediana de sesiones VÁLIDAS con unidades y fase, recortadas, contraídas hacia el previo (n0). Sin unidades = solo tiempo. */
export function learnSpeeds(blocks: Block[], cfg = DEFAULT_ESTIMATOR_CONFIG) {
  const out = {} as Record<Phase, { v: number; sigma: number; n: number }>;
  for (const ph of PH) {
    const v0 = V2.speed[ph], obs = blocks.filter(b => b.status === 'done' && b.log?.phase === ph && (b.log.units ?? 0) > 0 && !b.log.interrupted && b.log.valid !== false && (b.actualMin ?? b.log.actualMin) >= cfg.minValidSessionMin)
      .map(b => Math.log(clamp((b.actualMin ?? b.log!.actualMin) / b.log!.units!, v0 / V2.winsor, v0 * V2.winsor)));
    const n = obs.length, n0 = cfg.speedPriorStrength;
    out[ph] = { v: Math.exp(n ? (n0 * Math.log(v0) + n * median(obs)) / (n0 + n) : Math.log(v0)), sigma: V2.sigma0 * Math.sqrt(n0 / (n0 + n)), n };
  }
  return out;
}
const mins = (b: Block) => b.actualMin ?? b.end - b.start;
const quant = (a: number[], q: number) => { const s = [...a].sort((x, y) => x - y); return s[clamp(Math.ceil((s.length + 1) * q) - 1, 0, s.length - 1)]; };
/** Calibración con predicciones cerradas. Las de un mismo trabajo están correlacionadas: cuentan como UNA observación efectiva. */
export function calibration(preds: PredictionRecord[], cfg = DEFAULT_ESTIMATOR_CONFIG) {
  const g = new Map<string, { e: number[]; hit: number[] }>();
  for (const p of preds) if (p.observedMin != null && p.observedMin > 0 && p.predictedMin > 0) { const x = g.get(p.workId) ?? { e: [], hit: [] }; x.e.push(Math.log(p.observedMin / p.predictedMin)); x.hit.push(p.observedMin >= p.p10 && p.observedMin <= p.p90 ? 1 : 0); g.set(p.workId, x); }
  const E = [...g.values()].map(x => x.e.reduce((a, b) => a + b, 0) / x.e.length), H = [...g.values()].map(x => x.hit.reduce((a, b) => a + b, 0) / x.hit.length), n = E.length;
  const shrink = n >= 3 ? Math.min(1, (n - 2) / 8) : 0, calibrated = n >= cfg.calibrationMinErrors;
  return { nEff: n, shift: n ? Math.exp(median(E) * shrink) : 1, calibrated, qlo: calibrated ? Math.min(-0.05, quant(E, 0.1)) : 0, qhi: calibrated ? Math.max(0.05, quant(E, 0.9)) : 0, coverage: calibrated ? H.reduce((a, b) => a + b, 0) / n : null };
}

type Sc = { m: number; u: number; k: number };
function topicMin(sp: Record<Phase, { v: number }>, d: number, target: number, sc: Sc, f: number, phases?: Record<Phase, number>) {
  const gL = clamp((V2.learnCut - sc.m) / V2.learnCut, 0, 1), gP = clamp((target - sc.m) / target, 0, 1), gE = clamp(1 - sc.m, 0, 1);
  const parts: Record<Phase, number> = { aprendizaje: sc.u * d * sp.aprendizaje.v * gL * f, practica: sc.u * d * sp.practica.v * gP * f, recuperacion: sc.u * d * sp.recuperacion.v * (0.3 + 0.7 * gP) * f, errores: sc.u * d * sp.errores.v * gE * f, repaso: sc.u * sp.repaso.v * sc.k * f };
  if (phases) for (const p of PH) phases[p] += parts[p];
  return PH.reduce((a, p) => a + parts[p], 0);
}

export function estimateV2(i: EstimateInputV2): EstimateV2 {
  const cfg = { ...DEFAULT_ESTIMATOR_CONFIG, ...(i.config ?? {}) }, own = i.workId ? i.blocks.filter(b => b.workId === i.workId) : i.blocks;
  const sp = learnSpeeds(i.blocks, cfg), cal = calibration(i.predictions, cfg), invested = own.filter(b => b.status === 'done').reduce((a, b) => a + mins(b), 0);
  const k = i.capacity ? clamp(Math.floor((i.capacity.freeDays - 1) / 2), 1, V2.reviewMax) : 3, target = cfg.targetIndependentSuccess[i.goal];
  const sig = (ph: Phase) => V2.z * sp[ph].sigma, avgSig = PH.reduce((a, p) => a + sig(p), 0) / PH.length;
  let c = 0, lo = 0, hi = 0, unknown = false, level: EvidenceLevel = 'alta'; const phases = Object.fromEntries(PH.map(p => [p, 0])) as Record<Phase, number>, per: NonNullable<EstimateV2['perTopic']> = [], factors: string[] = [];
  if (i.kind === 'task') {
    const u = i.task?.units, tot = u?.total, known = tot != null, left = known ? Math.max(0, tot! - u!.done) : V2.unknownExtent, d = V2.diff[Math.round(i.task?.difficulty ?? 3)] ?? 1, f = Math.exp(0), v = sp.practica;
    c = left * d * v.v; lo = known ? c * Math.exp(-sig('practica')) : c / V2.unknownSpread * Math.exp(-sig('practica')); hi = known ? c * Math.exp(sig('practica')) : c * V2.unknownSpread * Math.exp(sig('practica')); unknown = !known; phases.practica = c; level = 'ninguna';
    factors.push(known ? `${left} de ${tot} unidades pendientes` : 'Cantidad de trabajo desconocida: estimación muy incierta');
  } else {
    const topics = i.topics?.length ? i.topics : [{ id: 'implicito', name: 'Examen completo (sin desglose)', size: 3, difficulty: 3, mastery: 0 } as Topic];
    if (!i.topics?.length) factors.push('Sin desglose por temas: estimación explícitamente incierta');
    for (const t of topics) {
      const ms = masteryOf(t, cfg, i.now), known = t.extent?.count != null, U = known ? t.extent!.count! : V2.unknownExtent, d = V2.diff[Math.round(t.difficulty)] ?? 1, f = 1;
      const before = c; c += topicMin(sp, d, target, { m: ms.m, u: U, k }, f, phases);
      lo += topicMin(sp, d, target, { m: ms.hi, u: known ? U : U / V2.unknownSpread, k }, Math.exp(-avgSig));
      hi += topicMin(sp, d, target, { m: ms.lo, u: known ? U : U * V2.unknownSpread, k }, Math.exp(avgSig));
      if (!known) unknown = true; if (LV.indexOf(ms.level) < LV.indexOf(level)) level = ms.level;
      per.push({ id: t.id, name: t.name, remainingMin: Math.round(c - before), mastery: Math.round(ms.m * 100) / 100, evidenceLevel: ms.level, unknownExtent: !known });
    }
    if (unknown) factors.push('Extensión desconocida en algún tema: se usa un valor previo con incertidumbre mayor');
    if (level === 'ninguna' || level === 'baja') factors.push('Poca evidencia de dominio: el dominio sale sobre todo del autoinforme (peso débil)');
  }
  c *= cal.shift; lo *= cal.shift; hi *= cal.shift;
  if (cal.calibrated) { lo = c * Math.exp(cal.qlo); hi = c * Math.exp(cal.qhi); }
  if (i.manualMin != null) { const r = Math.max(0, i.manualMin - invested) / (c || 1); c *= r; lo *= r; hi *= r; factors.push('Total fijado manualmente por ti (no cuenta como tiempo estudiado)'); }
  let capped = false; if (c + invested > cfg.sanityMaxExamMin) { const r = Math.max(0, cfg.sanityMaxExamMin - invested) / c; c *= r; lo *= r; hi *= r; capped = true; factors.push(`Cota de cordura aplicada (${cfg.sanityMaxExamMin} min): revisa la extensión`); }
  const R = Math.round, spN = Math.max(...PH.map(p => sp[p].n));
  if (spN) factors.push(`Velocidad ajustada con ${spN} sesión(es) válidas con unidades (contraída hacia el valor previo)`);
  factors.push(cal.calibrated ? `Intervalo calibrado con ${cal.nEff} trabajos cerrados (cobertura empírica ${Math.round((cal.coverage ?? 0) * 100)} %)` : 'Rango orientativo y heurístico: sin cobertura estadística demostrada');
  const reliable = cal.calibrated && (cal.coverage ?? 0) >= 0.8 - cfg.coverageTolerance;
  const e: EstimateV2 = { modelVersion: 'v2.0', totalMin: R(invested + c), investedMin: R(invested), remainingMin: R(c), phases: PH.map(p => ({ phase: p, minutes: R(phases[p] * cal.shift) })), interval: { p10: R(lo), p50: R(c), p90: R(hi), kind: cal.calibrated ? 'calibrado' : 'orientativo', n: cal.nEff },
    evidenceLevel: level, confidence: reliable ? 'calibrada' : level === 'ninguna' && unknown ? 'muy baja' : level === 'media' || level === 'alta' ? 'media' : 'baja', provisional: level === 'ninguna' || level === 'baja' || unknown, capped, perTopic: per, factors, unknownExtent: unknown,
    calibration: { nEff: cal.nEff, coverage: cal.coverage, speedSamples: spN } };
  if (i.capacity) { const { freeMin, freeDays } = i.capacity, p = e.interval; e.viability = freeMin < p.p50 ? { status: 'no cabe', deficitP50: p.p50 - freeMin, deficitP90: Math.max(0, p.p90 - freeMin) } : i.kind === 'exam' && freeDays < cfg.minSpacingDays ? { status: 'espaciado insuficiente' } : freeMin < p.p90 ? { status: 'cabe sin margen', deficitP90: p.p90 - freeMin } : { status: 'cabe con margen' }; }
  return e;
}
/** Historial de predicciones: SOLO se añaden registros (no se sobrescribe ninguno) y `observedMin` se escribe una única vez. */
export function recordPrediction(log: PredictionRecord[], rec: PredictionRecord): PredictionRecord[] { return log.some(x => x.id === rec.id) ? log : [...log, rec]; }
export function closePrediction(log: PredictionRecord[], id: string, observedMin: number): PredictionRecord[] { return log.map(x => x.id === id && x.observedMin == null ? { ...x, observedMin } : x); }
export const unitsFor = (family?: string) => (UNIT_PROFILES[family ?? 'generico'] ?? UNIT_PROFILES.generico).units;
