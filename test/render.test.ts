import { describe, it, expect, vi } from "vitest";
import { hslLayerType, levelsLayerType, curvesLayerType } from "../src/index.js";
import type { LayerBounds, RenderResources } from "@genart-dev/core";

const BOUNDS: LayerBounds = { x: 0, y: 0, width: 4, height: 4 };
const RESOURCES: RenderResources = {} as RenderResources;

function makePixels(w: number, h: number, fill?: (i: number) => [number, number, number, number]) {
  const data = new Uint8ClampedArray(w * h * 4);
  if (fill) {
    for (let i = 0; i < w * h; i++) {
      const [r, g, b, a] = fill(i);
      data[i * 4] = r;
      data[i * 4 + 1] = g;
      data[i * 4 + 2] = b;
      data[i * 4 + 3] = a;
    }
  }
  return data;
}

function makeMockCtx(pixels: Uint8ClampedArray) {
  const imageData = { data: pixels, width: 4, height: 4 };
  return {
    getImageData: vi.fn().mockReturnValue(imageData),
    putImageData: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}

describe("hslLayerType render", () => {
  it("reads and writes pixel data", () => {
    const pixels = makePixels(4, 4, () => [128, 128, 128, 255]);
    const ctx = makeMockCtx(pixels);
    hslLayerType.render({ hue: 0, saturation: 0, lightness: 0, targetHue: -1, targetRange: 30, targetFalloff: 15 }, ctx, BOUNDS, RESOURCES);
    expect(ctx.getImageData).toHaveBeenCalledWith(0, 0, 4, 4);
    expect(ctx.putImageData).toHaveBeenCalled();
  });

  it("shifts hue on colored pixels", () => {
    // Pure red pixel
    const pixels = makePixels(4, 4, () => [255, 0, 0, 255]);
    const ctx = makeMockCtx(pixels);
    hslLayerType.render({ hue: 120, saturation: 0, lightness: 0, targetHue: -1, targetRange: 30, targetFalloff: 15 }, ctx, BOUNDS, RESOURCES);
    // After 120° hue shift, red should become greenish
    expect(pixels[1]).toBeGreaterThan(pixels[0]!); // G > R
  });

  it("adjusts lightness", () => {
    const pixels = makePixels(4, 4, () => [128, 128, 128, 255]);
    const ctx = makeMockCtx(pixels);
    hslLayerType.render({ hue: 0, saturation: 0, lightness: 50, targetHue: -1, targetRange: 30, targetFalloff: 15 }, ctx, BOUNDS, RESOURCES);
    // Lightened — all channels should increase
    expect(pixels[0]).toBeGreaterThan(128);
  });

  it("targets specific hue range", () => {
    // Red pixel at hue 0, blue pixel at hue 240
    const pixels = makePixels(4, 4, (i) => (i < 8 ? [255, 0, 0, 255] : [0, 0, 255, 255]));
    const ctx = makeMockCtx(pixels);
    // Target hue 0 (red) with narrow range — only red pixels should shift
    hslLayerType.render({ hue: 60, saturation: 0, lightness: 0, targetHue: 0, targetRange: 30, targetFalloff: 15 }, ctx, BOUNDS, RESOURCES);
    // Blue pixels at end should be unchanged
    const lastPixelIdx = (4 * 4 - 1) * 4;
    expect(pixels[lastPixelIdx]).toBe(0);     // R still 0
    expect(pixels[lastPixelIdx + 2]).toBe(255); // B still 255
  });
});

describe("levelsLayerType render", () => {
  it("identity levels leaves pixels unchanged", () => {
    const pixels = makePixels(4, 4, () => [100, 150, 200, 255]);
    const original = new Uint8ClampedArray(pixels);
    const ctx = makeMockCtx(pixels);
    levelsLayerType.render(levelsLayerType.createDefault(), ctx, BOUNDS, RESOURCES);
    expect(pixels).toEqual(original);
  });

  it("crushing input range remaps midtones", () => {
    const pixels = makePixels(4, 4, () => [200, 200, 200, 255]);
    const ctx = makeMockCtx(pixels);
    levelsLayerType.render({ inputBlack: 100, inputWhite: 200, gamma: 1.0, outputBlack: 0, outputWhite: 255, channel: "rgb" }, ctx, BOUNDS, RESOURCES);
    // 200 is at inputWhite, so it maps to outputWhite (255)
    expect(pixels[0]).toBe(255);
  });

  it("per-channel mode only modifies that channel", () => {
    const pixels = makePixels(4, 4, () => [128, 128, 128, 255]);
    const ctx = makeMockCtx(pixels);
    levelsLayerType.render({ inputBlack: 0, inputWhite: 128, gamma: 1.0, outputBlack: 0, outputWhite: 255, channel: "r" }, ctx, BOUNDS, RESOURCES);
    // Red channel boosted (128→255), green and blue unchanged
    expect(pixels[0]).toBe(255);
    expect(pixels[1]).toBe(128);
    expect(pixels[2]).toBe(128);
  });
});

describe("curvesLayerType render", () => {
  it("identity curve leaves pixels unchanged", () => {
    const pixels = makePixels(4, 4, () => [100, 150, 200, 255]);
    const original = new Uint8ClampedArray(pixels);
    const ctx = makeMockCtx(pixels);
    curvesLayerType.render(curvesLayerType.createDefault(), ctx, BOUNDS, RESOURCES);
    // Should be close to original (monotone cubic may have tiny rounding diffs)
    for (let i = 0; i < original.length; i += 4) {
      expect(Math.abs(pixels[i]! - original[i]!)).toBeLessThanOrEqual(1);
    }
  });

  it("S-curve modifies midtones", () => {
    const pixels = makePixels(4, 4, () => [128, 128, 128, 255]);
    const ctx = makeMockCtx(pixels);
    curvesLayerType.render({ points: JSON.stringify([[0, 0], [64, 32], [192, 224], [255, 255]]), channel: "rgb", interpolation: "monotone-cubic" }, ctx, BOUNDS, RESOURCES);
    expect(ctx.putImageData).toHaveBeenCalled();
  });

  it("linear interpolation mode works", () => {
    const pixels = makePixels(4, 4, () => [128, 128, 128, 255]);
    const ctx = makeMockCtx(pixels);
    curvesLayerType.render({ points: JSON.stringify([[0, 0], [128, 200], [255, 255]]), channel: "rgb", interpolation: "linear" }, ctx, BOUNDS, RESOURCES);
    // 128 should map to 200
    expect(pixels[0]).toBe(200);
  });

  it("per-channel curves only modifies that channel", () => {
    const pixels = makePixels(4, 4, () => [128, 128, 128, 255]);
    const ctx = makeMockCtx(pixels);
    curvesLayerType.render({ points: JSON.stringify([[0, 0], [128, 255], [255, 255]]), channel: "g", interpolation: "linear" }, ctx, BOUNDS, RESOURCES);
    // Only green should change
    expect(pixels[0]).toBe(128);     // R unchanged
    expect(pixels[1]).toBe(255);     // G boosted
    expect(pixels[2]).toBe(128);     // B unchanged
  });
});
