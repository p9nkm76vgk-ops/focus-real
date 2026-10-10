"""Verificación FINAL en NAVEGADOR REAL (Chromium/Playwright; NO es Safari). Usa contextos aislados con datos de prueba: no toca datos reales.
Uso: python3 scripts/browser-final.py [carpeta_dist]  (por defecto dist)"""
import subprocess, time, json, sys, os, shutil, re
from datetime import datetime
from playwright.sync_api import sync_playwright
DIST = sys.argv[1] if len(sys.argv) > 1 else 'dist'; PORT = 8766; URL = f'http://127.0.0.1:{PORT}/'
RES, ERRS = [], []
def ck(name, cond, extra=''):
    RES.append((name, bool(cond), extra)); print(('OK   ' if cond else 'FALLO'), name, extra if not cond else '', flush=True)
def serve(d): return subprocess.Popen(['python3', '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], cwd=d, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
srv = serve(DIST); time.sleep(1)
FIX = json.load(open('test/fixtures/export-v2.json')); [FIX.pop(k) for k in ('app', 'schema', 'exportedAt')]
def newctx(b, seed=None):
    c = b.new_context(viewport={'width': 1180, 'height': 820}, has_touch=True, timezone_id='Europe/Madrid', locale='es-ES', accept_downloads=True)
    if seed is not None: c.add_init_script("if(!sessionStorage.getItem('seeded')){localStorage.setItem('focusos.v1'," + json.dumps(seed) + ");sessionStorage.setItem('seeded','1')}")
    return c
def newpage(c, fixed='2026-10-13T17:00:00'):
    p = c.new_page(); p.set_default_timeout(8000); p.on('dialog', lambda d: d.accept())
    p.on('pageerror', lambda e: ERRS.append(('pageerror', str(e)))); p.on('console', lambda m: ERRS.append(('console', m.text)) if m.type == 'error' else None)
    p.clock.set_fixed_time(datetime.fromisoformat(fixed)); p.goto(URL); p.wait_for_selector('#main h1'); return p
def go(p, r):
    if p.evaluate("innerWidth<1000") and p.evaluate("!document.body.classList.contains('open')"): p.click('#menuBtn')
    if r == 'asg' and p.get_attribute('#nav [data-g=subjects]', 'aria-expanded') == 'false': p.click('#nav [data-g=subjects]')
    p.click(f'#nav [data-r="{r}"]'); p.wait_for_timeout(150)
ls = lambda p, k='focusos.v1': json.loads(p.evaluate(f"localStorage.getItem('{k}')") or 'null')
def fill_form(p, **kw):
    for k, v in kw.items():
        sel = f'#f [name={k}]'
        if p.evaluate(f"document.querySelector('#f [name={k}]')?.tagName") == 'SELECT': p.select_option(sel, v)
        else: p.fill(sel, v)
    p.click('#f button.pri'); p.wait_for_timeout(250)
try:
  with sync_playwright() as pw:
    b = pw.chromium.launch()
    # ---- A: datos nuevos y aislados ----
    c = newctx(b); p = newpage(c)
    hoy = p.inner_text('#main'); ck('Hoy sin trabajo: muestra sugerencias opcionales etiquetadas', 'Tiempo libre' in hoy and 'Opcional' in hoy and 0 < p.locator('button[data-a=suggStart]').count() <= 3)
    ck('Aviso de descanso, sin obligar', 'No hace falta ocupar cada minuto' in hoy)
    go(p, 'tar'); ck('Estado vacío de tareas comprensible', p.locator('#main .empty, #main p.m').count() > 0 and 'Aún no hay tareas' in p.inner_text('#main'))
    go(p, 'hoy'); first = p.locator('button[data-a=suggStart]').first; first.click(); p.wait_for_timeout(250); ck('Iniciar → «En curso» (no completada)', 'En curso' in p.inner_text('#main'))
    p.click('button[data-a=suggDone]'); fill_form(p, minutes='12'); st = ls(p); ck('Terminar registra minutos', any(l['status'] == 'done' and l['minutes'] == 12 for l in st['suggestionLog']))
    p.locator('button[data-a=suggDrop]').first.click(); p.wait_for_timeout(200); p.locator('button[data-a=suggSwap]').first.click(); p.wait_for_timeout(200)
    st = ls(p); ck('Sugerencias NO crean tareas, sesiones ni actividades', len(st['works']) == 0 and len(st['blocks']) == 0 and len(st['activities']) == 0)
    n_log = len(st['suggestionLog']); p.reload(); p.wait_for_selector('#main h1'); ck('Tras recargar: log persistido y sin duplicados', len(ls(p)['suggestionLog']) == n_log)
    go(p, 'hoy'); p.click('button[data-a=addTask]'); fill_form(p, title='Prueba aislada', dueDate='2026-10-20', estOverride='120'); st = ls(p)
    ck('Tarea creada con sesiones planificadas', len(st['works']) == 1 and len(st['blocks']) > 0)
    go(p, 'cal'); blk = p.evaluate("(()=>{const e=document.querySelector('#main .blk.planned');return e?[getComputedStyle(e).borderLeftColor,e.closest('.wk')?e.innerText:'']:null})()")
    ck('Calendario: bloque con el color de Matemáticas II (#4F7CAC) y su nombre', blk and blk[0] == 'rgb(79, 124, 172)' and 'Matemáticas II' in blk[1], str(blk))
    go(p, 'exa'); p.click('button[data-a=addExam]'); fill_form(p, title='Parcial prueba', dueDate='2026-10-14', topics='Límites; 5; 5; 0; 12\nDerivadas; 5; 5; 0'); 
    go(p, 'hoy'); h = p.inner_text('#main'); ck('Trabajo urgente sin cubrir: «Trabajo real primero» y sin botones de sugerencia', 'Trabajo real primero' in h and p.locator('button[data-a=suggStart]').count() == 0)
    ck('Aviso de déficit visible (no finge que cabe)', 'No caben' in h)
    go(p, 'exa'); p.click('.item[data-a=editExam]'); p.wait_for_selector('#dlg button[data-a=upgradeV2]'); p.click('#dlg button[data-a=upgradeV2]'); p.wait_for_timeout(200)
    t = p.inner_text('#dlg'); ck('Comparación v1/v2 visible antes de aplicar', 'v1 (actual)' in t and 'v2' in t and 'copia de seguridad' in t)
    p.click('#dlg button[data-a=close]'); ck('Cancelar no cambia el estimador', (ls(p)['works'][1].get('estimatorVersion') or 1) != 2 and ls(p, 'focusos.v1.preupgrade') is None)
    p.click('.item[data-a=editExam]'); p.click('#dlg button[data-a=upgradeV2]'); p.click('#f button.pri'); p.wait_for_timeout(300); st = ls(p)
    ck('Aplicar v2: versión 2, copia previa y predicción original registrada', st['works'][1]['estimatorVersion'] == 2 and ls(p, 'focusos.v1.preupgrade') is not None and len(st['estimateLog']) == 1)
    ck('La tarea v1 sigue en v1', (st['works'][0].get('estimatorVersion') or 1) == 1 and 'estimateV2' not in st['works'][0])
    p.click('.item[data-a=editExam]'); t = p.inner_text('#dlg'); ck('v2 muestra rango orientativo, confianza y evidencia (no certeza)', 'orientativo' in t and 'confianza' in t and 'evidencia' in t); p.click('#dlg button[data-a=close]')
    go(p, 'eje'); ck('Ejercicio: estado vacío comprensible', 'Nada reservado' in p.inner_text('#main'))
    p.click('button[data-a=addAct]'); p.fill('#f [name=durMin]', '5'); p.click('#f button.pri'); p.wait_for_timeout(200); ck('Ejercicio: duración inválida bloqueada por el navegador y no se guarda nada', p.evaluate("document.querySelector('#f [name=durMin]').validity.rangeUnderflow") and len(ls(p)['activities']) == 0); p.fill('#f [name=durMin]', '30'); p.fill('#f [name=date]', '2026-10-16'); p.click('#f button.pri'); p.wait_for_timeout(250)
    a0 = ls(p)['activities']; ck('Ejercicio: sesión creada en un hueco libre', len(a0) == 1 and a0[0]['start'] is not None and a0[0]['durMin'] == 30)
    p.reload(); p.wait_for_selector('#main h1'); go(p, 'eje'); ck('Ejercicio persiste tras recargar', 'Ejercicio' in p.inner_text('#main') or '30min' in p.inner_text('#main'))
    p.click('button[data-a=editAct]'); fill_form(p, date='2026-10-17', time='11:00'); a1 = ls(p)['activities'][0]; ck('Ejercicio: mover/editar', a1['date'] == '2026-10-17' and a1['start'] == 660)
    p.click('button[data-a=doneAct]'); fill_form(p, actualMin='25'); ck('Ejercicio: completar con tiempo real', ls(p)['activities'][0]['actualMin'] == 25 and 'Completada · 25min' in p.inner_text('#main'))
    p.click('button[data-a=editAct]'); p.click('#fdel'); p.wait_for_timeout(250); ck('Ejercicio: eliminar con confirmación', len(ls(p)['activities']) == 0)
    go(p, 'aj'); p.fill('input[name=maxDayMin]', '200'); p.click('#sf button.pri'); p.wait_for_timeout(300); ck('Ajustes guardados y replanificación', ls(p)['settings']['maxDayMin'] == 200)
    p.locator('input.subc').first.fill('#112233'); p.wait_for_timeout(250); ck('Color personalizado y persistido', ls(p)['subjects'][0].get('userColor') == '#112233')
    p.locator('input.subc').nth(1).fill('#112233'); p.wait_for_timeout(250); ck('Color duplicado rechazado', ls(p)['subjects'][1].get('userColor') is None)
    p.click('button[data-a=resetColors]'); p.wait_for_timeout(250); ck('Restablecer paleta', ls(p)['subjects'][0].get('userColor') is None and ls(p)['subjects'][0]['color'] == '#4F7CAC')
    go(p, 'seg'); ck('Progreso: leyenda con nombres de las nueve asignaturas', all(n in p.inner_text('#main') for n in ['Matemáticas II', 'Física', 'Química', 'Business', 'Lengua Castellana', 'Catalán', 'Inglés', 'Historia de España', 'Historia de la Filosofía']))
    go(p, 'aj'); before = ls(p)
    with p.expect_download() as dl: p.click('button[data-a=export]')
    dl.value.save_as('/tmp/export-final.json'); ex = json.load(open('/tmp/export-final.json'))
    ck('Exportación completa (todas las listas)', all(k in ex for k in ('subjects', 'works', 'blocks', 'settings', 'activities', 'suggestionLog', 'estimateLog')) and len(ex['works']) == 2)
    c.close()
    c2 = newctx(b); p2 = newpage(c2); go(p2, 'aj'); p2.set_input_files('#imp', '/tmp/export-final.json'); p2.wait_for_timeout(500); s2 = ls(p2)
    ck('Importación restaura datos (otro origen limpio)', len(s2['works']) == 2 and len(s2['subjects']) == 9 and s2['works'][1]['estimatorVersion'] == 2 and len(s2['estimateLog']) == 1)
    p2.reload(); p2.wait_for_selector('#main h1'); ck('Importados persisten al recargar', len(ls(p2)['works']) == 2)
    # recarga + cierre/reapertura en el mismo contexto
    p3 = c2.new_page(); p3.goto(URL); p3.wait_for_selector('#main h1'); ck('Reabrir en pestaña nueva conserva datos', len(ls(p3)['works']) == 2); c2.close()
    # ---- B: datos antiguos (v2 anterior) ----
    raw = json.dumps(FIX); c = newctx(b, raw); p = newpage(c); st = ls(p)
    ck('Datos antiguos: migrados, nueve asignaturas y trabajos conservados', st['schemaVersion'] == 3 and len(st['subjects']) == 9 and len(st['works']) == len(FIX['works']) and all(s.get('colorKey') for s in st['subjects']))
    ck('Datos antiguos: copia previa idéntica byte a byte', p.evaluate("localStorage.getItem('focusos.v1.premigration')") == raw)
    ck('Datos antiguos: sesiones completadas y manuales intactas', all(any(x == bk for x in st['blocks']) for bk in FIX['blocks'] if bk['status'] == 'done' or bk.get('manual')))
    p.reload(); p.wait_for_selector('#main h1'); ck('Reabrir no repite la migración', p.evaluate("localStorage.getItem('focusos.v1.premigration')") == raw); c.close()
    # ---- C: datos corruptos ----
    c = newctx(b, '{bad'); p = newpage(c); ck('Datos corruptos: pantalla de recuperación, original intacto', 'Datos no válidos' in p.inner_text('#main') and p.evaluate("localStorage.getItem('focusos.v1')") == '{bad' and p.evaluate("localStorage.getItem('focusos.v1.corrupt')") == '{bad'); c.close()
    # ---- D: actualización del service worker no toca datos ----
    c = newctx(b); p = newpage(c); go(p, 'tar'); p.click('button[data-a=addTask]'); fill_form(p, title='Dato del usuario', dueDate='2026-12-01', estOverride='60')
    p.evaluate("navigator.serviceWorker.ready.then(()=>1)"); snap = p.evaluate("localStorage.getItem('focusos.v1')"); k1 = p.evaluate("caches.keys()")
    srv.terminate(); time.sleep(.5); shutil.rmtree('/tmp/dist2', ignore_errors=True); shutil.copytree(DIST, '/tmp/dist2')
    sw = open('/tmp/dist2/sw.js').read(); open('/tmp/dist2/sw.js', 'w').write(re.sub(r"focusos-[0-9a-f]+", "focusos-nueva", sw)); ix = open('/tmp/dist2/index.html').read(); open('/tmp/dist2/index.html', 'w').write(ix.replace('</body>', '<!--version-nueva--></body>'))
    srv = serve('/tmp/dist2'); time.sleep(1); p.evaluate("navigator.serviceWorker.getRegistration().then(r=>r.update())"); p.wait_for_timeout(1500); k2 = p.evaluate("caches.keys()")
    ck('SW: la actualización instala la caché nueva y retira la antigua', k2 == ['focusos-nueva'] and k1 != k2, f'{k1}->{k2}')
    ck('SW: los datos del usuario no cambian al actualizar', p.evaluate("localStorage.getItem('focusos.v1')") == snap)
    c.set_offline(True); html = p.evaluate("fetch('./').then(r=>r.text())"); ck('Sin conexión sirve la versión nueva desde caché', 'version-nueva' in html)
    p.reload(); p.wait_for_selector('#main h1'); ck('Sin conexión: abre y conserva el dato', 'Dato del usuario' in (p.evaluate("localStorage.getItem('focusos.v1')") or '')); c.close()
    b.close()
finally: srv.terminate()
errs = [e for e in ERRS]; ck('Sin errores de consola ni de página en todos los flujos', not errs, str(errs[:3]))
bad = [r for r in RES if not r[1]]; print(f"\nRESULTADO: {len(RES)-len(bad)}/{len(RES)} comprobaciones superadas en Chromium real"); sys.exit(1 if bad else 0)
