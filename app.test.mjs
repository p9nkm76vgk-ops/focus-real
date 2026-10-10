// Pruebas de INTEGRACIÓN con DOM simulado (ver harness.mjs). No sustituyen una prueba en Safari real.
import test from 'node:test'; import assert from 'node:assert/strict';
import { boot, clock } from './harness.mjs';
const T0 = new Date(2026, 9, 12, 8, 0).getTime();
const live = bs => bs.filter(b => b.status === 'planned' || b.status === 'done');
const sum = bs => bs.reduce((a, b) => a + b.end - b.start, 0);
const auto = a => a.S.blocks.filter(b => b.status === 'planned' && !b.manual);
const task = (a, o = {}) => ({ title: 'Problemas', subjectId: a.S.subjects[1].id, dueDate: '2026-10-16', time: '', estOverride: '120', difficulty: '3', importance: '3', status: 'pending', notes: '', ...o });
const exam = (a, o = {}) => ({ title: 'Parcial', subjectId: a.S.subjects[0].id, dueDate: '2026-10-20', time: '', estOverride: '300', difficulty: '4', importance: '5', readiness: '0', status: 'pending', notes: '', ...o });
test.beforeEach(() => { clock.t = T0 });

test('crear tarea: valida, genera sesiones dentro del plazo y persiste tras recargar', async () => {
  const a = await boot(); await a.click('addTask');
  assert.ok(await a.submit(task(a, { title: '  ' })), 'rechaza título vacío'); assert.ok(await a.submit(task(a, { estOverride: '2' })), 'rechaza duración <5');
  assert.equal(a.S.works.length, 0);
  assert.equal(await a.submit(task(a)), ''); assert.equal(a.S.works.length, 1);
  assert.equal(sum(auto(a)), 120); assert.ok(auto(a).every(b => b.date <= '2026-10-16' && b.date >= '2026-10-12'));
  const b = await boot(a.store); assert.equal(b.S.works[0].title, 'Problemas'); assert.equal(JSON.stringify(b.S.blocks), JSON.stringify(a.S.blocks));
});
test('editar tarea recalcula solo lo necesario; completar/reabrir ajusta sesiones', async () => {
  const a = await boot(); await a.click('addTask'); await a.submit(task(a)); const id = a.S.works[0].id;
  await a.click('editTask', id); assert.equal(await a.submit(task(a, { estOverride: '180', dueDate: '2026-10-14' })), '');
  assert.equal(sum(auto(a)), 180); assert.ok(auto(a).every(b => b.date <= '2026-10-14'));
  await a.click('toggle', id); assert.equal(a.S.works[0].status, 'done'); assert.equal(auto(a).length, 0);
  await a.click('toggle', id); assert.equal(sum(auto(a)), 180);
});
test('examen: genera sesiones y al cambiar la fecha no queda nada después', async () => {
  const a = await boot(); await a.click('addExam'); assert.equal(await a.submit(exam(a)), ''); assert.equal(sum(auto(a)), 300);
  await a.click('editExam', a.S.works[0].id); await a.submit(exam(a, { dueDate: '2026-10-15' }));
  assert.ok(auto(a).every(b => b.date <= '2026-10-15')); assert.equal(sum(auto(a)), 300);
});
test('manual + completada se conservan; regenerar repetido no duplica; estadísticas separan planificado/completado', async () => {
  const a = await boot(); await a.click('addTask'); await a.submit(task(a, { dueDate: '2026-10-19' })); const wid = a.S.works[0].id;
  await a.click('addBlk'); assert.equal(await a.submit({ workId: wid, date: '2026-10-17', s: '12:30', e: '13:20' }), '');
  const man = a.S.blocks.find(b => b.manual); const first = auto(a)[0]; await a.click('doneBlk', first.id); assert.equal(await a.submit({ actualMin: String(first.end - first.start), goalMet: '1', progress: '100', difficulty: '3', interrupted: '0' }), '');
  const snap = JSON.stringify(a.S.blocks); await a.click('replan'); await a.click('replan');
  assert.equal(JSON.stringify(a.S.blocks), snap, 'idempotente'); assert.equal(new Set(a.S.blocks.map(b => b.id)).size, a.S.blocks.length);
  assert.equal(a.S.blocks.find(b => b.id === first.id).status, 'done'); assert.equal(JSON.stringify(a.S.blocks.find(b => b.id === man.id)), JSON.stringify(man));
  assert.equal(sum(live(a.S.blocks)), 120);
  const st = a.t.stats(a.S.blocks, a.S.works, {}); assert.equal(st.completedMin, first.end - first.start); assert.equal(st.plannedMin, 120); assert.notEqual(st.completedMin, st.plannedMin);
});
test('reprogramación: sesiones vencidas pasan a reprogramadas y el trabajo se recoloca una vez', async () => {
  const a = await boot(); await a.click('addTask'); await a.submit(task(a)); const before = a.S.blocks.filter(b => b.date < '2026-10-14').length; assert.ok(before > 0);
  clock.t = new Date(2026, 9, 14, 10, 0).getTime(); await a.t.commit();
  assert.equal(a.S.blocks.filter(b => b.status === 'rescheduled').length, before); assert.equal(sum(live(a.S.blocks)), 120);
  assert.ok(auto(a).every(b => b.date >= '2026-10-14')); const snap = JSON.stringify(a.S.blocks); await a.t.commit(); assert.equal(JSON.stringify(a.S.blocks), snap);
});
test('datos inválidos: no se sobrescriben, se conserva copia y se ofrece recuperación', async () => {
  for (const raw of ['{rota', '{"subjects":1}', JSON.stringify({ subjects: [], works: [{ id: 'x' }], blocks: [], settings: { availability: {}, maxDayMin: 1, preferredMin: 1, maxSessionMin: 1, minSessionMin: 1, minGapMin: 0 } })]) {
    const a = await boot({ 'focusos.v1': raw }); assert.match(a.h.main.innerHTML, /Datos no válidos/); assert.equal(a.store['focusos.v1'], raw); assert.equal(a.store['focusos.v1.corrupt'], raw);
  }
});
test('exportar incluye todo y se puede importar; importación inválida no toca nada; deshacer restaura', async () => {
  const a = await boot(); await a.click('addExam'); await a.submit(exam(a)); await a.click('export'); const o = JSON.parse(a.h.blob);
  for (const k of ['app', 'schema', 'exportedAt', 'subjects', 'works', 'blocks', 'settings', 'version']) assert.ok(k in o, k);
  const b = await boot(); await b.click('addTask'); await b.submit(task(b)); const mine = JSON.stringify(b.S.works);
  assert.notEqual(b.t.importText('{"x":1}'), null); assert.equal(JSON.stringify(b.S.works), mine);
  b.h.confirm = false; b.t.importText(a.h.blob); assert.equal(JSON.stringify(b.S.works), mine, 'cancelar no cambia');
  b.h.confirm = true; assert.equal(b.t.importText(a.h.blob), null); await b.tick(); assert.equal(b.S.works[0].title, 'Parcial'); assert.ok(JSON.parse(b.store['focusos.v1.backup']).works[0].title === 'Problemas');
  await b.click('undoImport'); assert.equal(b.S.works[0].title, 'Problemas');
});
test('conflicto entre pestañas: la escritura obsoleta se rechaza sin pisar datos', async () => {
  const store = {}; const a = await boot(store); const b = await boot(store); await b.click('addTask'); await b.submit(task(b)); const saved = store['focusos.v1'];
  await a.t.commit(); assert.match(a.h.toast, /otra pestaña/); assert.equal(store['focusos.v1'], saved);
});

// ---- Estimador adaptativo (DOM simulado) ----
const topicsExam = (o = {}) => ({ title: 'Parcial mates', subjectId: '', dueDate: '2026-10-21', time: '', learn: 'problemas', goal: 'notable', topics: 'Límites; 4; 3; 0\nDerivadas; 5; 4; 1\nIntegrales', prep: '0', importance: '4', estOverride: '', status: 'pending', notes: '', ...o });
test('examen con temas y sin horas: estimación automática, desglose, planificación y UI', async () => {
  const a = await boot(); await a.click('addExam'); assert.equal(await a.submit(topicsExam({ subjectId: a.S.subjects[0].id })), '');
  const w = a.S.works[0]; assert.equal(w.topics.length, 3); assert.ok(w.estimate.remainingMin > 0 && w.estimate.confidence === 'inicial'); assert.equal(sum(auto(a)), w.estimate.remainingMin);
  assert.ok(auto(a).every(b => b.topicId)); assert.match(a.t.V.exa(), /Quedan .*inicial/);
  assert.equal(await (async () => { await a.click('addExam'); return a.submit(topicsExam({ subjectId: a.S.subjects[0].id, topics: 'X; 9; 3; 0' })) })(), 'Tema «X»: dificultad 1-5, cantidad 1-5, preparación 0-3.');
});
// LEGADO v1 (v2 lo cubre en acceptance.v2.test.ts): con 70 % autodeclarado sube el dominio y baja lo pendiente (causa 4)
test('registrar sesión actualiza dominio y trabajo restante, sin tocar el historial; una sesión no duplica minutos', async () => {
  const a = await boot(); await a.click('addExam'); await a.submit(topicsExam({ subjectId: a.S.subjects[0].id }));
  const before = a.S.works[0].estimate.remainingMin, first = auto(a)[0]; await a.click('doneBlk', first.id);
  assert.equal(await a.submit({ actualMin: '45', topicId: first.topicId, goalMet: '1', progress: '70', difficulty: '4', interrupted: '0' }), '');
  const w = a.S.works[0], done = a.S.blocks.find(b => b.id === first.id); assert.equal(done.status, 'done'); assert.equal(done.log.topicId, first.topicId); assert.equal(done.actualMin, 45);
  assert.ok(w.topics.find(t => t.id === first.topicId).mastery > 0); assert.ok(w.estimate.remainingMin < before); assert.equal(w.estimate.investedMin, 45); assert.equal(sum(auto(a)), w.estimate.remainingMin);
  assert.equal(a.t.stats(a.S.blocks, a.S.works, {}).completedMin, 45);
  const snap = JSON.stringify(a.S.blocks.find(b => b.id === first.id)); await a.click('editExam', w.id); await a.submit(topicsExam({ subjectId: a.S.subjects[0].id, topics: 'Límites; 4; 3; 0\nDerivadas; 5; 4; 1\nIntegrales\nSeries; 3; 2; 0' }));
  assert.equal(JSON.stringify(a.S.blocks.find(b => b.id === first.id)), snap, 'historial intacto'); assert.equal(a.S.works[0].topics.length, 4);
});
test('corrección manual se registra como corrección, no como tiempo estudiado', async () => {
  const a = await boot(); await a.click('addExam'); await a.submit(topicsExam({ subjectId: a.S.subjects[0].id })); const id = a.S.works[0].id;
  await a.click('editExam', id); await a.submit(topicsExam({ subjectId: a.S.subjects[0].id, topics: 'Límites\nDerivadas\nIntegrales', estOverride: '600' }));
  const w = a.S.works[0]; assert.equal(w.corrections.length, 1); assert.equal(w.estimate.remainingMin, 600); assert.equal(w.estimate.investedMin, 0); assert.equal(a.t.stats(a.S.blocks, a.S.works, {}).completedMin, 0);
});
test('exportar/importar conserva temas, estimación y registros; copias antiguas siguen cargando', async () => {
  const a = await boot(); await a.click('addExam'); await a.submit(topicsExam({ subjectId: a.S.subjects[0].id })); const f = auto(a)[0]; await a.click('doneBlk', f.id);
  await a.submit({ actualMin: '40', topicId: f.topicId, goalMet: '1', progress: '50', difficulty: '3', interrupted: '0' }); await a.click('export'); const o = JSON.parse(a.h.blob);
  const b = await boot(); assert.equal(b.t.importText(a.h.blob), null); await b.tick();
  assert.equal(JSON.stringify(b.S.works[0].topics), JSON.stringify(o.works[0].topics)); assert.ok(b.S.works[0].estimate); assert.equal(b.S.blocks.find(x => x.id === f.id).log.actualMin, 40);
  // copia antigua v1: sin topics/estimate/log
  const oldS = { version: 3, subjects: [{ id: 's1', name: 'Mates', color: '#c9a45c' }], settings: o.settings, blocks: [], works: [{ id: 'w1', kind: 'exam', subjectId: 's1', title: 'Antiguo', dueDate: '2026-10-21', estMin: 240, difficulty: 3, importance: 3, readiness: 20, status: 'pending' }, { id: 'w2', kind: 'task', subjectId: 's1', title: 'Tarea vieja', dueDate: '2026-10-16', estMin: 90, difficulty: 3, importance: 3, readiness: 0, status: 'pending' }] };
  const c = await boot({ 'focusos.v1': JSON.stringify(oldS) }); assert.doesNotMatch(c.h.main.innerHTML, /Datos no válidos/); assert.equal(sum(auto(c).filter(x => x.workId === 'w2')), 90); assert.equal(c.S.works[0].estimate, undefined);
  assert.ok(sum(auto(c).filter(x => x.workId === 'w1')) > 0);
});
test('datos nuevos inválidos se rechazan sin sobrescribir', async () => {
  const bad = JSON.stringify({ version: 1, subjects: [{ id: 's', name: 'x' }], blocks: [], works: [{ id: 'w', kind: 'exam', subjectId: 's', title: 't', dueDate: '2026-10-21', estMin: 60, status: 'pending', topics: [{ id: 'a', name: 'a', size: 9, difficulty: 3, mastery: 0 }] }], settings: { availability: {}, maxDayMin: 1, preferredMin: 1, maxSessionMin: 1, minSessionMin: 1, minGapMin: 0 } });
  const a = await boot({ 'focusos.v1': bad }); assert.match(a.h.main.innerHTML, /Datos no válidos/); assert.equal(a.store['focusos.v1'], bad);
});
