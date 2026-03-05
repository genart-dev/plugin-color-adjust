import type {
  LayerTypeDefinition,
  LayerPropertySchema,
  LayerProperties,
  LayerBounds,
  RenderResources,
} from "@genart-dev/core";
import { buildLevelsLut, applyLutToChannel, applyLutToRgb } from "./lut.js";

const LEVELS_PROPERTIES: LayerPropertySchema[] = [
  { key: "inputBlack", label: "Input Black", type: "number", default: 0, min: 0, max: 255, step: 1, group: "input" },
  { key: "inputWhite", label: "Input White", type: "number", default: 255, min: 0, max: 255, step: 1, group: "input" },
  { key: "gamma", label: "Gamma", type: "number", default: 1.0, min: 0.1, max: 10, step: 0.01, group: "input" },
  { key: "outputBlack", label: "Output Black", type: "number", default: 0, min: 0, max: 255, step: 1, group: "output" },
  { key: "outputWhite", label: "Output White", type: "number", default: 255, min: 0, max: 255, step: 1, group: "output" },
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
];

export const levelsLayerType: LayerTypeDefinition = {
  typeId: "adjust:levels",
  displayName: "Levels",
  icon: "exposure",
  category: "adjustment",
  properties: LEVELS_PROPERTIES,
  propertyEditorId: "adjust:levels-editor",

  createDefault(): LayerProperties {
    const props: LayerProperties = {};
    for (const s of LEVELS_PROPERTIES) props[s.key] = s.default;
    return props;
  },

  render(
    properties: LayerProperties,
    ctx: CanvasRenderingContext2D,
    bounds: LayerBounds,
    _resources: RenderResources,
  ): void {
    const inputBlack = (properties.inputBlack as number) ?? 0;
    const inputWhite = (properties.inputWhite as number) ?? 255;
    const gamma = (properties.gamma as number) ?? 1.0;
    const outputBlack = (properties.outputBlack as number) ?? 0;
    const outputWhite = (properties.outputWhite as number) ?? 255;
    const channel = (properties.channel as string) ?? "rgb";

    const lut = buildLevelsLut(inputBlack, inputWhite, gamma, outputBlack, outputWhite);

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

  validate(): null { return null; },
};
