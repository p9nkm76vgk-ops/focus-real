"""Comprobación en NAVEGADOR REAL (Chromium vía Playwright; NO es Safari/WebKit). Requiere `pip` playwright ya instalado. Uso: python3 scripts/browser-check.py"""
import subprocess, time, json, sys
from playwright.sync_api import sync_playwright
srv = subprocess.Popen(['python3', '-m', 'http.server', '8765', '--bind', '127.0.0.1'], cwd='dist', stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
URL = 'http://127.0.0.1:8765/'; R = {'fallos': []}
def fail(m): R['fallos'].append(m)
ROUTES = ['hoy', 'tar', 'exa', 'cal', 'asg', 'eje', 'seg', 'aj']
try:
  with sync_playwright() as p:
    b = p.chromium.launch()
    for name, vw, vh in [('ipad-vertical', 820, 1180), ('ipad-horizontal', 1180, 820), ('ipad-mini-vertical', 744, 1133), ('iphone', 390, 844)]:
        ctx = b.new_context(viewport={'width': vw, 'height': vh}, has_touch=True, is_mobile=True, device_scale_factor=2); pg = ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        pg.goto(URL); pg.wait_for_selector('#main h1'); drawer = vw < 1000; info = {'overflow': [], 'objetivos<44px': set()}
        side_visible = pg.evaluate("(()=>{const r=document.querySelector('#nav').getBoundingClientRect();return r.right>0&&r.left>=0})()")
        if side_visible == drawer: fail(f'{name}: menú lateral {"visible" if side_visible else "oculto"} y debería ser {"drawer oculto" if drawer else "fijo visible"}')
        for r in ROUTES:
            if drawer and pg.evaluate("!document.body.classList.contains('open')"): pg.click('#menuBtn'); pg.wait_for_timeout(250)
            if r == 'asg' and pg.get_attribute('#nav [data-g=subjects]', 'aria-expanded') == 'false': pg.click('#nav [data-g=subjects]')
            pg.click(f'#nav [data-r="{r}"]'); pg.wait_for_timeout(250)
            if drawer and pg.evaluate("document.body.classList.contains('open')"): fail(f'{name}/{r}: el menú no se cierra al navegar')
            m = pg.evaluate("({sw:document.documentElement.scrollWidth,iw:innerWidth,off:[...document.querySelectorAll('#main *')].filter(e=>!e.closest('.wk')&&e.getBoundingClientRect().right>innerWidth+1).slice(0,3).map(e=>e.tagName+'.'+e.className)})")
            if m['sw'] > m['iw'] + 1 or m['off']: info['overflow'].append({r: m})
            for t in pg.evaluate("[...document.querySelectorAll('button,input:not([type=hidden]),select,textarea')].filter(e=>e.offsetParent&&(!e.closest('#nav')||true)).map(e=>[e.tagName,(e.textContent||e.name||'').trim().slice(0,24),Math.round(e.getBoundingClientRect().height)]).filter(x=>x[2]<44)"): info['objetivos<44px'].add(tuple(t))
            if name == 'ipad-horizontal' and r in ('hoy', 'cal', 'eje'): pg.screenshot(path=f'/tmp/shots/{name}-{r}.png')
        if info['overflow']: fail(f'{name}: desbordamiento horizontal {info["overflow"]}')
        if info['objetivos<44px']: fail(f'{name}: objetivos táctiles < 44px {sorted(info["objetivos<44px"])[:6]}')
        if errs: fail(f'{name}: errores de consola/página {errs[:3]}')
        if name == 'ipad-vertical':
            pg.click('#nav [data-r="hoy"]') if not drawer else None
            pg.click('#menuBtn'); pg.wait_for_timeout(300); pg.screenshot(path='/tmp/shots/ipad-vertical-drawer.png'); pg.click('.scrim', position={'x': vw - 20, 'y': 200}); pg.wait_for_timeout(300)
            if pg.evaluate("document.body.classList.contains('open')"): fail('ipad-vertical: tocar el fondo no cierra el menú')
            pg.screenshot(path='/tmp/shots/ipad-vertical-hoy.png')
        R[name] = {'rutas ok': len(ROUTES)}; ctx.close(); print('ok', name, flush=True)
    # menú plegable en horizontal, colores computados, persistencia, service worker y sin conexión
    ctx = b.new_context(viewport={'width': 1180, 'height': 820}, has_touch=True); pg = ctx.new_page(); pg.goto(URL); pg.wait_for_selector('#main h1')
    print('sección interactiva', flush=True); pg.click('#nav [data-g=subjects]'); n = pg.evaluate("document.querySelectorAll('#nav .nv.sub .dot').length"); R['asignaturas en menú'] = n
    if n != 9: fail(f'menú: {n} asignaturas con color en vez de 9')
    cols = pg.evaluate("[...document.querySelectorAll('#nav .nv.sub .dot')].map(e=>getComputedStyle(e).backgroundColor)"); R['colores únicos'] = len(set(cols))
    if len(set(cols)) != 9: fail('colores de asignatura no únicos en el menú')
    R['fondo'] = pg.evaluate("getComputedStyle(document.body).backgroundColor"); R['activo'] = pg.evaluate("getComputedStyle(document.querySelector('#nav [aria-current=page]')).backgroundColor")
    w0 = pg.evaluate("document.querySelector('.main').getBoundingClientRect().left"); pg.click('#nav [data-a=rail]'); pg.wait_for_timeout(350); w1 = pg.evaluate("document.querySelector('.main').getBoundingClientRect().left"); R['contenido x (expandido→contraído)'] = [w0, w1]
    if not w1 < w0 - 100: fail('al contraer el menú el contenido no gana espacio')
    pg.reload(); pg.wait_for_selector('#main h1'); R['rail persiste'] = pg.evaluate("document.body.classList.contains('rail')"); pg.click('#nav [data-a=rail]')
    pg.click('button[data-a=addTask]'); pg.fill('#f input[name=title]', 'Tarea de prueba real'); pg.fill('#f input[name=dueDate]', '2030-12-30'); pg.fill('#f input[name=estOverride]', '60'); pg.click('#f button.pri'); pg.wait_for_timeout(400)
    stored = pg.evaluate("localStorage.getItem('focusos.v1')"); R['persistido tras guardar'] = 'Tarea de prueba real' in (stored or '')
    if not R['persistido tras guardar']: fail('la tarea no se guardó en localStorage')
    print('sw', flush=True); R['sw listo'] = pg.evaluate("Promise.race([navigator.serviceWorker.ready.then(()=>true),new Promise(r=>setTimeout(()=>r(false),8000))])"); pg.wait_for_timeout(500); R['caches'] = pg.evaluate("caches.keys()"); R['sw controla'] = pg.evaluate("!!navigator.serviceWorker.controller") 
    pg.reload(); pg.wait_for_selector('#main h1'); R['sw controla tras recargar'] = pg.evaluate("!!navigator.serviceWorker.controller")
    if not R['caches']: fail('el service worker no creó caché')
    print('offline', flush=True); ctx.set_offline(True); pg.reload(); pg.wait_for_selector('#main h1', timeout=8000); R['abre sin conexión'] = pg.title() == 'Focus OS'
    R['dato tras reabrir sin conexión'] = 'Tarea de prueba real' in (pg.evaluate("localStorage.getItem('focusos.v1')") or '')
    if not (R['abre sin conexión'] and R['dato tras reabrir sin conexión']): fail('sin conexión no abre o pierde el dato')
    ctx.set_offline(False); mf = pg.evaluate("fetch('manifest.webmanifest').then(r=>r.json())"); R['manifest'] = {k: mf[k] for k in ('name', 'display', 'start_url')}
    ctx.close(); b.close()
finally: srv.terminate()
print(json.dumps(R, ensure_ascii=False, indent=1, default=list)); sys.exit(1 if R['fallos'] else 0)
