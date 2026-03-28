import type {
  LayerTypeDefinition,
  LayerPropertySchema,
  LayerProperties,
  LayerBounds,
  RenderResources,
  ValidationError,
} from "@genart-dev/core";

const COLOR_BALANCE_PROPERTIES: LayerPropertySchema[] = [
  { key: "shadowR", label: "Shadow Red", type: "number", default: 0, min: -100, max: 100, step: 1, group: "shadows" },
  { key: "shadowG", label: "Shadow Green", type: "number", default: 0, min: -100, max: 100, step: 1, group: "shadows" },
  { key: "shadowB", label: "Shadow Blue", type: "number", default: 0, min: -100, max: 100, step: 1, group: "shadows" },
  { key: "midR", label: "Midtone Red", type: "number", default: 0, min: -100, max: 100, step: 1, group: "midtones" },
  { key: "midG", label: "Midtone Green", type: "number", default: 0, min: -100, max: 100, step: 1, group: "midtones" },
  { key: "midB", label: "Midtone Blue", type: "number", default: 0, min: -100, max: 100, step: 1, group: "midtones" },
  { key: "highR", label: "Highlight Red", type: "number", default: 0, min: -100, max: 100, step: 1, group: "highlights" },
  { key: "highG", label: "Highlight Green", type: "number", default: 0, min: -100, max: 100, step: 1, group: "highlights" },
  { key: "highB", label: "Highlight Blue", type: "number", default: 0, min: -100, max: 100, step: 1, group: "highlights" },
  { key: "preserveLuminosity", label: "Preserve Luminosity", type: "boolean", default: true, group: "options" },
];

export const colorBalanceLayerType: LayerTypeDefinition = {
  typeId: "adjust:color-balance",
  displayName: "Color Balance",
  icon: "color-balance",
  category: "filter",
  properties: COLOR_BALANCE_PROPERTIES,
  propertyEditorId: "adjust:color-balance-editor",

  createDefault(): LayerProperties {
    const props: LayerProperties = {};
    for (const schema of COLOR_BALANCE_PROPERTIES) {
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
    const sr = (properties.shadowR as number) ?? 0;
    const sg = (properties.shadowG as number) ?? 0;
    const sb = (properties.shadowB as number) ?? 0;
    const mr = (properties.midR as number) ?? 0;
    const mg = (properties.midG as number) ?? 0;
    const mb = (properties.midB as number) ?? 0;
    const hr = (properties.highR as number) ?? 0;
    const hg = (properties.highG as number) ?? 0;
    const hb = (properties.highB as number) ?? 0;
    const preserveLum = (properties.preserveLuminosity as boolean) ?? true;

    // Skip if all adjustments are zero
    if (sr === 0 && sg === 0 && sb === 0 && mr === 0 && mg === 0 && mb === 0 && hr === 0 && hg === 0 && hb === 0) return;

    const w = Math.ceil(bounds.width);
    const h = Math.ceil(bounds.height);
    if (w <= 0 || h <= 0) return;

    const imageData = ctx.getImageData(bounds.x, bounds.y, w, h);
    const data = imageData.data;

    // Scale factors: -100..100 → -0.5..0.5 per channel shift
    const scale = 1.275; // ~255/2 scaled to 0-1 range

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]! / 255;
      const g = data[i + 1]! / 255;
      const b = data[i + 2]! / 255;

      const lum = 0.299 * r + 0.587 * g + 0.114 * b;

      // Shadow weight peaks at dark values, midtone at 0.5, highlight at bright values
      const shadowW = 1 - smoothstep(0, 0.5, lum);
      const highW = smoothstep(0.5, 1, lum);
      const midW = 1 - shadowW - highW;

      // Apply tint per tonal range
      let nr = r + (sr * shadowW + mr * midW + hr * highW) / (100 * scale);
      let ng = g + (sg * shadowW + mg * midW + hg * highW) / (100 * scale);
      let nb = b + (sb * shadowW + mb * midW + hb * highW) / (100 * scale);

      if (preserveLum) {
        const newLum = 0.299 * nr + 0.587 * ng + 0.114 * nb;
        if (newLum > 0) {
          const ratio = lum / newLum;
          nr *= ratio;
          ng *= ratio;
          nb *= ratio;
        }
      }

      data[i]     = Math.max(0, Math.min(255, Math.round(nr * 255)));
      data[i + 1] = Math.max(0, Math.min(255, Math.round(ng * 255)));
      data[i + 2] = Math.max(0, Math.min(255, Math.round(nb * 255)));
    }

    ctx.putImageData(imageData, bounds.x, bounds.y);
  },

  validate(_properties: LayerProperties): ValidationError[] | null {
    return null;
  },
};

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
