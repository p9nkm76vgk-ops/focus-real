// Genera los iconos PNG (sin dependencias): oliva #6E7D4E con diana blanca. `node scripts/make-icons.mjs`
import zlib from 'node:zlib'; import fs from 'node:fs';
const crc = (b) => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } let r = ~0; for (const x of b) r = t[(r ^ x) & 255] ^ (r >>> 8); return ~r >>> 0; };
const chunk = (t, d) => { const b = Buffer.concat([Buffer.from(t), d]), o = Buffer.alloc(4); o.writeUInt32BE(d.length); const c = Buffer.alloc(4); c.writeUInt32BE(crc(b)); return Buffer.concat([o, b, c]); };
function png(size, k) { // k = escala del símbolo (el maskable usa menos para respetar la zona segura)
  const raw = Buffer.alloc(size * (size * 3 + 1)), O = [0x6e, 0x7d, 0x4e], sc = size / 2, cl = (x) => Math.min(1, Math.max(0, x));
  for (let y = 0; y < size; y++) { raw[y * (size * 3 + 1)] = 0; for (let x = 0; x < size; x++) {
    const d = Math.hypot(x + .5 - sc, y + .5 - sc) / sc, r0 = .46 * k, r1 = .62 * k, r2 = .22 * k, a = Math.max(cl(.5 + (r1 - d) * sc) * cl(.5 + (d - r0) * sc), cl(.5 + (r2 - d) * sc));
    for (let c = 0; c < 3; c++) raw[y * (size * 3 + 1) + 1 + x * 3 + c] = Math.round(O[c] * (1 - a) + 255 * a); } }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(size, 0); ih.writeUInt32BE(size, 4); ih[8] = 8; ih[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
for (const [n, s, k] of [['icon-180', 180, 1.25], ['icon-192', 192, 1.25], ['icon-512', 512, 1.25], ['icon-maskable-512', 512, .95]]) fs.writeFileSync(`public/${n}.png`, png(s, k));
console.log('iconos generados');
