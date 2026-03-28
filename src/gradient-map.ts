import type {
  LayerTypeDefinition,
  LayerPropertySchema,
  LayerProperties,
  LayerBounds,
  RenderResources,
  ValidationError,
} from "@genart-dev/core";

const GRADIENT_MAP_PROPERTIES: LayerPropertySchema[] = [
  {
    key: "stops",
    label: "Color Stops",
    type: "string",
    default: '[{"pos":0,"color":"#000000"},{"pos":1,"color":"#ffffff"}]',
    group: "gradient",
  },
  {
    key: "intensity",
    label: "Intensity",
    type: "number",
    default: 1.0,
    min: 0,
    max: 1,
    step: 0.01,
    group: "gradient",
  },
];

interface GradientStop {
  pos: number;
  color: string;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const n = parseInt(clean, 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function sampleGradient(stops: GradientStop[], t: number): [number, number, number] {
  if (stops.length === 0) return [0, 0, 0];
  if (stops.length === 1 || t <= stops[0]!.pos) return hexToRgb(stops[0]!.color);
  if (t >= stops[stops.length - 1]!.pos) return hexToRgb(stops[stops.length - 1]!.color);

  // Find surrounding stops
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i]!;
    const b = stops[i + 1]!;
    if (t >= a.pos && t <= b.pos) {
      const segT = (b.pos - a.pos) > 0 ? (t - a.pos) / (b.pos - a.pos) : 0;
      const ca = hexToRgb(a.color);
      const cb = hexToRgb(b.color);
      return [
        Math.round(lerp(ca[0], cb[0], segT)),
        Math.round(lerp(ca[1], cb[1], segT)),
        Math.round(lerp(ca[2], cb[2], segT)),
      ];
    }
  }
  return hexToRgb(stops[stops.length - 1]!.color);
}

export const gradientMapLayerType: LayerTypeDefinition = {
  typeId: "adjust:gradient-map",
  displayName: "Gradient Map",
  icon: "gradient-map",
  category: "filter",
  properties: GRADIENT_MAP_PROPERTIES,
  propertyEditorId: "adjust:gradient-map-editor",

  createDefault(): LayerProperties {
    const props: LayerProperties = {};
    for (const schema of GRADIENT_MAP_PROPERTIES) {
      props[schema.key] = schema.default;
    }
    return props;
  },

  render(
    properties: LayerProperties,
    ctx: CanvasRenderingContext2D,
    bounds: LayerBounds,
    _resources: RenderResources,
  ): void {
    const stopsJson = (properties.stops as string) ?? '[]';
    const intensity = (properties.intensity as number) ?? 1.0;

    if (intensity <= 0) return;

    const w = Math.ceil(bounds.width);
    const h = Math.ceil(bounds.height);
    if (w <= 0 || h <= 0) return;

    let stops: GradientStop[];
    try {
      stops = JSON.parse(stopsJson);
    } catch {
      return; // Invalid JSON, skip
    }
    if (!Array.isArray(stops) || stops.length === 0) return;

    // Sort by position
    stops.sort((a, b) => a.pos - b.pos);

    // Build 256-entry LUT for fast lookup
    const lut = new Uint8Array(256 * 3);
    for (let i = 0; i < 256; i++) {
      const [r, g, b] = sampleGradient(stops, i / 255);
      lut[i * 3] = r;
      lut[i * 3 + 1] = g;
      lut[i * 3 + 2] = b;
    }

    const imageData = ctx.getImageData(bounds.x, bounds.y, w, h);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      // Compute luminance
      const lum = Math.round(0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!);
      const li = Math.max(0, Math.min(255, lum));

      const mr = lut[li * 3]!;
      const mg = lut[li * 3 + 1]!;
      const mb = lut[li * 3 + 2]!;

      data[i]     = Math.round(lerp(data[i]!, mr, intensity));
      data[i + 1] = Math.round(lerp(data[i + 1]!, mg, intensity));
      data[i + 2] = Math.round(lerp(data[i + 2]!, mb, intensity));
    }

    ctx.putImageData(imageData, bounds.x, bounds.y);
  },

  validate(properties: LayerProperties): ValidationError[] | null {
    const stops = properties.stops as string;
    if (typeof stops === "string") {
      try {
        const parsed = JSON.parse(stops);
        if (!Array.isArray(parsed)) {
          return [{ property: "stops", message: "Stops must be a JSON array" }];
        }
      } catch {
        return [{ property: "stops", message: "Stops must be valid JSON" }];
      }
    }
    return null;
  },
};
