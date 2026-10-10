// TESTS DE ACEPTACIÓN del estimador 2.0 (unitarios, en Node): comportamiento exigido a src/core/estimator2.ts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateV2, recordPrediction, closePrediction } from '../src/core/estimator2.ts';
import type { Block, EstimateInputV2, Topic, PredictionRecord, Attempt } from '../src/core/types.ts';

const A = (n: string, _phase: number, fn: () => void) => test(n, fn);
const tp = (o: Partial<Topic> = {}): Topic => ({ id: 't', name: 't', size: 3, difficulty: 3, mastery: 0, extent: { unit: 'apartado', count: 4 }, evidence: [], ...o });
const att = (independent: number, o: Partial<Attempt> = {}): Attempt => ({ at: '2026-10-01', items: independent + (o.assisted ?? 0) + (o.wrong ?? 0), independent, assisted: 0, wrong: 0, skipped: 0, ...o });
const E = (o: Partial<EstimateInputV2> = {}) => estimateV2({ kind: 'exam', learn: 'problemas', goal: 'notable', topics: [tp()], blocks: [], predictions: [], ...o });
const blk = (o: Partial<Block> = {}): Block => ({ id: 'b' + Math.random(), workId: 'w', date: '2026-10-05', start: 600, end: 650, status: 'done', manual: false, ...o });
const preds = (n: number, e = 0): PredictionRecord[] => Array.from({ length: n }, (_, i) => ({ id: 'p' + i, workId: 'w' + i, phase: 'total', at: '2026-10-01', predictedMin: 100, p10: 70, p90: 140, modelVersion: 'v2', observedMin: 100 * Math.exp(e) }));
const r = (e: ReturnType<typeof E>) => e.interval.p90 / e.interval.p10;

// --- demasiado bajo / sin información ---
A('examen sin temas: rango muy ancho, evidencia «ninguna», confianza muy baja y provisional', 2, () => { const e = E({ topics: undefined }); assert.ok(r(e) >= 2.5); assert.equal(e.evidenceLevel, 'ninguna'); assert.equal(e.confidence, 'muy baja'); assert.ok(e.provisional); });
A('dificultad 4 y 5 dan resultados distintos', 2, () => assert.notEqual(E({ topics: [tp({ difficulty: 4 })] }).interval.p50, E({ topics: [tp({ difficulty: 5 })] }).interval.p50));
A('el doble de extensión aumenta la estimación', 2, () => assert.ok(E({ topics: [tp({ extent: { unit: 'apartado', count: 8 } })] }).interval.p50 > E().interval.p50));
A('sin tope silencioso: un tema 10× más extenso crece y, si hay cota de cordura, se informa', 2, () => { const big = E({ topics: [tp({ extent: { unit: 'apartado', count: 40 } })] }); assert.ok(big.interval.p50 > E().interval.p50 * 3 || big.capped); });
// --- preparación nula / evidencia ---
A('sin evidencia el intervalo es más ancho que con evidencia baja', 2, () => assert.ok(r(E({ topics: [tp()] })) > r(E({ topics: [tp({ evidence: [att(3, { wrong: 1 })] })] }))));
A('«sin evidencia» nunca estima menos que «dominado con evidencia»', 2, () => assert.ok(E({ topics: [tp({ selfRating: 3, mastery: 3 })] }).interval.p50 > E({ topics: [tp({ selfRating: 3, mastery: 3, evidence: [att(20)] })] }).interval.p50));
// --- escasez de datos ---
A('con menos predicciones que el umbral el rango es «orientativo» y no hay confianza calibrada', 3, () => { const e = E({ predictions: preds(9) }); assert.equal(e.interval.kind, 'orientativo'); assert.notEqual(e.confidence, 'calibrada'); });
A('el umbral es configurable y no una garantía: con umbral 5 y 9 predicciones se calibra', 3, () => assert.equal(E({ predictions: preds(9, 0.2), config: { calibrationMinErrors: 5 } }).interval.kind, 'calibrado'));
A('una predicción atípica no mueve la mediana más de un 5 %', 3, () => { const base = E({ predictions: preds(12) }).interval.p50, out = E({ predictions: [...preds(12), ...preds(1, 2.5)] }).interval.p50; assert.ok(Math.abs(out - base) / base < 0.05); });
// --- progreso real ---
A('minutos sentado sin ítems ni unidades no reducen lo pendiente', 2, () => assert.equal(E({ blocks: [blk({ actualMin: 100, end: 700 })] }).remainingMin, E().remainingMin));
A('ítems independientes reducen lo pendiente y los asistidos no cuentan igual', 2, () => { const ind = E({ topics: [tp({ evidence: [att(8, { wrong: 2 })] })] }).remainingMin, asi = E({ topics: [tp({ evidence: [att(0, { assisted: 8, wrong: 2, items: 10 })] })] }).remainingMin; assert.ok(ind < E().remainingMin); assert.ok(asi > ind); });
A('el total (invertido + restante) no baja tras estudiar sin evidencia', 2, () => { const b = E(), a = E({ blocks: [blk({ actualMin: 50 })] }); assert.ok(a.totalMin >= b.totalMin); });
A('la velocidad aprendida no depende de la longitud del bloque', 3, () => { const log = { phase: 'practica' as const, actualMin: 30, progress: 100, difficulty: 3, goalMet: true, interrupted: false, units: 6 }; const x = E({ blocks: Array.from({ length: 12 }, () => blk({ start: 600, end: 650, actualMin: 30, log })) }).interval.p50, y = E({ blocks: Array.from({ length: 12 }, () => blk({ start: 600, end: 630, actualMin: 30, log })) }).interval.p50; assert.ok(Math.abs(x - y) / y < 0.05); assert.ok(Math.abs(x - E().interval.p50) / E().interval.p50 > 0.05, 'y sí aprende de las unidades'); });
// --- tareas incompletas ---
A('tarea con 3 de 8 unidades hechas: lo pendiente es proporcional a unidades', 2, () => { const full = E({ kind: 'task', topics: undefined, task: { difficulty: 3, units: { unit: 'ejercicio', total: 8, done: 0 } } }).remainingMin, part = E({ kind: 'task', topics: undefined, task: { difficulty: 3, units: { unit: 'ejercicio', total: 8, done: 3 } } }).remainingMin; assert.ok(Math.abs(part / full - 5 / 8) < 0.02); });
A('tarea sin descripción ni unidades: provisional y rango amplio', 2, () => { const e = E({ kind: 'task', topics: undefined, task: { difficulty: 3 } }); assert.ok(e.provisional); assert.ok(r(e) >= 2); });
// --- fechas inviables ---
A('viabilidad: no cabe / sin margen / con margen y espaciado insuficiente', 2, () => { const p = E({ capacity: { freeMin: 1e9, freeDays: 10 } }).interval, f = (freeMin: number, freeDays = 10) => E({ capacity: { freeMin, freeDays } }).viability?.status;
  assert.equal(f(p.p50 - 10), 'no cabe'); assert.equal(f(Math.round((p.p50 + p.p90) / 2)), 'cabe sin margen'); assert.equal(f(p.p90 + 10), 'cabe con margen'); assert.equal(f(p.p90 + 10, 1), 'espaciado insuficiente'); assert.ok((E({ capacity: { freeMin: p.p50 - 10, freeDays: 10 } }).viability?.deficitP50 ?? 0) > 0); });
A('predicciones del mismo trabajo no son evidencia independiente', 3, () => { const same = preds(9).map(p => ({ ...p, workId: 'w' })); const e = E({ predictions: same, config: { calibrationMinErrors: 5 } }); assert.equal(e.interval.kind, 'orientativo'); assert.equal(e.calibration?.nEff, 1); });
A('historial inmutable: no se sobrescribe la predicción original y lo observado se escribe una vez', 3, () => { const rec = preds(1)[0]; const base = { ...rec, observedMin: undefined } as PredictionRecord; let l = recordPrediction([], base); l = recordPrediction(l, { ...base, predictedMin: 999 }); assert.equal(l.length, 1); assert.equal(l[0].predictedMin, 100); l = closePrediction(l, base.id, 130); l = closePrediction(l, base.id, 5); assert.equal(l[0].observedMin, 130); assert.equal(l[0].predictedMin, 100); });
A('retroprueba sintética: usuario 1,5× más lento; el error baja con los datos y la cobertura se informa (valida el algoritmo, NO el mundo real)', 3, () => {
  const seq = (n: number) => Array.from({ length: n }, (_, k) => { const est = E({ predictions: [] }).interval, obs = est.p50 * 1.5; return { id: 'q' + k, workId: 'u' + k, phase: 'total' as const, at: '2026-10-01', predictedMin: est.p50, p10: est.p10, p90: est.p90, modelVersion: 'v2.0', observedMin: obs }; });
  const e0 = E({ predictions: [] }), e12 = E({ predictions: seq(12) }), truth = e0.interval.p50 * 1.5;
  assert.ok(Math.abs(e12.interval.p50 - truth) < Math.abs(e0.interval.p50 - truth), 'el error de la mediana baja'); assert.equal(e12.interval.kind, 'calibrado'); assert.ok(typeof e12.calibration?.coverage === 'number');
});
