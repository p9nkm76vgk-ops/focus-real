// Migración de esquema: pruebas REALES en Node con fixtures (export-v2 generado por la app anterior; export-v1 manual).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { migrateState, lostPaths, setEstimatorVersion, previewUpgrade, SCHEMA_VERSION } from '../src/core/migrate.ts';
import { plan } from '../src/core/planner.ts';
import { reestimate } from '../src/core/estimator.ts';
import { stats } from '../src/core/stats.ts';

const load = (n: string) => JSON.parse(fs.readFileSync(`test/fixtures/${n}.json`, 'utf8'));
const NOW = { date: '2026-10-12', minute: 480 };
const J = (x: unknown) => JSON.stringify(x);
for (const name of ['export-v1', 'export-v2']) {
  const orig = load(name);
  test(`${name}: migra de forma aditiva, sin perder ni cambiar ningún valor`, () => {
    const m = migrateState(orig);
    assert.ok(m.changed); assert.equal(m.state.schemaVersion, SCHEMA_VERSION); assert.deepEqual(m.state.estimateLog, []);
    assert.deepEqual(lostPaths(orig, m.state), []);
    assert.ok(m.state.works.every((w: any) => w.estimatorVersion === 1), 'todos siguen en v1');
    for (const w of m.state.works) for (const t of w.topics ?? []) { assert.equal(t.selfRating, t.mastery); assert.deepEqual(t.evidence, []); assert.equal(t.extent, undefined, 'no se inventa extensión'); }
  });
  test(`${name}: idempotente y no muta la entrada`, () => {
    const before = J(orig), m = migrateState(orig); assert.equal(J(orig), before);
    const again = migrateState(m.state); assert.equal(again.changed, false); assert.equal(J(again.state), J(m.state));
  });
  test(`${name}: sesiones completadas, manuales y todo el historial quedan idénticos; planificador y estadísticas no cambian`, () => {
    const m = migrateState(orig).state; assert.equal(J(m.blocks), J(orig.blocks));
    const run = (s: any) => { const works = reestimate(s.works, s.blocks); return { works, r: plan({ settings: s.settings, works, blocks: s.blocks }, NOW), st: stats(s.blocks, works, NOW) }; };
    const a = run(orig), b = run(m);
    assert.equal(J(b.r.blocks), J(a.r.blocks)); assert.equal(J(b.r.warnings), J(a.r.warnings)); assert.equal(J(b.st), J(a.st));
    assert.equal(J(b.works.map((w: any) => [w.id, w.estMin, w.estimate])), J(a.works.map((w: any) => [w.id, w.estMin, w.estimate])), 'v1 produce los mismos resultados');
    for (const st of ['done', 'skipped', 'rescheduled']) assert.equal(J(b.r.blocks.filter((x: any) => x.status === st)), J(a.r.blocks.filter((x: any) => x.status === st)));
    assert.equal(J(b.r.blocks.filter((x: any) => x.manual)), J(a.r.blocks.filter((x: any) => x.manual)));
  });
}
test('la guarda detecta pérdida, cambio de valor y reducción de listas', () => {
  const o = load('export-v2'), m = migrateState(o).state;
  const a = JSON.parse(J(m)); a.blocks.pop(); assert.ok(lostPaths(o, a).length > 0);
  const b = JSON.parse(J(m)); b.works[0].title = 'otro'; assert.deepEqual(lostPaths(o, b), ['works[0].title']);
  const c = JSON.parse(J(m)); delete c.settings.maxDayMin; assert.ok(lostPaths(o, c).includes('settings.maxDayMin'));
  const d = JSON.parse(J(m)); [d.blocks[0], d.blocks[1]] = [d.blocks[1], d.blocks[0]]; assert.ok(lostPaths(o, d).length > 0, 'reordenar cuenta como cambio');
});
test('campos desconocidos y estados ya migrados se respetan', () => {
  const o = load('export-v2'); o.custom = { a: [1, 2] }; o.works[0].extra = 'x';
  const m = migrateState(o).state; assert.deepEqual(m.custom, { a: [1, 2] }); assert.equal(m.works[0].extra, 'x');
  const fut = { ...m, schemaVersion: 3 }; assert.equal(migrateState(fut).changed, false);
});
test('cambio de versión por trabajo: vista previa sin efectos, opt-in y vuelta atrás sin perder datos', () => {
  const s = migrateState(load('export-v2')).state, snap = J(s), id = s.works[0].id;
  const pv = previewUpgrade(s, id, w => ({ marcado: w.estimatorVersion })); assert.equal(J(s), snap, 'previsualizar no aplica nada'); assert.deepEqual(pv.after, { marcado: 2 });
  const up = setEstimatorVersion(s, id, 2, 111); assert.equal(J(s), snap, 'no muta el original'); assert.equal(up.works[0].estimatorVersion, 2); assert.equal(J(up.blocks), J(s.blocks));
  const back = setEstimatorVersion(up, id, 1, 222); assert.equal(back.works[0].estimatorVersion, 1); assert.equal(back.works[0].estimatorHistory.length, 2);
  assert.deepEqual(lostPaths(s, back), [], 'tras volver a v1 no falta ni cambia nada del original');
  assert.throws(() => setEstimatorVersion(s, 'no-existe', 2, 1));
});

test('la comparación detecta eliminaciones, cambios de tipo, nulos y cambios dentro de arrays', () => {
  const o = { a: 1, n: null, arr: [{ x: 1 }, { x: 2 }], deep: { k: [1, 2, 3] }, s: 'x' };
  const clone = () => JSON.parse(J(o));
  assert.deepEqual(lostPaths(o, clone()), []);
  const d1 = clone(); delete d1.s; assert.deepEqual(lostPaths(o, d1), ['s']);
  const d2 = clone(); d2.a = '1'; assert.deepEqual(lostPaths(o, d2), ['a'], 'número → texto');
  const d3 = clone(); d3.n = 0; assert.deepEqual(lostPaths(o, d3), ['n'], 'null → valor');
  const d4 = clone(); d4.n = {}; assert.deepEqual(lostPaths(o, d4), ['n'], 'null → objeto');
  const d5 = clone(); d5.arr[1].x = 3; assert.deepEqual(lostPaths(o, d5), ['arr[1].x']);
  const d6 = clone(); d6.arr.pop(); assert.deepEqual(lostPaths(o, d6), ['arr[longitud]']);
  const d7 = clone(); d7.deep.k = { 0: 1, 1: 2, 2: 3 }; assert.ok(lostPaths(o, d7).length > 0, 'array → objeto');
  const d8 = clone(); d8.deep.k[2] = null; assert.deepEqual(lostPaths(o, d8), ['deep.k[2]']);
  const d9 = clone(); d9.arr.push({ x: 9 }); assert.deepEqual(lostPaths(o, d9), [], 'añadir es aditivo');
});
