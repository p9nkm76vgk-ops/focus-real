import test from 'node:test';
import assert from 'node:assert/strict';
import { PARAMS, estimateExam, estimateTask, calibrate, ratioOf, reestimate, assignTopics } from '../src/core/estimator.ts';
import { plan, DEFAULT_SETTINGS } from '../src/core/planner.ts';
import type { Topic, Work, Block, SessionLog } from '../src/core/types.ts';

const tp = (id: string, o: Partial<Topic> = {}): Topic => ({ id, name: id, size: 3, difficulty: 3, mastery: 0, ...o });
const log = (o: Partial<SessionLog> = {}): SessionLog => ({ actualMin: 50, progress: 100, difficulty: 3, goalMet: true, interrupted: false, ...o });
const smp = (ratio: number, o = {}) => ({ subjectId: 'm', kind: 'problemas' as const, planned: 50, log: log({ actualMin: 50 * ratio }), ...o });
const ex = (topics: Topic[], o = {}) => estimateExam({ topics, kind: 'problemas', goal: 'notable', ...o });

test('tarea con información incompleta: estimación inicial provisional dentro de límites', () => {
  const e = estimateTask({ kind: 'ejercicios', size: 3, difficulty: 3 });
  assert.ok(e.remainingMin >= 10 && e.remainingMin <= 600); assert.equal(e.confidence, 'inicial'); assert.ok(e.provisional); assert.ok(e.lowMin < e.remainingMin && e.highMin > e.remainingMin);
});
test('examen con temas de distinta dificultad: el difícil recibe más tiempo y el desglose cuadra', () => {
  const e = ex([tp('facil', { difficulty: 1 }), tp('dificil', { difficulty: 5 })]);
  const [f, d] = e.perTopic; assert.ok(d.remainingMin > f.remainingMin);
  assert.ok(Math.abs(e.perTopic.reduce((a, t) => a + t.remainingMin, 0) - e.remainingMin) <= 2);
});
test('más preparación → menos trabajo restante (monótono)', () => {
  const r = [0, 1, 2, 3].map(m => ex([tp('a', { mastery: m }), tp('b', { mastery: m })]).remainingMin);
  assert.ok(r[0] > r[1] && r[1] > r[2] && r[2] > r[3] && r[3] > 0, String(r));
});
test('el tipo de aprendizaje cambia la estimación', () => {
  const k = (kind: any) => estimateExam({ topics: [tp('a')], kind, goal: 'notable' }).remainingMin;
  assert.ok(k('problemas') > k('comprension')); assert.ok(k('memorizacion') > k('comprension'));
});
// LEGADO v1 (se mantiene: los trabajos existentes siguen en v1 hasta que el usuario elija v2). Defecto conocido; en v2 se cubre en fase 2: consagra el suelo de 20 min y los topes duros (causas 2, 3 y 8)
test('límites razonables ante combinaciones extremas', () => {
  const big = estimateExam({ topics: Array.from({ length: 40 }, (_, i) => tp('t' + i, { size: 5, difficulty: 5 })), kind: 'problemas', goal: 'excelente' });
  assert.ok(big.totalMin <= PARAMS.examClamp[1]);
  const tiny = estimateExam({ topics: [tp('x', { size: 1, difficulty: 1, mastery: 3 })], kind: 'comprension', goal: 'aprobar' });
  assert.ok(tiny.remainingMin >= PARAMS.examClamp[0]);
  assert.ok(estimateTask({ kind: 'problemas', size: 5, difficulty: 5 }).remainingMin <= PARAMS.taskClamp[1]);
});
// LEGADO v1 (se mantiene: los trabajos existentes siguen en v1 hasta que el usuario elija v2). Defecto conocido; en v2 se cubre en fase 2: fija el 15 % universal; en v2 el repaso depende del calendario
test('repaso contado una sola vez (15 % de aprendizaje+práctica)', () => {
  const e = ex([tp('a'), tp('b')]); assert.ok(Math.abs(e.reviewMin - 0.15 * (e.learnMin + e.practiceMin)) <= 2);
  assert.ok(Math.abs(e.learnMin + e.practiceMin + e.reviewMin - e.remainingMin) <= 2);
});
// LEGADO v1 (se mantiene: los trabajos existentes siguen en v1 hasta que el usuario elija v2). Defecto conocido; en v2 se cubre en fase 3: calibra con real/duración del bloque (causa 7)
test('adaptación gradual a datos reales y acotada', () => {
  const f = (n: number) => calibrate(Array.from({ length: n }, () => smp(1.4)), 'm', 'problemas');
  assert.equal(calibrate([smp(1.4), smp(1.4)], 'm', 'problemas').level, 'ninguno');
  assert.ok(f(3).factor > 1 && f(3).factor < 1.1); assert.ok(f(6).factor > f(3).factor); assert.ok(f(12).factor > f(6).factor && f(12).factor <= PARAMS.calClamp[1]);
  assert.equal(ex([tp('a')], { cal: f(12) }).confidence, 'personalizada');
});
// LEGADO v1 (se mantiene: los trabajos existentes siguen en v1 hasta que el usuario elija v2). Defecto conocido; en v2 se cubre en fase 3: valida `ratioOf` sobre esa semántica; se conserva el principio de robustez
test('resiste sesiones atípicas e inválidas', () => {
  const base = Array.from({ length: 9 }, () => smp(1));
  const withOutlier = calibrate([...base, smp(2)], 'm', 'problemas'); assert.ok(Math.abs(withOutlier.factor - 1) < 0.05);
  assert.equal(ratioOf(smp(1, { log: log({ interrupted: true }) })), null); assert.equal(ratioOf(smp(1, { log: log({ goalMet: false, progress: 10 }) })), null);
  assert.equal(ratioOf(smp(1, { log: log({ actualMin: 400 }) })), null); assert.equal(ratioOf(smp(1, { log: log({ actualMin: 2 }) })), null);
  assert.equal(calibrate([...base, ...Array.from({ length: 20 }, () => smp(1, { log: log({ interrupted: true, actualMin: 500 }) }))], 'm', 'problemas').factor, 1);
});
// LEGADO v1 (se mantiene: los trabajos existentes siguen en v1 hasta que el usuario elija v2). Defecto conocido; en v2 se cubre en fase 2: exige que minutos sin tema resten 1:1 (causa 5)
test('trabajo pendiente: el progreso se mide por dominio de temas, no por minutos sentado', () => {
  const t = [tp('a'), tp('b')], full = ex(t).remainingMin;
  assert.equal(ex(t, { invested: 120 }).remainingMin, full, 'minutos atribuidos a un tema no reducen por sí solos');
  assert.ok(ex(t, { invested: 120, unattributed: 120 }).remainingMin < full);
  assert.ok(ex([tp('a', { mastery: 2 }), tp('b')], { invested: 120 }).remainingMin < full);
});
test('corrección manual fija el total sin contarse como tiempo estudiado', () => {
  const e = ex([tp('a')], { manualMin: 300, invested: 60 }); assert.equal(e.remainingMin, 240); assert.equal(e.investedMin, 60);
});

const NOW = { date: '2026-10-12', minute: 480 };
const exam = (o: Partial<Work> = {}): Work => ({ id: 'e', kind: 'exam', subjectId: 'm', title: 'Parcial', dueDate: '2026-10-21', estMin: 0, difficulty: 3, importance: 4, readiness: 0, status: 'pending', learn: 'problemas', goal: 'notable', topics: [tp('a', { difficulty: 5 }), tp('b'), tp('c', { mastery: 2 })], ...o });
const run = (works: Work[], blocks: Block[]) => { const w = reestimate(works, blocks); return { w, r: plan({ settings: DEFAULT_SETTINGS, works: w, blocks }, NOW) }; };
const live = (bs: Block[]) => bs.filter(b => b.status === 'planned').reduce((a, b) => a + b.end - b.start, 0);
test('integración con el planificador: reparte el trabajo restante, idempotente, sin duplicar', () => {
  const a = run([exam()], []); assert.equal(live(a.r.blocks), a.w[0].estimate!.remainingMin); assert.equal(a.r.warnings.length, 0);
  const b = run(a.w, a.r.blocks); assert.deepEqual(b.r.blocks, a.r.blocks); assert.equal(new Set(b.r.blocks.map(x => x.id)).size, b.r.blocks.length);
  const topics = assignTopics(a.w[0], a.r.blocks); assert.equal(Object.keys(topics).length, a.r.blocks.length); assert.equal(topics[a.r.blocks[0].id], 'a', 'primero el tema difícil y poco dominado');
});
// LEGADO v1 (se mantiene: los trabajos existentes siguen en v1 hasta que el usuario elija v2). Defecto conocido; en v2 se cubre en fase 2: el dominio sube con progreso autodeclarado (causa 4)
test('al completar y registrar avance se replanifica solo lo restante y se conserva el historial', () => {
  const a = run([exam()], []); const first = a.r.blocks[0];
  const done = a.r.blocks.map(b => b.id === first.id ? { ...b, status: 'done' as const, actualMin: 50, log: log({ topicId: 'a', progress: 60 }) } : b);
  const w2 = a.w.map(w => ({ ...w, topics: w.topics!.map(t => t.id === 'a' ? { ...t, mastery: 1.8 } : t) }));
  const b = run(w2, done); assert.ok(b.w[0].estimate!.remainingMin < a.w[0].estimate!.remainingMin);
  assert.equal(live(b.r.blocks), b.w[0].estimate!.remainingMin); assert.deepEqual(b.r.blocks.find(x => x.id === first.id), done[0]);
  const c = run(b.w, b.r.blocks); assert.deepEqual(c.r.blocks, b.r.blocks);
});
test('déficit real cuando el calendario no basta', () => {
  const a = run([exam({ dueDate: '2026-10-13', topics: Array.from({ length: 10 }, (_, i) => tp('t' + i, { size: 5, difficulty: 5 })) })], []);
  assert.ok(a.r.warnings.some(w => w.type === 'deficit' && w.deficitMin! > 0));
});
test('datos antiguos (sin topics ni estimate) siguen igual', () => {
  const old: Work = { id: 'o', kind: 'task', subjectId: 'm', title: 'x', dueDate: '2026-10-16', estMin: 90, difficulty: 3, importance: 3, readiness: 0, status: 'pending' };
  assert.deepEqual(reestimate([old], []), [old]); assert.equal(live(plan({ settings: DEFAULT_SETTINGS, works: [old], blocks: [] }, NOW).blocks), 90);
});
