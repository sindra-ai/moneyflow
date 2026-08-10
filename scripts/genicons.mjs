// Pure-Node PNG icon generator — no native deps.
// Draws a glassy gradient rounded-square with a 3-bar "cashflow" mark.
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
  const typeBuf = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- drawing helpers ----
const lerp = (a, b, t) => a + (b - a) * t;
function mix(c1, c2, t) {
  return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
}
// smooth coverage for anti-aliased edges
function cover(d) {
  // d = signed distance in px, inside negative
  return Math.min(1, Math.max(0, 0.5 - d));
}
function roundRectSD(x, y, cx, cy, hw, hh, r) {
  const qx = Math.abs(x - cx) - (hw - r);
  const qy = Math.abs(y - cy) - (hh - r);
  const ax = Math.max(qx, 0);
  const ay = Math.max(qy, 0);
  return Math.min(Math.max(qx, qy), 0) + Math.sqrt(ax * ax + ay * ay) - r;
}

function render(size) {
  const buf = Buffer.alloc(size * size * 4);
  const top = [0x7c, 0x9c, 0xff]; // periwinkle
  const bot = [0xc5, 0x8b, 0xff]; // violet
  const pad = size * 0.085;
  const hw = size / 2 - pad;
  const hh = size / 2 - pad;
  const r = size * 0.24;

  // three bars
  const barW = size * 0.12;
  const gap = size * 0.075;
  const groupW = barW * 3 + gap * 2;
  const startX = size / 2 - groupW / 2;
  const baseY = size * 0.70;
  const heights = [0.20, 0.30, 0.42].map((h) => h * size);
  const bars = heights.map((h, i) => ({
    cx: startX + barW / 2 + i * (barW + gap),
    cy: baseY - h / 2,
    hw: barW / 2,
    hh: h / 2,
    r: barW * 0.38,
  }));

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const sd = roundRectSD(x + 0.5, y + 0.5, size / 2, size / 2, hw, hh, r);
      const bgA = cover(sd);
      if (bgA <= 0) {
        buf[i + 3] = 0;
        continue;
      }
      // diagonal gradient
      const t = (x / size) * 0.35 + (y / size) * 0.65;
      let col = mix(top, bot, Math.min(1, Math.max(0, t)));

      // bars in white with soft alpha
      let barA = 0;
      for (const b of bars) {
        const bsd = roundRectSD(x + 0.5, y + 0.5, b.cx, b.cy, b.hw, b.hh, b.r);
        barA = Math.max(barA, cover(bsd));
      }
      if (barA > 0) {
        col = mix(col, [255, 255, 255], barA * 0.92);
      }

      buf[i] = Math.round(col[0]);
      buf[i + 1] = Math.round(col[1]);
      buf[i + 2] = Math.round(col[2]);
      buf[i + 3] = Math.round(bgA * 255);
    }
  }
  return buf;
}

for (const size of [192, 512, 180]) {
  const rgba = render(size);
  const png = encodePNG(size, size, rgba);
  const name = size === 180 ? "apple-touch-icon.png" : `icon-${size}.png`;
  writeFileSync(join(outDir, name), png);
  console.log("wrote", name, png.length, "bytes");
}
