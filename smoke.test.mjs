// Humo: ejecuta la app con un DOM simulado y recorre todas las vistas con datos reales del planificador.
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import vm from 'node:vm';
test('la app arranca, crea examen, persiste y renderiza todas las vistas', async () => {
  const html = fs.readFileSync('dist/index.html', 'utf8'); const src = html.split('<script>')[1].split('</script>')[0] + '\n;globalThis.__t={V,A,get S(){return S},commit,wk,repo};';
  const el = { innerHTML: '', style: {}, classList: { toggle() {} }, open: false, showModal() {}, close() {}, set textContent(v) {}, }; const store = {};
  const ctx = { document: { body: { classList: { toggle() {}, add() {}, remove() {} }, appendChild() {} }, querySelector: () => el, querySelectorAll: () => [], addEventListener() {}, createElement: () => ({ click() {} }) }, localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v } }, crypto, setInterval() {}, setTimeout() {}, console, Date, JSON, URL, Blob };
  vm.createContext(ctx); vm.runInContext(src, ctx); await new Promise(r => setTimeout(r, 50));
  const t = ctx.__t, S = t.S, d = new Date(Date.now() + 6 * 864e5).toISOString().slice(0, 10);
  S.works.push({ id: 'x', kind: 'exam', subjectId: S.subjects[0].id, title: 'Parcial', dueDate: d, estMin: 300, difficulty: 3, importance: 4, readiness: 10, status: 'pending' });
  await t.commit(); const n1 = S.blocks.length; assert.ok(n1 > 0, 'genera sesiones');
  await t.commit(); assert.equal(S.blocks.length, n1, 'idempotente');
  assert.ok(JSON.parse(store['focusos.v1']).blocks.length === n1, 'persistido');
  for (const v of Object.keys(t.V)) assert.ok(typeof t.V[v]() === 'string' && !t.V[v]().includes('undefined'), 'vista ' + v);
});
