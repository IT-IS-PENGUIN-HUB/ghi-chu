/**
 * Generates the PWA / apple-touch icons into client/public.
 *
 * Hand-rolled PNG encoder so icon generation needs no dependency and can run in
 * CI. Run with: node scripts/gen-icons.mjs
 */
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const OUT_DIR = path.resolve(import.meta.dirname, "..", "client", "public");

const BG = [5, 150, 105]; // emerald-600, matches --primary in index.css
const BG_DARK = [4, 120, 87]; // emerald-700, for the subtle vertical ramp
const FG = [255, 255, 255];

// ---------------------------------------------------------------- geometry --

/** Shortest distance from p to segment ab, all in normalised [0,1] space. */
function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

/** Signed-ish coverage test for a rounded square inset by `inset`. */
function insideRoundedSquare(x, y, inset, radius) {
  const lo = inset;
  const hi = 1 - inset;
  if (x < lo || x > hi || y < lo || y > hi) return false;
  // Distance to the nearest corner circle centre, clamped into the inner rect.
  const cx = Math.min(Math.max(x, lo + radius), hi - radius);
  const cy = Math.min(Math.max(y, lo + radius), hi - radius);
  return Math.hypot(x - cx, y - cy) <= radius;
}

/** The checkmark stroke, in normalised coordinates. */
function insideCheck(x, y, scale) {
  // Centred around (0.5, 0.5) then scaled so maskable icons keep it in the
  // safe zone (the outer 10% of a maskable icon can be cropped away).
  const nx = (x - 0.5) / scale + 0.5;
  const ny = (y - 0.5) / scale + 0.5;
  const half = 0.058;
  return (
    distToSegment(nx, ny, 0.27, 0.53, 0.43, 0.69) <= half ||
    distToSegment(nx, ny, 0.43, 0.69, 0.75, 0.33) <= half
  );
}

// ------------------------------------------------------------------ raster --

const SS = 4; // supersampling factor per axis

function render(size, { maskable = false } = {}) {
  const rgba = Buffer.alloc(size * size * 4);
  const inset = maskable ? 0 : 0.045;
  const radius = 0.235;
  const checkScale = maskable ? 0.72 : 1;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let bgHits = 0;
      let fgHits = 0;

      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const nx = (x + (sx + 0.5) / SS) / size;
          const ny = (y + (sy + 0.5) / SS) / size;
          const inBg = maskable || insideRoundedSquare(nx, ny, inset, radius);
          if (!inBg) continue;
          bgHits++;
          if (insideCheck(nx, ny, checkScale)) fgHits++;
        }
      }

      const total = SS * SS;
      const i = (y * size + x) * 4;
      if (bgHits === 0) {
        rgba[i] = rgba[i + 1] = rgba[i + 2] = rgba[i + 3] = 0;
        continue;
      }

      // Vertical ramp from emerald-600 to emerald-700.
      const t = y / (size - 1);
      const base = [0, 1, 2].map((c) => Math.round(BG[c] * (1 - t) + BG_DARK[c] * t));
      const fgAlpha = fgHits / total;
      const bgAlpha = bgHits / total;

      for (let c = 0; c < 3; c++) {
        rgba[i + c] = Math.round(base[c] * (1 - fgAlpha / bgAlpha) + FG[c] * (fgAlpha / bgAlpha));
      }
      rgba[i + 3] = Math.round(bgAlpha * 255);
    }
  }
  return rgba;
}

// -------------------------------------------------------------- png encode --

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([len, typeAndData, crc]);
}

function encodePng(rgba, size) {
  // Filter type 0 (None) prefixed to every scanline.
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// -------------------------------------------------------------------- main --

const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect x="4.5" y="4.5" width="91" height="91" rx="23.5" fill="#059669"/>
  <path d="M27 53 L43 69 L75 33" fill="none" stroke="#fff" stroke-width="11.6"
        stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`;

mkdirSync(OUT_DIR, { recursive: true });

const targets = [
  ["apple-touch-icon.png", 180, {}],
  ["icon-192.png", 192, {}],
  ["icon-512.png", 512, {}],
  ["icon-512-maskable.png", 512, { maskable: true }],
];

for (const [name, size, opts] of targets) {
  writeFileSync(path.join(OUT_DIR, name), encodePng(render(size, opts), size));
  console.log(`wrote ${name} (${size}x${size})`);
}

writeFileSync(path.join(OUT_DIR, "favicon.svg"), FAVICON_SVG);
console.log("wrote favicon.svg");
