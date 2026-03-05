/**
 * LUT (Lookup Table) utilities for pixel-level color transformations.
 * All adjustments precompute a 256-entry LUT and apply it per pixel.
 */

export type LUT = Uint8Array; // 256 entries, index = input value (0–255)

/** Build a levels LUT. */
export function buildLevelsLut(
  inputBlack: number,
  inputWhite: number,
  gamma: number,
  outputBlack: number,
  outputWhite: number,
): LUT {
  const lut = new Uint8Array(256);
  const range = inputWhite - inputBlack;
  const outRange = outputWhite - outputBlack;
  for (let i = 0; i < 256; i++) {
    const clamped = Math.max(inputBlack, Math.min(inputWhite, i));
    const normalized = range === 0 ? 0 : (clamped - inputBlack) / range;
    const gammaAdjusted = Math.pow(normalized, 1 / gamma);
    lut[i] = Math.round(outputBlack + outRange * gammaAdjusted);
  }
  return lut;
}

/** Apply a LUT to a single channel across an ImageData pixel array. */
export function applyLutToChannel(
  data: Uint8ClampedArray,
  lut: LUT,
  channelOffset: number, // 0=R, 1=G, 2=B
): void {
  for (let i = channelOffset; i < data.length; i += 4) {
    data[i] = lut[data[i]!]!;
  }
}

/** Apply a LUT to all RGB channels (not alpha). */
export function applyLutToRgb(data: Uint8ClampedArray, lut: LUT): void {
  for (let i = 0; i < data.length; i += 4) {
    data[i] = lut[data[i]!]!;
    data[i + 1] = lut[data[i + 1]!]!;
    data[i + 2] = lut[data[i + 2]!]!;
  }
}

/**
 * Monotone cubic (Fritsch-Carlson) interpolation through control points.
 * Returns a 256-entry LUT sampled from the spline.
 */
export function buildCurvesLut(points: [number, number][]): LUT {
  if (points.length < 2) {
    const lut = new Uint8Array(256);
    for (let i = 0; i < 256; i++) lut[i] = i;
    return lut;
  }

  // Sort by x
  const sorted = [...points].sort((a, b) => a[0] - b[0]);
  const n = sorted.length;
  const xs = sorted.map((p) => p[0]);
  const ys = sorted.map((p) => p[1]);

  // Compute slopes between points
  const deltas: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    deltas.push((ys[i + 1]! - ys[i]!) / (xs[i + 1]! - xs[i]!));
  }

  // Initialize tangents
  const ms: number[] = new Array(n).fill(0);
  if (n === 2) {
    ms[0] = ms[1] = deltas[0]!;
  } else {
    ms[0] = deltas[0]!;
    ms[n - 1] = deltas[n - 2]!;
    for (let i = 1; i < n - 1; i++) {
      if (deltas[i - 1]! * deltas[i]! <= 0) {
        ms[i] = 0;
      } else {
        ms[i] = (deltas[i - 1]! + deltas[i]!) / 2;
      }
    }
  }

  // Monotonicity adjustment (Fritsch-Carlson)
  for (let i = 0; i < n - 1; i++) {
    if (Math.abs(deltas[i]!) < 1e-10) {
      ms[i] = ms[i + 1] = 0;
    } else {
      const alpha = ms[i]! / deltas[i]!;
      const beta = ms[i + 1]! / deltas[i]!;
      const h = Math.sqrt(alpha * alpha + beta * beta);
      if (h > 3) {
        ms[i] = (3 / h) * alpha * deltas[i]!;
        ms[i + 1] = (3 / h) * beta * deltas[i]!;
      }
    }
  }

  function interpolate(x: number): number {
    // Clamp to domain
    if (x <= xs[0]!) return ys[0]!;
    if (x >= xs[n - 1]!) return ys[n - 1]!;

    // Find segment
    let lo = 0;
    let hi = n - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (xs[mid]! <= x) lo = mid;
      else hi = mid;
    }

    const h = xs[hi]! - xs[lo]!;
    const t = (x - xs[lo]!) / h;
    const t2 = t * t;
    const t3 = t2 * t;

    return (
      (2 * t3 - 3 * t2 + 1) * ys[lo]! +
      (t3 - 2 * t2 + t) * h * ms[lo]! +
      (-2 * t3 + 3 * t2) * ys[hi]! +
      (t3 - t2) * h * ms[hi]!
    );
  }

  const lut = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    lut[i] = Math.max(0, Math.min(255, Math.round(interpolate(i))));
  }
  return lut;
}

/** Compute histogram from ImageData. */
export interface Histogram {
  r: Uint32Array;
  g: Uint32Array;
  b: Uint32Array;
  rgb: Uint32Array;
  blackPoint: number;
  whitePoint: number;
}

export function computeHistogram(data: Uint8ClampedArray, totalPixels: number): Histogram {
  const r = new Uint32Array(256);
  const g = new Uint32Array(256);
  const b = new Uint32Array(256);
  const rgb = new Uint32Array(256);

  for (let i = 0; i < data.length; i += 4) {
    r[data[i]!]!++;
    g[data[i + 1]!]!++;
    b[data[i + 2]!]!++;
    const lum = Math.round(0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!);
    rgb[lum]!++;
  }

  const clipThreshold = Math.ceil(totalPixels * 0.001);
  let blackPoint = 0;
  let whitePoint = 255;
  for (let i = 0; i < 256; i++) {
    if (rgb[i]! > clipThreshold) { blackPoint = i; break; }
  }
  for (let i = 255; i >= 0; i--) {
    if (rgb[i]! > clipThreshold) { whitePoint = i; break; }
  }

  return { r, g, b, rgb, blackPoint, whitePoint };
}
