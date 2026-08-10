// Pure-Node PNG icon generator — no native deps.
// Draws the MoneyFlow mark: gradient tile, white coin, upward arrow.
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");
mkdirSync(outDir, { recursive: true });

// ---- tiny CRC32 ----
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

// ---- drawing helpers ----
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
const cover = (d) => Math.min(1, Math.max(0, 0.5 - d));
function segDist(px, py, ax, ay, bx, by) {
  const abx = bx - ax,
    aby = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / (abx * abx + aby * aby)));
  return Math.hypot(px - (ax + abx * t), py - (ay + aby * t));
}

function render(size) {
  const s = size / 512;
  const buf = Buffer.alloc(size * size * 4);
  const top = [0x7c, 0x9c, 0xff];
  const bot = [0xb9, 0x8b, 0xff];
  const arrow = [0x8a, 0x8f, 0xff];
  const coinC = 256 * s;
  const coinR = 150 * s;
  const arrowR = 23 * s;
  const segs = [
    [256 * s, 336 * s, 256 * s, 208 * s],
    [196 * s, 268 * s, 256 * s, 188 * s],
    [256 * s, 188 * s, 316 * s, 268 * s],
  ];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const px = x + 0.5;
      const py = y + 0.5;
      // full-bleed diagonal gradient
      const t = Math.min(1, Math.max(0, (x / size) * 0.4 + (y / size) * 0.6));
      let col = mix(top, bot, t);
      // white coin
      const coinA = cover(Math.hypot(px - coinC, py - coinC) - coinR);
      if (coinA > 0) col = mix(col, [255, 255, 255], coinA);
      // arrow
      let aA = 0;
      for (const [ax, ay, bx, by] of segs) {
        aA = Math.max(aA, cover(segDist(px, py, ax, ay, bx, by) - arrowR));
      }
      if (aA > 0) col = mix(col, arrow, aA);

      buf[i] = Math.round(col[0]);
      buf[i + 1] = Math.round(col[1]);
      buf[i + 2] = Math.round(col[2]);
      buf[i + 3] = 255;
    }
  }
  return buf;
}

for (const size of [192, 512, 180]) {
  const png = encodePNG(size, size, render(size));
  const name = size === 180 ? "apple-touch-icon.png" : `icon-${size}.png`;
  writeFileSync(join(outDir, name), png);
  console.log("wrote", name, png.length, "bytes");
}
