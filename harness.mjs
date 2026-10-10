// DOM SIMULADO (no es un navegador): ejecuta dist/index.html en vm con stubs de document/localStorage/FormData/Date.
import fs from 'node:fs'; import vm from 'node:vm';
export const clock = { t: new Date(2026, 9, 12, 8, 0).getTime() }; // lunes 12-oct-2026 08:00 local
const tick = () => new Promise(r => setTimeout(r, 15));
export async function boot(store = {}, opts = {}) {
  const src = fs.readFileSync(opts.dist ?? 'dist/index.html', 'utf8').split('<script>')[1].split('</script>')[0] + '\n;globalThis.__t={V,A,get S(){return S},commit,importText,stats,wk,get route(){return route},setSubjectColor:typeof setSubjectColor==="undefined"?undefined:setSubjectColor,currentSugg:typeof currentSugg==="undefined"?undefined:currentSugg,UI:typeof UI==="undefined"?undefined:()=>UI,MIG:typeof MIG==="undefined"?undefined:MIG};';
  const h = { toast: '', err: '', form: {}, confirm: true, blob: '', main: { innerHTML: '' } };
  const el = { innerHTML: '', style: {}, classList: { toggle() {} }, open: false, showModal() { this.open = true }, close() { this.open = false }, onsubmit: null, onclick: null, set textContent(v) { h.err = v } };
  h.dlg = el;
  const toastEl = { style: {}, set textContent(v) { h.toast = v } };
  h.nav = { innerHTML: '' }; h.top = { textContent: '' }; h.classes = new Set(); h.menu = { setAttribute() {} };
  const sel = s => s === '#toast' ? toastEl : s === '#main' ? h.main : s === '#nav' ? h.nav : s === '#topTitle' ? h.top : s === '#menuBtn' ? h.menu : el;
  class FD extends Date { constructor(...a) { a.length ? super(...a) : super(clock.t) } static now() { return clock.t } }
  class FormData { constructor() { this.e = Object.entries(h.form) } [Symbol.iterator]() { return this.e[Symbol.iterator]() } }
  const ctx = { document: { querySelector: sel, querySelectorAll: () => [], addEventListener() {}, hidden: false, body: { appendChild() {}, classList: { add: c => h.classes.add(c), remove: c => h.classes.delete(c), contains: c => h.classes.has(c), toggle: (c, f) => (f === undefined ? !h.classes.has(c) : f) ? h.classes.add(c) : h.classes.delete(c) } }, createElement: () => ({ click() {}, remove() {} }) },
    localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v) } }, crypto: globalThis.crypto, setInterval() {}, setTimeout() {}, console, Date: FD, FormData, JSON, Math, Object, Array, Set, Promise,
    URL: { createObjectURL: () => 'blob:x', revokeObjectURL() {} }, Blob: class { constructor(p) { h.blob = p[0] } }, confirm: () => h.confirm, navigator: {} };
  vm.createContext(ctx); vm.runInContext(src, ctx); await tick();
  const app = { h, store, ctx, get t() { return ctx.__t }, get S() { return ctx.__t?.S }, tick };
  app.submit = async v => { h.err = ''; h.form = v; await el.onsubmit({ preventDefault() {}, target: el }); await tick(); return h.err };
  app.click = async (a, id, k) => { await ctx.__t.A[a]({ dataset: { id, k } }); await tick() };
  return app;
}
