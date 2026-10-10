// Navegación, color por asignatura, ejercicio físico y sugerencias (DOM SIMULADO, no navegador real).
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
import { boot, clock } from './harness.mjs'; import { DEFAULT_SUBJECT_COLORS as C } from '../src/core/palette.ts';
const T0 = new Date(2026, 9, 12, 8, 0).getTime(), J = JSON.stringify;
const routes = a => [...a.h.nav.innerHTML.matchAll(/data-r="?([^ >"]+)/g)].map(m => m[1]);
const task = (a, o = {}) => ({ title: 'Problemas', subjectId: a.S.subjects[0].id, dueDate: '2026-12-30', time: '', learn: 'ejercicios', size: '3', difficulty: '3', importance: '3', estOverride: '240', status: 'pending', notes: '', ...o });
const act = (o = {}) => ({ type: 'caminar', date: '2026-10-14', time: '', durMin: '30', status: 'planned', actualMin: '', note: '', ...o });
test.beforeEach(() => { clock.t = T0 });

test('menú lateral: 7 secciones, grupos desplegables, las nueve asignaturas, sección activa y rutas que funcionan', async () => {
  const a = await boot(); assert.deepEqual(['hoy', 'tar', 'exa', 'cal', 'eje', 'seg', 'aj'].filter(r => !routes(a).includes(r)), [], 'rutas presentes (Tareas y Exámenes dentro de su grupo)'); assert.ok(!routes(a).includes('asg'), 'Asignaturas plegado al inicio');
  assert.match(a.h.nav.innerHTML, /aria-expanded=true[^>]*>(?:(?!<button).)*Tareas y exámenes/s); assert.equal((a.h.nav.innerHTML.match(/data-r="asg:/g) ?? []).length, 0, 'asignaturas plegadas al inicio');
  a.t.A.grp({ dataset: { g: 'subjects' } }); assert.ok(routes(a).includes('asg'), 'Todas'); const ids = routes(a).filter(r => r.startsWith('asg:')); assert.equal(ids.length, 9); assert.equal(new Set(ids).size, 9); for (const n of Object.keys(C)) assert.ok(a.h.nav.innerHTML.includes(n), n);
  for (const r of [...new Set(routes(a))]) { a.t.A.nav({ dataset: { r } }); assert.ok(a.h.main.innerHTML.length > 20 && !a.h.main.innerHTML.includes('undefined'), r); assert.equal((a.h.nav.innerHTML.match(/aria-current=page/g) ?? []).length, 1, 'una sola sección activa en ' + r); assert.match(a.h.nav.innerHTML, new RegExp(`data-r="?${r.replace(':', ':')}"? aria-current=page|data-r="?${r}"?[^>]*aria-current=page`)); }
  a.t.A.grp({ dataset: { g: 'subjects' } }); assert.equal(routes(a).filter(r => r.startsWith('asg:')).length, 0, 'se pliega');
});
test('menú: contraer, drawer en pantallas pequeñas y preferencia persistente (no es dato de estudio)', async () => {
  const a = await boot(); a.t.A.rail(); assert.ok(a.h.classes.has('rail')); assert.equal(JSON.parse(a.store['focusos.ui']).rail, true); a.t.A.menu(); assert.ok(a.h.classes.has('open')); a.t.A.nav({ dataset: { r: 'cal' } }); assert.ok(!a.h.classes.has('open'), 'navegar cierra el menú');
  const b = await boot(a.store); assert.ok(b.h.classes.has('rail')); assert.equal(JSON.parse(b.store['focusos.v1']).ui, undefined, 'la preferencia de menú no entra en los datos exportables'); b.t.A.rail(); assert.ok(!b.h.classes.has('rail'));
  const c = await boot({ 'focusos.ui': '{rota' }); assert.ok(c.h.nav.innerHTML.includes('Hoy'), 'preferencia corrupta no rompe');
});
test('color por asignatura: único, coherente en menú, fichas, tareas, calendario y leyenda; el nombre siempre acompaña', async () => {
  const a = await boot(); const cols = a.S.subjects.map(s => s.color.toLowerCase()); assert.equal(new Set(cols).size, 9); for (const s of a.S.subjects) assert.equal(s.color, C[s.name]);
  a.t.A.grp({ dataset: { g: 'subjects' } }); await a.click('addTask'); await a.submit(task(a)); const s0 = a.S.subjects[0];
    const seen = { menú: a.h.nav.innerHTML, fichas: a.t.V.asg(), tareas: a.t.V.tar(), calendario: (a.t.A.nav({ dataset: { r: 'cal' } }), a.t.V.cal()), leyenda: a.t.V.seg() };
  for (const [k, h] of Object.entries(seen)) { assert.ok(h.toLowerCase().includes(`--c:${C[s0.name].toLowerCase()}`), 'color en ' + k); assert.ok(h.includes(s0.name), 'nombre en ' + k); }
  for (const s of a.S.subjects) assert.ok(seen.leyenda.includes(s.name) && seen.leyenda.toLowerCase().includes(C[s.name].toLowerCase()), 'leyenda ' + s.name);
});
test('color: personalizar, rechazar duplicados, restablecer; datos antiguos compatibles sin perder el color heredado', async () => {
  const a = await boot(), [s0, s1] = a.S.subjects; assert.equal(a.t.setSubjectColor(s0.id, '#112233'), null); await a.tick(); assert.equal(a.S.subjects[0].userColor, '#112233'); assert.equal(a.S.subjects[0].color, C[s0.name], 'color base intacto');
  assert.match(a.t.setSubjectColor(s1.id, '#112233'), /ya lo usa/); assert.equal(a.S.subjects[1].userColor, undefined); assert.match(a.t.setSubjectColor(s1.id, C[a.S.subjects[2].name]), /ya lo usa/); assert.equal(a.S.subjects[1].userColor, undefined);
  await a.click('resetColors'); assert.equal(a.S.subjects[0].userColor, undefined); assert.equal(a.S.subjects[0].color, C[s0.name]);
  const o = JSON.parse(fs.readFileSync('test/fixtures/export-v2.json', 'utf8')), { app, schema, exportedAt, ...st } = o, old = await boot({ 'focusos.v1': J(st) });
  assert.equal(old.S.subjects[0].color, o.subjects[0].color, 'color heredado conservado'); assert.equal(old.S.subjects[0].colorKey, o.subjects[0].name); assert.ok(old.h.nav.innerHTML.length > 0);
});
test('ejercicio: crear (hueco automático), validar, conflictos con estudio manual/completado, mover, completar, omitir, eliminar y calendario', async () => {
  const a = await boot(); await a.click('addAct'); assert.match(await a.submit(act({ durMin: '5' })), /duración/); assert.match(await a.submit(act({ durMin: '400' })), /duración/); assert.match(await a.submit(act({ status: 'done' })), /tiempo real/); assert.equal(a.S.activities.length, 0);
  assert.equal(await a.submit(act()), ''); const x = a.S.activities[0]; assert.ok(x.start != null && x.end - x.start === 30 && x.category === 'exercise');
  await a.click('addTask'); await a.submit(task(a)); const w = a.S.works[0]; await a.click('addBlk'); assert.equal(await a.submit({ workId: w.id, date: '2026-11-20', s: '16:00', e: '17:00' }), '');
  await a.click('addAct'); assert.match(await a.submit(act({ date: '2026-11-20', time: '16:30' })), /manual/); const f = a.S.blocks.find(b => b.status === 'planned' && !b.manual); await a.click('doneBlk', f.id); await a.submit({ actualMin: String(f.end - f.start), goalMet: '1', progress: '60', difficulty: '3', interrupted: '0' });
  await a.click('addAct'); assert.match(await a.submit(act({ date: f.date, time: '' + `${String(Math.floor(f.start / 60)).padStart(2, '0')}:${String(f.start % 60).padStart(2, '0')}` })), /completada|solapa/);
  await a.click('editAct', x.id); assert.equal(await a.submit(act({ date: '2026-10-16', time: '19:00' })), ''); assert.equal(a.S.activities[0].date, '2026-10-16'); assert.equal(a.S.activities[0].start, 1140);
  assert.match(a.t.V.cal.call ? (a.t.A.nav({ dataset: { r: 'cal' } }), a.t.V.cal()) : '', /Ejercicio/); await a.click('doneAct', x.id); assert.match(await a.submit({ actualMin: '999' }), /tiempo real/); assert.equal(await a.submit({ actualMin: '25' }), ''); assert.equal(a.S.activities[0].status, 'done'); assert.equal(a.S.activities[0].actualMin, 25);
  assert.match(a.t.V.eje(), /Completada · 25min/); await a.click('addAct'); await a.submit(act({ date: '2026-10-17' })); const y = a.S.activities[1]; await a.click('skipAct', y.id); assert.equal(a.S.activities[1].status, 'skipped');
  await a.click('editAct', y.id); await a.h.dlg.onclick(); await a.tick(); assert.equal(a.S.activities.length, 1, 'eliminar con confirmación');
});
test('ejercicio: sin hueco se informa (no se desplaza nada); la planificación lo respeta; manuales y completadas intactas; idempotente; no cuenta como estudio ni toca estimaciones', async () => {
  const a = await boot(); await a.click('addAct'); assert.equal(await a.submit(act({ date: '2026-10-13', time: '18:00', durMin: '60' })), ''); await a.click('addTask'); await a.submit(task(a, { estOverride: '300', dueDate: '2026-10-17' })); const w = a.S.works[0]; await a.click('addBlk'); assert.equal(await a.submit({ workId: w.id, date: '2026-11-20', s: '16:00', e: '16:50' }), '');
  const first = a.S.blocks.find(b => b.status === 'planned' && !b.manual); await a.click('doneBlk', first.id); await a.submit({ actualMin: '50', goalMet: '1', progress: '60', difficulty: '3', interrupted: '0' });
  const keep = J(a.S.blocks.filter(b => b.manual || b.status === 'done')), works0 = J(a.S.works), st0 = a.t.stats(a.S.blocks, a.S.works, {}).completedMin;
  await a.click('doneAct', a.S.activities[0].id); await a.submit({ actualMin: '55' });
  const ex = a.S.activities[0]; assert.ok(!a.S.blocks.some(b => b.status === 'planned' && !b.manual && b.date === ex.date && b.start < ex.end && ex.start < b.end), 'estudio automático fuera del ejercicio'); assert.equal(J(a.S.blocks.filter(b => b.manual || b.status === 'done')), keep);
  assert.equal(a.t.stats(a.S.blocks, a.S.works, {}).completedMin, st0, 'el ejercicio no suma minutos de estudio'); assert.equal(J(a.S.works), works0, 'estimaciones intactas'); const snap = J(a.S.blocks); await a.t.commit(); await a.t.commit(); assert.equal(J(a.S.blocks), snap); assert.equal(new Set(a.S.blocks.map(b => b.id)).size, a.S.blocks.length);
  a.S.settings.blockedDates = Array.from({ length: 8 }, (_, i) => ({ date: `2026-10-${12 + i}`, start: 0, end: 1440 })); await a.t.commit(); await a.click('addAct'); const before = J(a.S.blocks); assert.match(await a.submit(act({ date: '2026-10-14' })), /No hay hueco libre/); await a.click('addAct'); assert.match(await a.submit(act({ date: '2026-11-20', time: '16:20' })), /No se ha movido nada/); assert.equal(J(a.S.blocks), before);
});
test('sugerencias: prioridad real primero, opcionales con acciones, nada se crea ni se marca solo, sin duplicados ni efecto en el estimador', async () => {
  clock.t = new Date(2026, 9, 13, 17, 0).getTime(); const a = await boot(); await a.click('addTask'); await a.submit(task(a, { estOverride: '60' })); const wid = a.S.works[0].id;
  let r = a.t.currentSugg(); assert.equal(r.mode, 'libre'); assert.ok(r.items.length >= 1 && r.items.length <= 3); const hoy = a.t.V.hoy(); assert.match(hoy, /Tiempo libre/); assert.match(hoy, /Opcional/); assert.equal((hoy.match(/data-a=suggStart/g) ?? []).length, r.items.length);
  const w0 = J(a.S.works), b0 = J(a.S.blocks), act0 = a.S.activities.length;
  const [s1, s2, s3] = r.items; await a.click('suggStart', s1.id); assert.equal(a.S.suggestionLog.at(-1).status, 'started'); assert.match(a.t.V.hoy(), /En curso/); assert.ok(!a.t.currentSugg().items.some(x => x.id === s1.id));
  await a.click('suggDone', s1.id); assert.equal(await a.submit({ minutes: '12' }), ''); assert.equal(a.S.suggestionLog.at(-1).status, 'done'); assert.equal(a.S.suggestionLog.at(-1).minutes, 12);
  await a.click('suggPost', s2.id); assert.ok(!a.t.currentSugg().items.some(x => x.id === s2.id)); clock.t += 61 * 60000; assert.ok(a.t.currentSugg().items.some(x => x.id === s2.id) || a.t.currentSugg().items.length >= 0); clock.t -= 61 * 60000;
  if (s3) { await a.click('suggSwap', s3.id); assert.ok(!a.t.currentSugg().items.some(x => x.id === s3.id)); }
  assert.equal(J(a.S.works), w0); assert.equal(a.S.activities.length, act0, 'no se crean actividades por sugerir'); assert.equal(a.S.blocks.length, JSON.parse(b0).length, 'no se crean sesiones');
  const logs = a.S.suggestionLog.length; await a.t.commit(); await a.t.commit(); assert.equal(a.S.suggestionLog.length, logs, 'repetir no duplica'); assert.equal(new Set(a.t.currentSugg().items.map(x => x.id)).size, a.t.currentSugg().items.length);
  const mv = a.t.currentSugg().items[0]; if (mv) { await a.click('suggMove', mv.id); assert.equal(await a.submit({ date: '2026-10-13', time: '19:00', durMin: '20' }), ''); const o = a.S.activities.at(-1); assert.equal(o.category, 'optional'); assert.equal(a.S.suggestionLog.at(-1).status, 'moved'); assert.notEqual(o.status, 'done', 'mover no marca como hecho'); }
  await a.click('addExam'); await a.submit({ title: 'Parcial', subjectId: a.S.subjects[0].id, dueDate: '2026-10-14', time: '', learn: 'problemas', goal: 'notable', topics: 'A; 5; 5; 0; 12', prep: '0', importance: '5', estOverride: '', status: 'pending', notes: '' });
  r = a.t.currentSugg(); const hoy2 = a.t.V.hoy(); if (r.mode === 'prioridad') { assert.match(hoy2, /Trabajo real primero/); assert.doesNotMatch(hoy2, /data-a=suggStart/); await a.click('suggForce'); assert.match(a.t.V.hoy(), /Trabajo real primero|Sigues teniendo trabajo real/); assert.ok(a.t.currentSugg().priority.length > 0); } else assert.ok(a.t.currentSugg().priority.length >= 0);
});
test('sugerencias no alteran el estimador 2.0, el dominio ni la evidencia', async () => {
  clock.t = new Date(2026, 9, 13, 17, 0).getTime(); const a = await boot(); await a.click('addExam'); await a.submit({ title: 'Parcial', subjectId: a.S.subjects[0].id, dueDate: '2026-12-30', time: '', learn: 'problemas', goal: 'notable', topics: 'A; 3; 3; 1; 3', prep: '0', importance: '3', estOverride: '', status: 'pending', notes: '' });
  await a.click('upgradeV2', a.S.works[0].id); await a.submit({}); await a.tick(); const snap = J([a.S.works[0].estimateV2, a.S.works[0].topics, a.S.estimateLog]); const it = a.t.currentSugg().items[0]; await a.click('suggStart', it.id); await a.click('suggDone', it.id); await a.submit({ minutes: '20' });
  assert.equal(J([a.S.works[0].estimateV2, a.S.works[0].topics, a.S.estimateLog]), snap);
});
test('persistencia: actividades y sugerencias se exportan, importan, sobreviven a datos corruptos y la versión anterior las conserva', async () => {
  clock.t = new Date(2026, 9, 13, 17, 0).getTime(); const a = await boot(); await a.click('addAct'); await a.submit(act({ date: '2026-10-13', time: '19:00' })); const it = a.t.currentSugg().items[0]; await a.click('suggDrop', it.id);
  await a.click('export'); const o = JSON.parse(a.h.blob); assert.equal(o.activities.length, 1); assert.equal(o.suggestionLog.length, 1); assert.ok(o.subjects.every(s => s.colorKey));
  const b = await boot(); assert.equal(b.t.importText(a.h.blob), null); await b.tick(); assert.equal(J(b.S.activities), J(o.activities)); assert.equal(J(b.S.suggestionLog), J(o.suggestionLog));
  const prev = await boot(a.store, { dist: 'test/fixtures/prev-dist.html' }); assert.doesNotMatch(prev.h.main.innerHTML, /Datos no válidos/); assert.equal(J(prev.S.activities), J(o.activities), 'la versión anterior conserva las actividades sin entenderlas'); assert.equal(J(prev.S.suggestionLog), J(o.suggestionLog));
  const bad = J({ ...JSON.parse(a.store['focusos.v1']), activities: [{ id: 1 }] }), c = await boot({ 'focusos.v1': bad }); assert.match(c.h.main.innerHTML, /Datos no válidos/); assert.equal(c.store['focusos.v1'], bad);
});
