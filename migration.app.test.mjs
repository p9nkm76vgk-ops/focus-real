// Migración en la app (DOM SIMULADO, no navegador real): copia previa, guarda, importación y vuelta a la versión anterior.
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
import { boot, clock } from './harness.mjs';
const T0 = new Date(2026, 9, 12, 8, 0).getTime(), LEGACY = { dist: 'test/fixtures/legacy-dist.html' };
const fx = n => JSON.parse(fs.readFileSync(`test/fixtures/${n}.json`, 'utf8'));
const stored = n => { const { app, schema, exportedAt, ...st } = fx(n); return JSON.stringify(st); };
test.beforeEach(() => { clock.t = T0 });

test('arranque con datos v2: copia previa idéntica, migra y no cambia ninguna sesión', async () => {
  const raw = stored('export-v2'), a = await boot({ 'focusos.v1': raw }); const o = JSON.parse(raw);
  assert.equal(a.store['focusos.v1.premigration'], raw, 'copia previa byte a byte');
  assert.equal(a.S.schemaVersion, 3); assert.ok(a.S.works.every(w => w.estimatorVersion === 1)); assert.equal(JSON.stringify(a.S.blocks), JSON.stringify(o.blocks));
  assert.equal(JSON.parse(a.store['focusos.v1']).schemaVersion, 3);
  assert.doesNotMatch(a.h.main.innerHTML, /Datos no válidos/);
  const b = await boot(a.store); assert.equal(b.store['focusos.v1.premigration'], raw, 'no se vuelve a migrar ni a pisar la copia');
});
test('arranque con datos v1 (formato original) conserva todo', async () => {
  const raw = stored('export-v1'), a = await boot({ 'focusos.v1': raw }), o = JSON.parse(raw);
  assert.equal(a.S.schemaVersion, 3); for (const id of ['h1', 'h2', 'h3', 'm1']) assert.equal(JSON.stringify(a.S.blocks.find(b => b.id === id)), JSON.stringify(o.blocks.find(b => b.id === id)));
  assert.equal(a.S.works.find(w => w.id === 'e1').notes, 'x');
});
test('si no se puede crear la copia previa, NO se migra y se avisa', async () => {
  const raw = stored('export-v2'), store = new Proxy({ 'focusos.v1': raw }, { set(t, k, v) { if (k === 'focusos.v1.premigration') throw new Error('cuota'); t[k] = v; return true; } });
  const a = await boot(store); assert.equal(a.S.schemaVersion, undefined); assert.match(a.h.toast, /copia previa/); assert.equal(a.S.works.length, JSON.parse(raw).works.length);
});
test('vuelta a la versión anterior: la app antigua abre datos migrados sin perder nada y los conserva al guardar', async () => {
  const a = await boot({ 'focusos.v1': stored('export-v2') }); const migrated = JSON.parse(a.store['focusos.v1']);
  const old = await boot(a.store, LEGACY); assert.doesNotMatch(old.h.main.innerHTML, /Datos no válidos/);
  assert.equal(JSON.stringify(old.S.blocks), JSON.stringify(migrated.blocks)); assert.equal(old.S.works.length, migrated.works.length);
  assert.ok(old.S.works.every(w => w.estimatorVersion === 1)); assert.equal(old.S.schemaVersion, 3); assert.deepEqual(old.S.estimateLog, []);
  await old.click('export'); const ex = JSON.parse(old.h.blob); assert.deepEqual(ex.estimateLog, []); assert.ok(ex.works[0].topics[0].evidence);
  const back = await boot(old.store); assert.equal(back.S.schemaVersion, 3); assert.equal(JSON.stringify(back.S.blocks), JSON.stringify(migrated.blocks));
});
test('importar una exportación antigua: migra, guarda copia automática y exporta en esquema 3', async () => {
  const a = await boot(); await a.click('addTask'); await a.submit({ title: 'Previa', subjectId: a.S.subjects[0].id, dueDate: '2026-10-16', time: '', learn: 'ejercicios', size: '3', difficulty: '3', importance: '3', estOverride: '60', status: 'pending', notes: '' });
  const before = a.store['focusos.v1']; assert.equal(a.t.importText(JSON.stringify(fx('export-v1'))), null); await a.tick();
  assert.equal(a.S.schemaVersion, 3); assert.equal(JSON.parse(a.store['focusos.v1.backup']).works.length, JSON.parse(before).works.length);
  await a.click('export'); const ex = JSON.parse(a.h.blob); assert.equal(ex.schema, 3); assert.equal(ex.schemaVersion, 3);
  await a.click('undoImport'); assert.equal(a.S.works[0].title, 'Previa');
});
test('esquema futuro no soportado: se rechaza sin tocar los datos', async () => {
  const raw = JSON.stringify({ ...JSON.parse(stored('export-v2')), schemaVersion: 9 }), a = await boot({ 'focusos.v1': raw });
  assert.match(a.h.main.innerHTML, /Datos no válidos/); assert.equal(a.store['focusos.v1'], raw);
});
