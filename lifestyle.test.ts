// Paleta, ejercicio físico, actividades de reserva y migración aditiva (unitarias reales en Node).
import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SUBJECT_COLORS as C, effectiveColor, colorConflict, resetColors, nextSpare } from '../src/core/palette.ts';
import { findSlot, conflictOf, validateActivity, weekMinutes, suggest, freeWindows } from '../src/core/lifestyle.ts';
import { plan, DEFAULT_SETTINGS } from '../src/core/planner.ts';
import { reestimate } from '../src/core/estimator.ts';
import { migrateState, lostPaths } from '../src/core/migrate.ts';
import fs from 'node:fs';
import type { Activity, Block, SuggLog, Work } from '../src/core/types.ts';

const NOW = { date: '2026-10-12', minute: 480 };
const act = (o: Partial<Activity> = {}): Activity => ({ id: 'a1', category: 'exercise', type: 'caminar', date: '2026-10-13', start: 1020, end: 1050, durMin: 30, status: 'planned', createdAt: 1, updatedAt: 1, ...o });
const work = (o: Partial<Work> = {}): Work => ({ id: 'w', kind: 'task', subjectId: 'm', title: 'Tarea', dueDate: '2026-10-30', estMin: 60, difficulty: 3, importance: 3, readiness: 0, status: 'pending', ...o });
const blk = (o: Partial<Block> = {}): Block => ({ id: 'b', workId: 'w', date: '2026-10-13', start: 1020, end: 1070, status: 'planned', manual: false, ...o });
const names = ['Matemáticas II', 'Física', 'Química', 'Business', 'Lengua Castellana', 'Catalán', 'Inglés', 'Historia de España', 'Historia de la Filosofía'];

// ---- color por asignatura ----
const lab = (h: string) => { const l = (c: number) => (c /= 255) <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; const [r, g, b] = [1, 3, 5].map(i => l(parseInt(h.slice(i, i + 2), 16))); const f = (t: number) => t > .008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116; const X = (.4124 * r + .3576 * g + .1805 * b) / .95047, Y = .2126 * r + .7152 * g + .0722 * b, Z = (.0193 * r + .1192 * g + .9505 * b) / 1.08883; return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))]; };
const lum = (h: string) => { const l = (c: number) => (c /= 255) <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; const [r, g, b] = [1, 3, 5].map(i => l(parseInt(h.slice(i, i + 2), 16))); return .2126 * r + .7152 * g + .0722 * b; };
test('las nueve asignaturas tienen un color único, distinguible y con contraste de interfaz frente al blanco', () => {
  assert.deepEqual(Object.keys(C).sort(), [...names].sort()); const cols = Object.values(C); assert.equal(new Set(cols.map(c => c.toLowerCase())).size, 9);
  for (let i = 0; i < 9; i++) { assert.ok((1.05) / (lum(cols[i]) + .05) >= 3, `contraste UI ${cols[i]}`); for (let j = i + 1; j < 9; j++) assert.ok(Math.hypot(...lab(cols[i]).map((v, k) => v - lab(cols[j])[k])) >= 15, `${cols[i]} vs ${cols[j]} demasiado parecidos`); }
});
test('color efectivo: personalizado > predeterminado por clave > heredado; datos antiguos compatibles; restablecer', () => {
  assert.equal(effectiveColor({ color: '#c9a45c', colorKey: 'Física' }), C['Física']); assert.equal(effectiveColor({ color: '#c9a45c' }), '#c9a45c', 'sin clave se respeta el color guardado');
  assert.equal(effectiveColor({ color: '#111111', colorKey: 'Física', userColor: '#222222' }), '#222222');
  const subs = [{ id: 'a', colorKey: 'Física', userColor: '#222222', color: '#c9a45c' }, { id: 'b', colorKey: 'Inglés', color: '#c9a45c' }];
  assert.ok(colorConflict(subs, 'b', '#222222')); assert.ok(!colorConflict(subs, 'a', '#222222')); assert.ok(colorConflict(subs, 'a', C['Inglés'].toLowerCase()));
  const r = resetColors(subs); assert.equal(effectiveColor(r[0]), C['Física']); assert.equal(r[0].color, '#c9a45c', 'el color heredado no se pierde');
  assert.ok(!Object.values(C).includes(nextSpare(Object.values(C))));
});
// ---- ejercicio ----
test('ejercicio: validación moderada (sin cargas extremas) y estado completado exige tiempo real', () => {
  assert.equal(validateActivity(act(), NOW), null); assert.match(validateActivity(act({ durMin: 5 }), NOW)!, /duración/); assert.match(validateActivity(act({ durMin: 400 }), NOW)!, /duración/);
  assert.match(validateActivity(act({ status: 'done' }), NOW)!, /tiempo real/); assert.equal(validateActivity(act({ status: 'done', actualMin: 25, date: '2026-10-10' }), NOW), null);
  assert.match(validateActivity(act({ date: '2026-10-11' }), NOW)!, /pasado/);
});
test('ejercicio: reserva solo en huecos libres de la disponibilidad; sin hueco = null (se informa, nada se desplaza)', () => {
  const s = findSlot(DEFAULT_SETTINGS, [blk({ date: '2026-10-12', start: 1020, end: 1070 })], [], NOW, 30)!; assert.ok(s); assert.equal(s.end - s.start, 30);
  assert.ok(freeWindows(DEFAULT_SETTINGS, [], [], s.date).some(w => w.start <= s.start && s.end <= w.end), 'dentro de la disponibilidad');
  const full = { ...DEFAULT_SETTINGS, blockedDates: Array.from({ length: 8 }, (_, i) => ({ date: `2026-10-${12 + i}`, start: 0, end: 1440 })) }; assert.equal(findSlot(full, [], [], NOW, 30), null);
});
test('ejercicio: conflictos con estudio manual/completado y otras actividades se informan', () => {
  assert.match(conflictOf(act({ start: 1030, end: 1060 }), [blk({ manual: true })], [])!, /manual/); assert.match(conflictOf(act(), [blk({ status: 'done' })], [])!, /completada/);
  assert.match(conflictOf(act({ id: 'x' }), [], [act()])!, /otra actividad/); assert.equal(conflictOf(act(), [], []), null); assert.equal(conflictOf(act(), [blk({ status: 'skipped' })], []), null);
});
test('ejercicio: tiempo semanal separa completado y planificado', () => {
  const w = weekMinutes([act({ status: 'done', actualMin: 40, date: '2026-10-12' }), act({ id: 'b', date: '2026-10-14' }), act({ id: 'c', category: 'optional', date: '2026-10-14', status: 'done', actualMin: 99 })], '2026-10-12');
  assert.deepEqual(w, { doneMin: 40, plannedMin: 30, sessions: 1 });
});
test('planificador: el estudio automático se coloca alrededor del ejercicio; manuales y completadas intactas; idempotente', () => {
  const exAct = act({ date: '2026-10-12', start: 1020, end: 1100 }), manual: Block = blk({ id: 'm', date: '2026-10-14', start: 1000, end: 1060, manual: true }), done: Block = blk({ id: 'd', date: '2026-10-13', start: 1000, end: 1050, status: 'done', actualMin: 50 });
  const w = [work({ estMin: 240 })], a = plan({ settings: DEFAULT_SETTINGS, works: w, blocks: [manual, done], activities: [exAct] }, NOW);
  assert.ok(!a.blocks.some(b => b.status === 'planned' && !b.manual && b.date === '2026-10-12' && b.start < 1100 + 10 && 1020 - 10 < b.end), 'no se solapa con el ejercicio');
  assert.deepEqual(a.blocks.find(b => b.id === 'm'), manual); assert.deepEqual(a.blocks.find(b => b.id === 'd'), done);
  const b = plan({ settings: DEFAULT_SETTINGS, works: w, blocks: a.blocks, activities: [exAct] }, NOW); assert.deepEqual(b.blocks, a.blocks);
});
// ---- actividades de reserva ----
const S = (o: any = {}) => suggest({ settings: DEFAULT_SETTINGS, works: [], blocks: [], activities: [], log: [], now: { date: '2026-10-13', minute: 1000 }, names: { m: 'Matemáticas II' }, ...o });
test('sugerencias: con trabajo prioritario sin cubrir NO se ofrecen (salvo consulta explícita); sin él, selección corta', () => {
  const urgent = work({ dueDate: '2026-10-14', estMin: 120 }), r = S({ works: [urgent] }); assert.equal(r.mode, 'prioridad'); assert.equal(r.items.length, 0); assert.equal(r.priority[0].id, 'w');
  const f = S({ works: [urgent], forced: true }); assert.equal(f.mode, 'libre'); assert.ok(f.items.length > 0 && f.items.length <= 3); assert.equal(f.priority.length, 1, 'se sigue mostrando lo real');
  assert.equal(S({ works: [work({ dueDate: '2026-12-30' })] }).mode, 'libre');
  const covered = S({ works: [urgent], blocks: [blk({ date: '2026-10-14', start: 1000, end: 1120 })] }); assert.equal(covered.mode, 'libre', 'si el trabajo restante ya está planificado, el tiempo libre es libre');
});
test('sugerencias: respetan hueco y hora, nunca más de 3, sin duplicados, deterministas y sin mutar datos', () => {
  const inputs = { works: [work({ dueDate: '2026-12-30', kind: 'exam' })], blocks: [blk()], activities: [act()], log: [] as SuggLog[] }, snap = JSON.stringify(inputs);
  const a = S(inputs), b = S(inputs); assert.deepEqual(a, b); assert.equal(JSON.stringify(inputs), snap); assert.ok(a.items.length <= 3 && new Set(a.items.map(x => x.id)).size === a.items.length);
  const room = freeWindows(DEFAULT_SETTINGS, inputs.blocks, inputs.activities, '2026-10-13', { date: '2026-10-13', minute: 1000 }).reduce((m, w) => Math.max(m, w.end - w.start), 0); assert.ok(a.items.every(x => x.minutes <= room));
  const night = S({ ...inputs, now: { date: '2026-10-13', minute: 1290 } }); assert.ok(night.items.every(x => x.energy !== 'alta'), 'de noche solo actividades suaves');
});
test('sugerencias: posponer/descartar/sustituir/mover/hacer se respetan; sugerido ≠ completado; sin hueco = descansar', () => {
  const base = { works: [work({ dueDate: '2026-12-30' })] }, first = S(base).items[0];
  for (const status of ['dismissed', 'replaced', 'moved', 'done'] as const) assert.ok(!S({ ...base, log: [{ id: first.id, date: '2026-10-13', kind: first.kind, status, at: 1 }] }).items.some(x => x.id === first.id), status);
  assert.ok(!S({ ...base, log: [{ id: first.id, date: '2026-10-13', kind: first.kind, status: 'postponed', until: 1100, at: 1 }] }).items.some(x => x.id === first.id));
  assert.ok(S({ ...base, now: { date: '2026-10-13', minute: 1101 }, log: [{ id: first.id, date: '2026-10-13', kind: first.kind, status: 'postponed', until: 1100, at: 1 }] }).items.some(x => x.id === first.id), 'pospuesta caduca');
  assert.equal(S({ ...base, settings: { ...DEFAULT_SETTINGS, blockedDates: [{ date: '2026-10-13', start: 0, end: 1440 }] } }).mode, 'sin-hueco');
  assert.match(S(base).note, /no hace falta ocupar cada minuto/i);
});
test('sugerencias: no alteran estimador, dominio ni evidencias', () => {
  const w = [work({ id: 'e', kind: 'exam', dueDate: '2026-12-30', estimatorVersion: 2, topics: [{ id: 't', name: 't', size: 3, difficulty: 3, mastery: 1, evidence: [], extent: { unit: 'a', count: 3 } }] })];
  const before = JSON.stringify(reestimate(w, [], { families: {}, now: '2026-10-12' })); const log: SuggLog[] = [{ id: '2026-10-13|repaso', date: '2026-10-13', kind: 'repaso', status: 'done', minutes: 20, at: 1 }];
  S({ works: w, log, forced: true }); assert.equal(JSON.stringify(reestimate(w, [], { families: {}, now: '2026-10-12' })), before); assert.deepEqual(w[0].topics![0].evidence, []);
});
// ---- migración aditiva ----
test('migración: añade actividades, registro de sugerencias y clave de color sin tocar nada existente; idempotente', () => {
  for (const n of ['export-v1', 'export-v2']) {
    const o = JSON.parse(fs.readFileSync(`test/fixtures/${n}.json`, 'utf8')), m = migrateState(o); assert.deepEqual(lostPaths(o, m.state), []);
    assert.deepEqual(m.state.activities, []); assert.deepEqual(m.state.suggestionLog, []); assert.ok(m.state.subjects.filter((s: any) => s.name in C).every((s: any) => s.colorKey === s.name));
    assert.equal(m.state.subjects[0].color, o.subjects[0].color, 'color heredado intacto'); assert.equal(migrateState(m.state).changed, false);
  }
  const x = { schemaVersion: 3, subjects: [{ id: 's', name: 'Mi asignatura', color: '#abcdef' }], works: [], blocks: [], settings: {} }; const m = migrateState(x).state; assert.equal(m.subjects[0].colorKey, undefined);
});
