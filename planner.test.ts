import test from 'node:test';
import assert from 'node:assert/strict';
import { plan, DEFAULT_SETTINGS, weekday, totalNeed } from '../src/core/planner.ts';
import { stats } from '../src/core/stats.ts';
import type { Block, Now, Work, Settings } from '../src/core/types.ts';

const now: Now = { date: '2026-10-12', minute: 480 }; // lunes 08:00
const exam = (o: Partial<Work> = {}): Work => ({ id: 'e1', kind: 'exam', subjectId: 'mat', title: 'Mates II', dueDate: '2026-10-20', dueMinute: 540, estMin: 360, difficulty: 4, importance: 5, readiness: 20, status: 'pending', ...o });
const task = (o: Partial<Work> = {}): Work => ({ id: 't1', kind: 'task', subjectId: 'fis', title: 'Problemas', dueDate: '2026-10-16', estMin: 120, difficulty: 3, importance: 3, readiness: 0, status: 'pending', ...o });
const run = (works: Work[], blocks: Block[] = [], n = now, settings: Settings = DEFAULT_SETTINGS) => plan({ settings, works, blocks }, n);
const live = (bs: Block[]) => bs.filter(b => b.status === 'planned' || b.status === 'done');
function assertValid(bs: Block[], n: Now, s: Settings = DEFAULT_SETTINGS) {
  const byDay = new Map<string, Block[]>();
  for (const b of live(bs)) (byDay.get(b.date) ?? byDay.set(b.date, []).get(b.date)!).push(b);
  for (const [date, arr] of byDay) {
    arr.sort((a, b) => a.start - b.start);
    assert.ok(arr.reduce((a, b) => a + b.end - b.start, 0) <= s.maxDayMin, `límite diario ${date}`);
    arr.forEach((b, i) => { if (i) assert.ok(arr[i - 1].end <= b.start, `solapamiento ${date}`); });
    for (const b of arr.filter(x => x.status === 'planned' && !x.manual)) {
      assert.ok(b.date > n.date || b.start >= n.minute, 'sesión en el pasado');
      assert.ok((s.availability[weekday(date)] ?? []).some(w => w.start <= b.start && b.end <= w.end), `fuera de disponibilidad ${date} ${b.start}`);
    }
  }
}
const planned = (r: { blocks: Block[] }) => r.blocks.filter(b => b.status === 'planned');

test('examen genera sesiones válidas que suman la necesidad, con repaso al final', () => {
  const r = run([exam()]); assertValid(r.blocks, now);
  assert.equal(planned(r).reduce((a, b) => a + b.end - b.start, 0), totalNeed(exam()));
  assert.ok(planned(r).some(b => b.part === 'review' && b.date >= '2026-10-18'));
  assert.equal(r.warnings.length, 0);
});
test('idempotente: segunda ejecución sin cambios ni duplicados', () => {
  const a = run([exam(), task()]); const b = run([exam(), task()], a.blocks);
  assert.deepEqual(b.blocks, a.blocks); assert.equal(b.created.length + b.removed.length, 0);
  assert.equal(new Set(b.blocks.map(x => x.id)).size, b.blocks.length);
});
test('respeta fechas bloqueadas', () => {
  const s = { ...DEFAULT_SETTINGS, blockedDates: [{ date: '2026-10-13', start: 0, end: 1440 }] };
  const r = run([exam()], [], now, s); assert.ok(!r.blocks.some(b => b.date === '2026-10-13')); assertValid(r.blocks, now, s);
});
test('avisa del déficit cuando no cabe', () => {
  const r = run([exam({ dueDate: '2026-10-13', estMin: 3000 })]);
  const w = r.warnings.find(x => x.type === 'deficit'); assert.ok(w && w.deficitMin! > 0); assertValid(r.blocks, now);
});
test('sesión completada se conserva y reduce lo pendiente; manual protegida', () => {
  const a = run([exam()]); const first = planned(a)[0];
  const manual: Block = { id: 'm1', workId: 'e1', date: '2026-10-14', start: 960, end: 1020, status: 'planned', manual: true };
  const blocks = [...a.blocks.map(b => b.id === first.id ? { ...b, status: 'done' as const } : b), manual];
  const b = run([exam()], blocks); assertValid(b.blocks, now);
  assert.ok(b.blocks.find(x => x.id === first.id)!.status === 'done'); assert.deepEqual(b.blocks.find(x => x.id === 'm1'), manual);
  assert.equal(live(b.blocks).reduce((x, y) => x + y.end - y.start, 0), totalNeed(exam()));
});
test('sesión incumplida se reprograma una sola vez', () => {
  const a = run([exam()]); const later: Now = { date: '2026-10-14', minute: 600 };
  const old = a.blocks.filter(b => b.date < later.date); assert.ok(old.length > 0);
  const blocks = a.blocks.map((b, i) => i === 0 ? { ...b, status: 'done' as const } : b);
  const b = run([exam()], blocks, later); assertValid(b.blocks, later);
  assert.equal(b.statusChanged.length, old.length - 1);
  assert.ok(b.statusChanged.every(id => b.blocks.find(x => x.id === id)!.status === 'rescheduled'));
  assert.equal(live(b.blocks).reduce((x, y) => x + y.end - y.start, 0), totalNeed(exam()));
  const c = run([exam()], b.blocks, later); assert.deepEqual(c.blocks, b.blocks);
});
test('cambiar la fecha del examen reorganiza solo el futuro', () => {
  const a = run([exam()]); const b = run([exam({ dueDate: '2026-10-15' })], a.blocks); assertValid(b.blocks, now);
  assert.ok(planned(b).every(x => x.date <= '2026-10-15'));
  assert.equal(planned(b).reduce((x, y) => x + y.end - y.start, 0), totalNeed(exam()));
});
test('tarea completada retira sus sesiones futuras automáticas', () => {
  const a = run([task()]); assert.ok(planned(a).length > 0);
  const b = run([task({ status: 'done' })], a.blocks); assert.equal(planned(b).length, 0);
});
test('estadísticas: planificado ≠ completado y sin doble conteo', () => {
  const w = [task()]; const mk = (id: string, st: Block['status'], s: number): Block => ({ id, workId: 't1', date: '2026-10-12', start: s, end: s + 60, status: st, manual: false });
  const r = stats([mk('a', 'done', 1000), mk('b', 'skipped', 1100), mk('c', 'rescheduled', 1200), mk('d', 'planned', 1300)], w, now);
  assert.equal(r.plannedMin, 180); assert.equal(r.completedMin, 60); assert.equal(r.compliance, 50); assert.equal(r.bySubject.fis, 60);
});
