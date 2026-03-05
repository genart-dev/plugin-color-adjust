import type {
  LayerTypeDefinition,
  LayerPropertySchema,
  LayerProperties,
  LayerBounds,
  RenderResources,
} from "@genart-dev/core";

const HSL_PROPERTIES: LayerPropertySchema[] = [
  { key: "hue", label: "Hue", type: "number", default: 0, min: -180, max: 180, step: 1, group: "hsl" },
  { key: "saturation", label: "Saturation", type: "number", default: 0, min: -100, max: 100, step: 1, group: "hsl" },
  { key: "lightness", label: "Lightness", type: "number", default: 0, min: -100, max: 100, step: 1, group: "hsl" },
  { key: "targetHue", label: "Target Hue", type: "number", default: -1, min: -1, max: 360, step: 1, group: "target" },
  { key: "targetRange", label: "Target Range (deg)", type: "number", default: 30, min: 0, max: 180, step: 1, group: "target" },
  { key: "targetFalloff", label: "Target Falloff (deg)", type: "number", default: 15, min: 0, max: 90, step: 1, group: "target" },
];

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue2rgb = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [hue2rgb(h + 1 / 3), hue2rgb(h), hue2rgb(h - 1 / 3)];
}

function angleDist(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

export const hslLayerType: LayerTypeDefinition = {
  typeId: "adjust:hsl",
  displayName: "HSL Adjustment",
  icon: "color_lens",
  category: "adjustment",
  properties: HSL_PROPERTIES,
  propertyEditorId: "adjust:hsl-editor",

  createDefault(): LayerProperties {
    const props: LayerProperties = {};
    for (const s of HSL_PROPERTIES) props[s.key] = s.default;
    return props;
  },

  render(
    properties: LayerProperties,
    ctx: CanvasRenderingContext2D,
    bounds: LayerBounds,
    _resources: RenderResources,
  ): void {
    const hueDelta = (properties.hue as number) ?? 0;
    const satDelta = ((properties.saturation as number) ?? 0) / 100;
    const lightDelta = ((properties.lightness as number) ?? 0) / 100;
    const targetHue = (properties.targetHue as number) ?? -1;
    const targetRange = (properties.targetRange as number) ?? 30;
    const targetFalloff = (properties.targetFalloff as number) ?? 15;

    const bx = Math.floor(bounds.x);
    const by = Math.floor(bounds.y);
    const bw = Math.ceil(bounds.width);
    const bh = Math.ceil(bounds.height);

    const imageData = ctx.getImageData(bx, by, bw, bh);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]! / 255;
      const g = data[i + 1]! / 255;
      const b = data[i + 2]! / 255;
      let [h, s, l] = rgbToHsl(r, g, b);

      let strength = 1;
      if (targetHue >= 0) {
        const hDeg = h * 360;
        const d = angleDist(hDeg, targetHue);
        if (d > targetRange + targetFalloff) strength = 0;
        else if (d > targetRange) strength = 1 - (d - targetRange) / targetFalloff;
      }

      if (strength > 0) {
        h = ((h + (hueDelta / 360) * strength) % 1 + 1) % 1;
        s = Math.max(0, Math.min(1, s + satDelta * strength));
        l = Math.max(0, Math.min(1, l + lightDelta * strength));
      }

      const [nr, ng, nb] = hslToRgb(h, s, l);
      data[i] = Math.round(nr * 255);
      data[i + 1] = Math.round(ng * 255);
      data[i + 2] = Math.round(nb * 255);
    }

    ctx.putImageData(imageData, bx, by);
  },

  validate(): null { return null; },
};
