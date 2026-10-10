// Flujo v2 en la app (DOM SIMULADO, no navegador real): opt-in con comparación y cancelación, copia previa, evidencia, vuelta a v1, predicciones.
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
import { boot, clock } from './harness.mjs';
const T0 = new Date(2026, 9, 12, 8, 0).getTime();
const J = JSON.stringify, sum = bs => bs.reduce((a, b) => a + b.end - b.start, 0);
const exam = a => ({ title: 'Parcial mates', subjectId: a.S.subjects[0].id, dueDate: '2026-10-21', time: '', learn: 'problemas', goal: 'notable', topics: 'Límites; 4; 3; 0; 3\nDerivadas; 5; 4; 1\nIntegrales', prep: '0', importance: '4', estOverride: '', status: 'pending', notes: '' });
test.beforeEach(() => { clock.t = T0 });
async function withExam() { const a = await boot(); await a.click('addExam'); assert.equal(await a.submit(exam(a)), ''); return a; }

test('comparar y cancelar no cambia nada; aplicar crea copia previa y conserva sesiones; volver a v1 sin perder datos', async () => {
  const a = await withExam(), id = a.S.works[0].id, before = J(a.S.blocks), w0 = J(a.S.works);
  await a.click('upgradeV2', id); assert.match(a.h.dlg.innerHTML, /Comparar estimador v1 y v2/); assert.match(a.h.dlg.innerHTML, /v1 \(actual\)/); assert.match(a.h.dlg.innerHTML, /Aplicar v2/); // comparación visible, nada aplicado
  assert.equal(J(a.S.works), w0); assert.equal(a.store['focusos.v1.preupgrade'], undefined); assert.ok(a.S.works[0].estimatorVersion === 1 || a.S.works[0].estimatorVersion === undefined);
  const stateBefore = J(a.S); assert.equal(await a.submit({}), ''); await a.tick();
  assert.notEqual(JSON.parse(a.store['focusos.v1.preupgrade']).works[0].estimatorVersion, 2, 'la copia previa es el estado ANTES de v2'); assert.equal(JSON.parse(a.store['focusos.v1.preupgrade']).works[0].estimateV2, undefined); assert.equal(JSON.parse(a.store['focusos.v1.preupgrade']).works[0].title, 'Parcial mates'); assert.ok(stateBefore.length > 0);
  const w = a.S.works[0]; assert.equal(w.estimatorVersion, 2); assert.ok(w.estimateV2); assert.equal(sum(a.S.blocks.filter(b => b.status === 'planned' && !b.manual)), w.estimate.remainingMin);
  assert.equal(w.topics[0].extent.count, 3); assert.equal(w.topics[1].extent, undefined, 'extensión desconocida no inventada'); assert.equal(w.estimateV2.perTopic[1].unknownExtent, true);
  assert.equal(a.S.estimateLog.length, 1); const rec = J(a.S.estimateLog[0]); await a.t.commit(); await a.t.commit(); assert.equal(J(a.S.estimateLog[0]), rec, 'predicción original inmutable'); assert.equal(a.S.estimateLog.length, 1);
  await a.click('revertV1', id); assert.equal(a.S.works[0].estimatorVersion, 1); assert.equal(a.S.works[0].estimateV2 !== undefined, true, 'datos v2 conservados'); assert.ok(a.S.works[0].estimate.confidence); assert.equal(a.S.works[0].estimate.perTopic.length, 3);
  assert.equal(a.S.works[0].estimatorHistory.length, 2); assert.ok(before.length > 0);
});
test('segunda copia previa: pide confirmación antes de sobrescribir una existente', async () => {
  const a = await withExam(), id = a.S.works[0].id; a.store['focusos.v1.preupgrade'] = J({ marca: 'previa' }); a.h.confirm = false;
  await a.click('upgradeV2', id); assert.match(await a.submit({}), /Cancelado/); assert.equal(a.store['focusos.v1.preupgrade'], J({ marca: 'previa' })); assert.equal(a.S.works[0].estimatorVersion === 2, false);
  a.h.confirm = true; assert.equal(await a.submit({}), ''); assert.equal(a.S.works[0].estimatorVersion, 2); assert.notEqual(a.store['focusos.v1.preupgrade'], J({ marca: 'previa' }));
});
test('registrar sesión v2: ítems → evidencia por tema; minutos/autoinforme no cambian el dominio ni lo pendiente; sesión previa intacta', async () => {
  const a = await withExam(), id = a.S.works[0].id; await a.click('upgradeV2', id); await a.submit({}); await a.tick();
  const rem0 = a.S.works[0].estimateV2.remainingMin, b1 = a.S.blocks.find(b => b.status === 'planned' && !b.manual); const tid = b1.topicId;
  await a.click('doneBlk', b1.id); assert.equal(await a.submit({ actualMin: '50', topicId: tid, goalMet: '1', progress: '100', difficulty: '3', interrupted: '0', phase: '', units: '', ind: '', asi: '', err: '', omi: '' }), '');
  assert.equal(a.S.works[0].topics.find(t => t.id === tid).evidence.length, 0, 'sin ítems no hay evidencia'); assert.equal(a.S.works[0].estimateV2.remainingMin, rem0, 'autoinforme 100 % no reduce');
  assert.equal(a.S.works[0].topics.find(t => t.id === tid).mastery, a.S.works[0].topics.find(t => t.id === tid).selfRating, 'dominio autodeclarado intacto');
  const b2 = a.S.blocks.find(b => b.status === 'planned' && !b.manual), done1 = J(a.S.blocks.find(b => b.id === b1.id)); await a.click('doneBlk', b2.id);
  assert.equal(await a.submit({ actualMin: '40', topicId: b2.topicId, goalMet: '1', progress: '50', difficulty: '3', interrupted: '0', phase: 'practica', units: '2', ind: '8', asi: '1', err: '1', omi: '0' }), '');
  const t = a.S.works[0].topics.find(x => x.id === b2.topicId); assert.deepEqual(JSON.parse(J(t.evidence.at(-1))), { at: '2026-10-12', items: 10, independent: 8, assisted: 1, wrong: 1, skipped: 0, kind: 'recuperacion' });
  assert.equal(J(a.S.blocks.find(b => b.id === b1.id)), done1, 'sesión completada anterior intacta'); assert.equal(a.S.blocks.find(b => b.id === b2.id).log.units, 2);
  assert.equal(a.t.stats(a.S.blocks, a.S.works, {}).completedMin, 90);
  assert.equal((await (async () => { await a.click('doneBlk', a.S.blocks.find(b => b.status === 'planned' && !b.manual).id); return a.submit({ actualMin: '40', goalMet: '1', progress: '50', difficulty: '3', interrupted: '0', ind: '-1' }) })()), 'Las cantidades deben ser números no negativos.');
});
test('trabajos v1 no cambian aunque otro pase a v2; v2 es opt-in por trabajo', async () => {
  const a = await withExam(); await a.click('addTask'); await a.submit({ title: 'Tarea', subjectId: a.S.subjects[1].id, dueDate: '2026-10-16', time: '', learn: 'ejercicios', size: '3', difficulty: '3', importance: '3', estOverride: '90', status: 'pending', notes: '' });
  const t1 = J(a.S.works[1]); await a.click('upgradeV2', a.S.works[0].id); await a.submit({}); await a.tick(); assert.equal(J(a.S.works[1]), t1); assert.equal(a.S.works[1].estimateV2, undefined);
});
test('familia de asignatura y migración: nuevas asignaturas conservan el tipo; exportar/importar conserva v2 e historial', async () => {
  const a = await withExam(); await a.click('upgradeV2', a.S.works[0].id); await a.submit({}); await a.tick();
  await a.click('export'); const o = JSON.parse(a.h.blob); assert.equal(o.schema, 3); assert.equal(o.estimateLog.length, 1); assert.equal(o.works[0].estimatorVersion, 2);
  const b = await boot(); assert.equal(b.t.importText(a.h.blob), null); await b.tick(); assert.equal(b.S.works[0].estimatorVersion, 2); assert.equal(J(b.S.estimateLog), J(o.estimateLog));
  const legacy = await boot(b.store, { dist: 'test/fixtures/legacy-dist.html' }); assert.doesNotMatch(legacy.h.main.innerHTML, /Datos no válidos/); assert.equal(legacy.S.works[0].estimatorVersion, 2, 'la app anterior conserva los datos v2 sin tocarlos');
});
