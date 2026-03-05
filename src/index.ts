import type { DesignPlugin, PluginContext } from "@genart-dev/core";
import { hslLayerType } from "./hsl.js";
import { levelsLayerType } from "./levels.js";
import { curvesLayerType } from "./curves.js";
import { colorAdjustMcpTools } from "./adjust-tools.js";

const colorAdjustPlugin: DesignPlugin = {
  id: "color-adjust",
  name: "Color Adjustment",
  version: "0.1.0",
  tier: "free",
  description: "Non-destructive color adjustment layers: HSL, Levels, Curves.",

  layerTypes: [hslLayerType, levelsLayerType, curvesLayerType],
  tools: [],
  exportHandlers: [],
  mcpTools: colorAdjustMcpTools,

  async initialize(_context: PluginContext): Promise<void> {},
  dispose(): void {},
};

export default colorAdjustPlugin;
export { hslLayerType } from "./hsl.js";
export { levelsLayerType } from "./levels.js";
export { curvesLayerType } from "./curves.js";
export { colorAdjustMcpTools } from "./adjust-tools.js";
export { buildLevelsLut, buildCurvesLut, computeHistogram } from "./lut.js";
export type { Histogram } from "./lut.js";
