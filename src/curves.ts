import type {
  LayerTypeDefinition,
  LayerPropertySchema,
  LayerProperties,
  LayerBounds,
  RenderResources,
  ValidationError,
} from "@genart-dev/core";
import { buildCurvesLut, applyLutToChannel, applyLutToRgb } from "./lut.js";

const CURVES_PROPERTIES: LayerPropertySchema[] = [
  {
    key: "points",
    label: "Curve Points",
    type: "string",
    default: JSON.stringify([[0, 0], [255, 255]]),
    group: "curve",
  },
  {
    key: "channel",
    label: "Channel",
    type: "select",
    default: "rgb",
    options: [
      { value: "rgb", label: "RGB" },
      { value: "r", label: "Red" },
      { value: "g", label: "Green" },
      { value: "b", label: "Blue" },
    ],
    group: "channel",
  },
  {
    key: "interpolation",
    label: "Interpolation",
    type: "select",
    default: "monotone-cubic",
    options: [
      { value: "monotone-cubic", label: "Smooth" },
      { value: "linear", label: "Linear" },
    ],
    group: "curve",
  },
];

export const curvesLayerType: LayerTypeDefinition = {
  typeId: "adjust:curves",
  displayName: "Curves",
  icon: "show_chart",
  category: "adjustment",
  properties: CURVES_PROPERTIES,
  propertyEditorId: "adjust:curves-editor",

  createDefault(): LayerProperties {
    const props: LayerProperties = {};
    for (const s of CURVES_PROPERTIES) props[s.key] = s.default;
    return props;
  },

  render(
    properties: LayerProperties,
    ctx: CanvasRenderingContext2D,
    bounds: LayerBounds,
    _resources: RenderResources,
  ): void {
    const points = JSON.parse((properties.points as string) ?? "[[0,0],[255,255]]") as [number, number][];
    const channel = (properties.channel as string) ?? "rgb";
    const interpolation = (properties.interpolation as string) ?? "monotone-cubic";

    let lut;
    if (interpolation === "linear") {
      // Linear piecewise LUT
      const sorted = [...points].sort((a, b) => a[0] - b[0]);
      lut = new Uint8Array(256);
      for (let i = 0; i < 256; i++) {
        let y = i;
        for (let j = 0; j < sorted.length - 1; j++) {
          const x0 = sorted[j]![0], y0 = sorted[j]![1];
          const x1 = sorted[j + 1]![0], y1 = sorted[j + 1]![1];
          if (i >= x0 && i <= x1) {
            y = x1 === x0 ? y0 : y0 + (y1 - y0) * (i - x0) / (x1 - x0);
            break;
          }
        }
        lut[i] = Math.max(0, Math.min(255, Math.round(y)));
      }
    } else {
      lut = buildCurvesLut(points);
    }

    const bx = Math.floor(bounds.x);
    const by = Math.floor(bounds.y);
    const bw = Math.ceil(bounds.width);
    const bh = Math.ceil(bounds.height);
    const imageData = ctx.getImageData(bx, by, bw, bh);

    if (channel === "rgb") {
      applyLutToRgb(imageData.data, lut);
    } else {
      const offset = channel === "r" ? 0 : channel === "g" ? 1 : 2;
      applyLutToChannel(imageData.data, lut, offset);
    }

    ctx.putImageData(imageData, bx, by);
  },

  validate(properties: LayerProperties): ValidationError[] | null {
    try {
      const points = JSON.parse(properties.points as string) as unknown[];
      if (!Array.isArray(points) || points.length < 2) {
        return [{ property: "points", message: "At least 2 control points required" }];
      }
    } catch {
      return [{ property: "points", message: "Invalid JSON for curve points" }];
    }
    return null;
  },
};
