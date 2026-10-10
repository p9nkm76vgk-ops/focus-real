// Integración estimador v2 + planificador (unitarias en Node, sin DOM).
import test from 'node:test';
import assert from 'node:assert/strict';
import { plan, capacityFor, DEFAULT_SETTINGS } from '../src/core/planner.ts';
import { reestimate } from '../src/core/estimator.ts';
import type { Block, Topic, Work } from '../src/core/types.ts';

const NOW = { date: '2026-10-12', minute: 480 };
const tp = (id: string, o: Partial<Topic> = {}): Topic => ({ id, name: id, size: 3, difficulty: 3, mastery: 0, extent: { unit: 'apartado', count: 2 }, evidence: [], ...o });
const exam = (o: Partial<Work> = {}): Work => ({ id: 'e', kind: 'exam', subjectId: 'm', title: 'Parcial', dueDate: '2026-10-21', estMin: 100, difficulty: 3, importance: 4, readiness: 0, status: 'pending', learn: 'problemas', goal: 'notable', topics: [tp('a'), tp('b', { difficulty: 5 })], estimatorVersion: 2, ...o });
const ctx = (blocks: Block[] = [], preds: any[] = []) => ({ families: { m: 'problemas' }, predictions: preds, now: NOW.date, capacityFor: (w: Work) => capacityFor(DEFAULT_SETTINGS, blocks, NOW, w) });
const run = (works: Work[], blocks: Block[] = []) => { const w = reestimate(works, blocks, ctx(blocks)); return { w, r: plan({ settings: DEFAULT_SETTINGS, works: w, blocks }, NOW) }; };
const live = (bs: Block[]) => bs.filter(b => b.status === 'planned').reduce((a, b) => a + b.end - b.start, 0);

test('solo los trabajos en v2 usan el estimador 2.0; los v1 no cambian', () => {
  const v1: Work = { ...exam({ id: 'x', estimatorVersion: undefined, topics: [tp('a')] }) }; const a = reestimate([v1], [], ctx()), b = reestimate([v1, exam()], [], ctx());
  assert.equal(JSON.stringify(a[0]), JSON.stringify(b[0])); assert.equal(a[0].estimateV2, undefined); assert.ok(b[1].estimateV2);
});
test('v2: planifica el central p50, idempotente, sin duplicados; v2 no modifica estMin ni readiness (vuelta atrás limpia)', () => {
  const a = run([exam()]); assert.equal(live(a.r.blocks), a.w[0].estimateV2!.interval.p50); assert.equal(a.w[0].estMin, 100); assert.equal(a.w[0].readiness, 0);
  const b = run(a.w, a.r.blocks); assert.equal(JSON.stringify(b.r.blocks), JSON.stringify(a.r.blocks)); assert.equal(new Set(b.r.blocks.map(x => x.id)).size, b.r.blocks.length);
});
test('v2: una sesión completada sin unidades ni ítems no reduce lo pendiente; la evidencia sí', () => {
  const a = run([exam()]), first = a.r.blocks[0], done: Block = { ...first, status: 'done', actualMin: 50, log: { actualMin: 50, topicId: 'a', progress: 100, difficulty: 3, goalMet: true, interrupted: false } };
  const sinEvid = run(a.w, a.r.blocks.map(b => b.id === first.id ? done : b)); assert.equal(sinEvid.w[0].estimateV2!.remainingMin, a.w[0].estimateV2!.remainingMin, 'autoinforme 100 % no reduce');
  const ev = a.w.map(w => ({ ...w, topics: w.topics!.map(t => t.id === 'a' ? { ...t, evidence: [{ at: '2026-10-12', items: 10, independent: 9, assisted: 0, wrong: 1, skipped: 0 }] } : t) }));
  const conEvid = run(ev, a.r.blocks.map(b => b.id === first.id ? done : b)); assert.ok(conEvid.w[0].estimateV2!.remainingMin < a.w[0].estimateV2!.remainingMin);
  assert.equal(JSON.stringify(conEvid.r.blocks.find(b => b.id === first.id)), JSON.stringify(done), 'sesión completada intacta');
});
test('capacidad real y viabilidad coherente con el planificador', () => {
  const c = capacityFor(DEFAULT_SETTINGS, [], NOW, exam()); assert.ok(c.freeMin > 0 && c.freeDays > 3);
  const blocked = { ...DEFAULT_SETTINGS, blockedDates: Array.from({ length: 12 }, (_, i) => ({ date: `2026-10-${12 + i}`, start: 0, end: 1440 })) };
  assert.deepEqual(capacityFor(blocked, [], NOW, exam()), { freeMin: 0, freeDays: 0 });
  const w = reestimate([exam({ dueDate: '2026-10-13', topics: [tp('a', { extent: { unit: 'a', count: 40 } })] })], [], { ...ctx(), capacityFor: w => capacityFor(DEFAULT_SETTINGS, [], NOW, w) })[0];
  assert.equal(w.estimateV2!.viability?.status, 'no cabe'); assert.ok(w.estimateV2!.viability!.deficitP50! > 0);
  const r = plan({ settings: DEFAULT_SETTINGS, works: [w], blocks: [] }, NOW); assert.ok(r.warnings.some(x => x.type === 'deficit'), 'el planificador también avisa del déficit');
});
test('temas extensos no se truncan en silencio', () => { const w = reestimate([exam({ topics: [tp('a', { extent: { unit: 'a', count: 60 } })] })], [], ctx())[0].estimateV2!; assert.ok(w.interval.p50 > 480, 'más de 8 h para un tema muy extenso'); });
