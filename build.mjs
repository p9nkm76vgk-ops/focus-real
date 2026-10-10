// Genera dist/index.html autónomo reutilizando src/core/*.ts (tipos eliminados con node:module).
import { stripTypeScriptTypes } from 'node:module'; import fs from 'node:fs';
const js = f => stripTypeScriptTypes(fs.readFileSync(f, 'utf8'), { mode: 'strip' }).replace(/^import .*$/gm, '').replace(/^export /gm, '');
const r = f => fs.readFileSync(f, 'utf8');
const out = r('src/app/index.template.html').replace('/*CSS*/', () => r('src/app/style.css')).replace('/*PLANNER*/', () => js('src/core/planner.ts')).replace('/*CONFIG*/', () => js('src/core/config.ts')).replace('/*ESTIMATOR2*/', () => js('src/core/estimator2.ts')).replace('/*ESTIMATOR*/', () => js('src/core/estimator.ts')).replace('/*PALETTE*/', () => js('src/core/palette.ts')).replace('/*LIFESTYLE*/', () => js('src/core/lifestyle.ts')).replace('/*MIGRATE*/', () => js('src/core/migrate.ts')).replace('/*STATS*/', () => js('src/core/stats.ts')).replace('/*APP*/', () => r('src/app/app.js'));
fs.mkdirSync('dist', { recursive: true }); fs.cpSync('public', 'dist', { recursive: true }); fs.writeFileSync('dist/index.html', out);
import('node:crypto').then(({ default: crypto }) => { const files = fs.readdirSync('dist').filter(f => f !== 'sw.js' && f !== '_headers'), ver = crypto.createHash('sha256').update(out).digest('hex').slice(0, 10);
  fs.writeFileSync('dist/sw.js', fs.readFileSync('src/app/sw.template.js', 'utf8').replace(/__VERSION__/g, ver).replace('__FILES__', JSON.stringify(['./', ...files]))); }); console.log('dist/index.html', out.length, 'bytes');
