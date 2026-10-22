// Turns a photo of a printed table into black text on white for OCR. Pure, so it runs in the browser (canvas pixels)
// and in tests. Steps: grey; flip white-on-dark headers to dark-on-white; ink = clearly darker than its
// surroundings (copes with shadows across a phone photo); erase long straight runs, which are table lines and
// confuse Tesseract.

const ink = 0;
const paper = 255;

// Sum table so the mean of any rectangle is four lookups. Fits 32 bits up to about 4000 x 4000 pixels.
function integral(v: Uint8ClampedArray, w: number, h: number): Uint32Array {
  const s = new Uint32Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += v[y * w + x];
      s[(y + 1) * (w + 1) + x + 1] = s[y * (w + 1) + x + 1] + row;
    }
  }
  return s;
}

function localMeans(v: Uint8ClampedArray, w: number, h: number, r: number): Float32Array {
  const s = integral(v, w, h);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r);
    const y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(w, x + r + 1);
      const sum = s[y1 * (w + 1) + x1] - s[y0 * (w + 1) + x1] - s[y1 * (w + 1) + x0] + s[y0 * (w + 1) + x0];
      out[y * w + x] = sum / ((x1 - x0) * (y1 - y0));
    }
  }
  return out;
}

function median(v: Uint8ClampedArray): number {
  const counts = new Uint32Array(256);
  for (const p of v) counts[p]++;
  let seen = 0;
  for (let i = 0; i < 256; i++) if ((seen += counts[i]) >= v.length / 2) return i;
  return 255;
}

// Whitens runs of ink longer than maxRun, along rows (step 1) or columns (step w).
function eraseRuns(b: Uint8ClampedArray, lines: number, length: number, start: (i: number) => number, step: number, maxRun: number) {
  for (let i = 0; i < lines; i++) {
    const first = start(i);
    let runStart = -1;
    for (let j = 0; j <= length; j++) {
      const isInk = j < length && b[first + j * step] === ink;
      if (isInk && runStart < 0) runStart = j;
      if (!isInk && runStart >= 0) {
        if (j - runStart > maxRun) for (let k = runStart; k < j; k++) b[first + k * step] = paper;
        runStart = -1;
      }
    }
  }
}

// Angle (radians) the page is turned by. Tries small angles on a shrunk copy and keeps the one where ink lines up in
// the sharpest rows (table lines and text lines both help).
export function findSkew(b: Uint8ClampedArray, w: number, h: number): number {
  const step = Math.max(1, Math.ceil(Math.max(w, h) / 900));
  const points: [number, number][] = [];
  for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) if (b[y * w + x] === ink) points.push([x, y]);
  const bins = new Float64Array(Math.ceil(Math.hypot(w, h) / step) + 2);
  const score = (deg: number) => {
    const a = (deg * Math.PI) / 180;
    const [sin, cos] = [Math.sin(a), Math.cos(a)];
    bins.fill(0);
    for (const [x, y] of points) bins[Math.round((y * cos - x * sin) / step + w * Math.abs(sin) / step)]++;
    let s = 0;
    for (let i = 1; i < bins.length; i++) s += (bins[i] - bins[i - 1]) ** 2;
    return s;
  };
  let best = 0;
  for (let deg = -6; deg <= 6; deg += 0.25) if (score(deg) > score(best)) best = deg;
  const coarse = best;
  for (let deg = coarse - 0.25; deg <= coarse + 0.25; deg += 0.05) if (score(deg) > score(best)) best = deg;
  return (best * Math.PI) / 180;
}

// Turns the page back by angle (nearest pixel), same size, filled with blank where nothing maps.
function rotate(b: Uint8ClampedArray, w: number, h: number, angle: number, blank: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(w * h).fill(blank);
  const [sin, cos] = [Math.sin(angle), Math.cos(angle)];
  const [cx, cy] = [w / 2, h / 2];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = Math.round(cos * (x - cx) - sin * (y - cy) + cx);
      const sy = Math.round(sin * (x - cx) + cos * (y - cy) + cy);
      if (sx >= 0 && sx < w && sy >= 0 && sy < h) out[y * w + x] = b[sy * w + sx];
    }
  }
  return out;
}

// rgba: canvas ImageData pixels. Returns one byte per pixel, 0 for ink and 255 for paper, turned straight.
export function cleanImage(rgba: Uint8ClampedArray, w: number, h: number): Uint8ClampedArray {
  const grey = new Uint8ClampedArray(w * h);
  for (let i = 0; i < w * h; i++) {
    grey[i] = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2];
  }

  const r = Math.max(8, Math.round(Math.max(w, h) / 100));
  const paperLevel = median(grey);
  const before = localMeans(grey, w, h, r);
  for (let i = 0; i < grey.length; i++) if (before[i] < paperLevel * 0.45) grey[i] = 255 - grey[i];

  const toInk = (g: Uint8ClampedArray) => {
    const around = localMeans(g, w, h, r);
    const b = new Uint8ClampedArray(w * h);
    for (let i = 0; i < b.length; i++) b[i] = g[i] < around[i] * 0.8 && g[i] < paperLevel * 0.75 ? ink : paper;
    return b;
  };
  // Straighten the grey picture, not the black and white one, so table lines stay solid and get erased below.
  const skew = findSkew(toInk(grey), w, h);
  const out = Math.abs(skew) < 0.001 ? toInk(grey) : toInk(rotate(grey, w, h, skew, paperLevel));

  const maxRun = Math.round(Math.max(w, h) / 30);
  eraseRuns(out, h, w, (y) => y * w, 1, maxRun);
  eraseRuns(out, w, h, (x) => x, w, maxRun);
  return out;
}
