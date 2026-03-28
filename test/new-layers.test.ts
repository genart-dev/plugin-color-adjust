import { describe, it, expect, vi } from "vitest";
import { colorBalanceLayerType } from "../src/color-balance.js";
import { gradientMapLayerType } from "../src/gradient-map.js";
import type { LayerBounds, RenderResources } from "@genart-dev/core";

const BOUNDS: LayerBounds = { x: 0, y: 0, width: 100, height: 100, rotation: 0, scaleX: 1, scaleY: 1 };
const RESOURCES: RenderResources = { getFont: () => null, getImage: () => null, theme: "dark", pixelRatio: 1 };

function createMockImageData(w: number, h: number, fill?: [number, number, number]): ImageData {
  const data = new Uint8ClampedArray(w * h * 4);
  const [r, g, b] = fill ?? [128, 128, 128];
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = 255;
  }
  return { data, width: w, height: h, colorSpace: "srgb" } as ImageData;
}

function createMockCtx(imageData?: ImageData) {
  const id = imageData ?? createMockImageData(100, 100);
  return {
    save: vi.fn(),
    restore: vi.fn(),
    getImageData: vi.fn(() => id),
    putImageData: vi.fn(),
    fillRect: vi.fn(),
    fillStyle: "",
    filter: "",
  } as unknown as CanvasRenderingContext2D;
}

// ---------------------------------------------------------------------------
// Color Balance
// ---------------------------------------------------------------------------
describe("adjust:color-balance", () => {
  it("has correct metadata", () => {
    expect(colorBalanceLayerType.typeId).toBe("adjust:color-balance");
    expect(colorBalanceLayerType.category).toBe("filter");
  });

  it("creates defaults with all zeros", () => {
    const d = colorBalanceLayerType.createDefault();
    expect(d.shadowR).toBe(0);
    expect(d.midR).toBe(0);
    expect(d.highR).toBe(0);
    expect(d.preserveLuminosity).toBe(true);
  });

  it("skips when all adjustments are zero", () => {
    const ctx = createMockCtx();
    colorBalanceLayerType.render(colorBalanceLayerType.createDefault(), ctx, BOUNDS, RESOURCES);
    expect(ctx.getImageData).not.toHaveBeenCalled();
  });

  it("renders when adjustments are non-zero", () => {
    const ctx = createMockCtx();
    colorBalanceLayerType.render(
      { ...colorBalanceLayerType.createDefault(), shadowB: 30 },
      ctx, BOUNDS, RESOURCES,
    );
    expect(ctx.getImageData).toHaveBeenCalled();
    expect(ctx.putImageData).toHaveBeenCalled();
  });

  it("adds blue tint to shadows when shadowB > 0", () => {
    // Dark pixel (30, 30, 30) — should get blue tint
    const id = createMockImageData(1, 1, [30, 30, 30]);
    const ctx = createMockCtx(id);
    colorBalanceLayerType.render(
      { ...colorBalanceLayerType.createDefault(), shadowB: 80, preserveLuminosity: false },
      ctx, { ...BOUNDS, width: 1, height: 1 }, RESOURCES,
    );
    // Blue channel should increase more than red
    expect(id.data[2]).toBeGreaterThan(id.data[0]!);
  });

  it("affects highlights when highR > 0", () => {
    // Bright pixel
    const id = createMockImageData(1, 1, [220, 220, 220]);
    const ctx = createMockCtx(id);
    colorBalanceLayerType.render(
      { ...colorBalanceLayerType.createDefault(), highR: 80, preserveLuminosity: false },
      ctx, { ...BOUNDS, width: 1, height: 1 }, RESOURCES,
    );
    // Red channel should be boosted for highlights
    expect(id.data[0]).toBeGreaterThan(220);
  });

  it("validate returns null", () => {
    expect(colorBalanceLayerType.validate({})).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Gradient Map
// ---------------------------------------------------------------------------
describe("adjust:gradient-map", () => {
  it("has correct metadata", () => {
    expect(gradientMapLayerType.typeId).toBe("adjust:gradient-map");
    expect(gradientMapLayerType.category).toBe("filter");
  });

  it("creates defaults", () => {
    const d = gradientMapLayerType.createDefault();
    expect(d.intensity).toBe(1.0);
    expect(typeof d.stops).toBe("string");
  });

  it("renders via getImageData/putImageData", () => {
    const ctx = createMockCtx();
    gradientMapLayerType.render(gradientMapLayerType.createDefault(), ctx, BOUNDS, RESOURCES);
    expect(ctx.getImageData).toHaveBeenCalled();
    expect(ctx.putImageData).toHaveBeenCalled();
  });

  it("skips at zero intensity", () => {
    const ctx = createMockCtx();
    gradientMapLayerType.render(
      { ...gradientMapLayerType.createDefault(), intensity: 0 },
      ctx, BOUNDS, RESOURCES,
    );
    expect(ctx.getImageData).not.toHaveBeenCalled();
  });

  it("maps dark pixels to first stop and light pixels to last stop", () => {
    // Dark pixel → should map to blue, bright pixel → should map to red
    const stops = JSON.stringify([
      { pos: 0, color: "#0000ff" },
      { pos: 1, color: "#ff0000" },
    ]);

    const darkId = createMockImageData(1, 1, [10, 10, 10]);
    const darkCtx = createMockCtx(darkId);
    gradientMapLayerType.render(
      { stops, intensity: 1.0 },
      darkCtx, { ...BOUNDS, width: 1, height: 1 }, RESOURCES,
    );
    // Dark → blue (high B, low R)
    expect(darkId.data[2]).toBeGreaterThan(darkId.data[0]!);

    const brightId = createMockImageData(1, 1, [240, 240, 240]);
    const brightCtx = createMockCtx(brightId);
    gradientMapLayerType.render(
      { stops, intensity: 1.0 },
      brightCtx, { ...BOUNDS, width: 1, height: 1 }, RESOURCES,
    );
    // Bright → red (high R, low B)
    expect(brightId.data[0]).toBeGreaterThan(brightId.data[2]!);
  });

  it("handles multi-stop gradient", () => {
    const stops = JSON.stringify([
      { pos: 0, color: "#000000" },
      { pos: 0.5, color: "#ff0000" },
      { pos: 1, color: "#ffffff" },
    ]);
    const ctx = createMockCtx();
    expect(() => gradientMapLayerType.render(
      { stops, intensity: 1.0 },
      ctx, BOUNDS, RESOURCES,
    )).not.toThrow();
  });

  it("validate accepts valid stops", () => {
    expect(gradientMapLayerType.validate({ stops: '[{"pos":0,"color":"#000"},{"pos":1,"color":"#fff"}]' })).toBeNull();
  });

  it("validate rejects invalid JSON", () => {
    const errors = gradientMapLayerType.validate({ stops: "not json" });
    expect(errors).not.toBeNull();
  });
});
