import { describe, it, expect, vi } from "vitest";
import colorAdjustPlugin, {
  hslLayerType,
  levelsLayerType,
  curvesLayerType,
  buildLevelsLut,
  buildCurvesLut,
  computeHistogram,
} from "../src/index.js";
import type { McpToolContext, DesignLayer, LayerBounds, RenderResources } from "@genart-dev/core";

const mockBounds: LayerBounds = { x: 0, y: 0, width: 100, height: 100 };
const mockResources: RenderResources = {} as RenderResources;

function makeMockCtx(pixels?: Uint8ClampedArray) {
  const defaultPixels = pixels ?? new Uint8ClampedArray(100 * 100 * 4).fill(128);
  const ctx: Partial<CanvasRenderingContext2D> = {
    getImageData: vi.fn().mockReturnValue({ data: new Uint8ClampedArray(defaultPixels), width: 100, height: 100 }),
    putImageData: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
  };
  return ctx as CanvasRenderingContext2D;
}

function makeMockContext(layers: DesignLayer[] = []) {
  const layerMap = new Map(layers.map((l) => [l.id, l]));
  return {
    layers: {
      add: vi.fn((layer: DesignLayer) => layerMap.set(layer.id, layer)),
      get: vi.fn((id: string) => layerMap.get(id)),
      updateProperties: vi.fn(),
    },
    emitChange: vi.fn(),
  } as unknown as McpToolContext;
}

describe("colorAdjustPlugin", () => {
  it("exports a valid DesignPlugin", () => {
    expect(colorAdjustPlugin.id).toBe("color-adjust");
    expect(colorAdjustPlugin.tier).toBe("free");
    expect(colorAdjustPlugin.layerTypes).toHaveLength(3);
    expect(colorAdjustPlugin.mcpTools).toHaveLength(4);
  });
});

describe("buildLevelsLut", () => {
  it("identity LUT passes values through", () => {
    const lut = buildLevelsLut(0, 255, 1.0, 0, 255);
    for (let i = 0; i < 256; i++) {
      expect(lut[i]).toBe(i);
    }
  });

  it("inputBlack=128 maps 128 to 0", () => {
    const lut = buildLevelsLut(128, 255, 1.0, 0, 255);
    expect(lut[0]).toBe(0);
    expect(lut[128]).toBe(0);
    expect(lut[255]).toBe(255);
  });

  it("outputBlack=50 maps 0 to 50", () => {
    const lut = buildLevelsLut(0, 255, 1.0, 50, 255);
    expect(lut[0]).toBe(50);
    expect(lut[255]).toBe(255);
  });

  it("gamma < 1 darkens midtones (exponent > 1)", () => {
    const lutDark = buildLevelsLut(0, 255, 0.5, 0, 255);
    const lutIdent = buildLevelsLut(0, 255, 1.0, 0, 255);
    // gamma=0.5 → exponent=2 → output = input^2, darkens midtones
    expect(lutDark[128]).toBeLessThan(lutIdent[128]!);
  });
});

describe("buildCurvesLut", () => {
  it("identity curve passes values through", () => {
    const lut = buildCurvesLut([[0, 0], [255, 255]]);
    for (let i = 0; i < 256; i += 32) {
      expect(lut[i]).toBeCloseTo(i, 1);
    }
  });

  it("S-curve boosts midtone contrast", () => {
    // S-curve: lift highlights, crush shadows
    const lut = buildCurvesLut([[0, 0], [64, 32], [192, 224], [255, 255]]);
    // Shadows should be darker (64 input → less than 64 output)
    expect(lut[64]).toBeLessThan(64);
    // Highlights should be lighter (192 input → more than 192 output)
    expect(lut[192]).toBeGreaterThan(192);
  });
});

describe("computeHistogram", () => {
  it("correctly counts pixel values", () => {
    const data = new Uint8ClampedArray(4 * 4); // 4 pixels
    // Pixel 0: (255, 0, 0)
    data[0] = 255; data[1] = 0; data[2] = 0; data[3] = 255;
    // Pixel 1: (0, 128, 0)
    data[4] = 0; data[5] = 128; data[6] = 0; data[7] = 255;
    // Pixel 2: (0, 0, 64)
    data[8] = 0; data[9] = 0; data[10] = 64; data[11] = 255;
    // Pixel 3: (200, 200, 200)
    data[12] = 200; data[13] = 200; data[14] = 200; data[15] = 255;

    const hist = computeHistogram(data, 4);
    expect(hist.r[255]).toBe(1);
    expect(hist.g[128]).toBe(1);
    expect(hist.b[64]).toBe(1);
    expect(hist.blackPoint).toBeGreaterThanOrEqual(0);
    expect(hist.whitePoint).toBeLessThanOrEqual(255);
  });
});

describe("hslLayerType", () => {
  it("createDefault has all-zero adjustments", () => {
    const props = hslLayerType.createDefault();
    expect(props.hue).toBe(0);
    expect(props.saturation).toBe(0);
    expect(props.lightness).toBe(0);
  });

  it("renders by calling getImageData + putImageData", () => {
    const ctx = makeMockCtx();
    hslLayerType.render(hslLayerType.createDefault(), ctx, mockBounds, mockResources);
    expect(ctx.getImageData).toHaveBeenCalled();
    expect(ctx.putImageData).toHaveBeenCalled();
  });
});

describe("levelsLayerType", () => {
  it("createDefault is identity levels", () => {
    const props = levelsLayerType.createDefault();
    expect(props.inputBlack).toBe(0);
    expect(props.inputWhite).toBe(255);
    expect(props.gamma).toBe(1.0);
  });

  it("renders via LUT", () => {
    const ctx = makeMockCtx();
    levelsLayerType.render(levelsLayerType.createDefault(), ctx, mockBounds, mockResources);
    expect(ctx.getImageData).toHaveBeenCalled();
    expect(ctx.putImageData).toHaveBeenCalled();
  });
});

describe("curvesLayerType", () => {
  it("createDefault is identity curve", () => {
    const props = curvesLayerType.createDefault();
    const points = JSON.parse(props.points as string);
    expect(points).toHaveLength(2);
  });

  it("validate rejects single point", () => {
    const errors = curvesLayerType.validate!({ ...curvesLayerType.createDefault(), points: JSON.stringify([[0, 0]]) });
    expect(errors).not.toBeNull();
  });

  it("validate accepts 2 points", () => {
    const errors = curvesLayerType.validate!(curvesLayerType.createDefault());
    expect(errors).toBeNull();
  });
});

describe("adjust_hsl tool", () => {
  it("creates HSL layer", async () => {
    const context = makeMockContext();
    const tool = colorAdjustPlugin.mcpTools.find((t) => t.name === "adjust_hsl")!;
    const result = await tool.handler({ hue: 30, saturation: 20 }, context);
    expect(context.layers.add).toHaveBeenCalled();
    expect(result.isError).toBeFalsy();
  });

  it("updates existing layer by layerId", async () => {
    const existing: DesignLayer = {
      id: "layer-1", type: "adjust:hsl", name: "HSL", visible: true, locked: false,
      opacity: 1, blendMode: "normal",
      transform: { x: 0, y: 0, width: 800, height: 600, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5 },
      properties: { hue: 0, saturation: 0, lightness: 0, targetHue: -1, targetRange: 30, targetFalloff: 15 },
    };
    const context = makeMockContext([existing]);
    const tool = colorAdjustPlugin.mcpTools.find((t) => t.name === "adjust_hsl")!;
    const result = await tool.handler({ layerId: "layer-1", hue: 45 }, context);
    expect(context.layers.updateProperties).toHaveBeenCalled();
    expect(result.isError).toBeFalsy();
  });
});

describe("adjust_curves tool", () => {
  it("requires at least 2 points", async () => {
    const context = makeMockContext();
    const tool = colorAdjustPlugin.mcpTools.find((t) => t.name === "adjust_curves")!;
    const result = await tool.handler({ points: [[0, 0]] }, context);
    expect(result.isError).toBe(true);
  });

  it("creates curves layer", async () => {
    const context = makeMockContext();
    const tool = colorAdjustPlugin.mcpTools.find((t) => t.name === "adjust_curves")!;
    const result = await tool.handler({ points: [[0, 0], [128, 180], [255, 255]] }, context);
    expect(context.layers.add).toHaveBeenCalled();
    expect(result.isError).toBeFalsy();
  });
});
