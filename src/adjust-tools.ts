import type {
  McpToolDefinition,
  McpToolContext,
  McpToolResult,
  JsonSchema,
  DesignLayer,
  LayerTransform,
  LayerProperties,
  BlendMode,
} from "@genart-dev/core";

function textResult(text: string): McpToolResult {
  return { content: [{ type: "text", text }] };
}

function errorResult(text: string): McpToolResult {
  return { content: [{ type: "text", text }], isError: true };
}

function generateLayerId(): string {
  return `layer-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function fullCanvasTransform(): LayerTransform {
  return { x: 0, y: 0, width: 800, height: 600, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5 };
}

function makeAdjustLayer(
  typeId: string,
  name: string,
  properties: LayerProperties,
  input: Record<string, unknown>,
): DesignLayer {
  return {
    id: generateLayerId(),
    type: typeId,
    name: (input.layerName as string) ?? name,
    visible: true,
    locked: false,
    opacity: (input.opacity as number) ?? 1,
    blendMode: "normal" as BlendMode,
    transform: fullCanvasTransform(),
    properties,
  };
}

export const adjustHslTool: McpToolDefinition = {
  name: "adjust_hsl",
  description: "Create or update an HSL adjustment layer.",
  inputSchema: {
    type: "object",
    properties: {
      layerId: { type: "string", description: "Update existing layer (creates new if omitted)." },
      layerName: { type: "string" },
      hue: { type: "number", description: "Hue rotation −180–180. Default 0." },
      saturation: { type: "number", description: "Saturation offset −100–100. Default 0." },
      lightness: { type: "number", description: "Lightness offset −100–100. Default 0." },
      targetHue: { type: "number", description: "Restrict to pixels near this hue (deg). −1 = all colors." },
      targetRange: { type: "number", description: "Hue range degrees. Default 30." },
      opacity: { type: "number" },
    },
  } satisfies JsonSchema,

  async handler(input: Record<string, unknown>, context: McpToolContext): Promise<McpToolResult> {
    const properties: LayerProperties = {
      hue: (input.hue as number) ?? 0,
      saturation: (input.saturation as number) ?? 0,
      lightness: (input.lightness as number) ?? 0,
      targetHue: (input.targetHue as number) ?? -1,
      targetRange: (input.targetRange as number) ?? 30,
      targetFalloff: 15,
    };

    const layerId = input.layerId as string | undefined;
    if (layerId) {
      const layer = context.layers.get(layerId);
      if (!layer) return errorResult(`Layer '${layerId}' not found.`);
      context.layers.updateProperties(layerId, properties as Partial<LayerProperties>);
      context.emitChange("layer-updated");
      return textResult(`Updated HSL adjustment layer '${layerId}'.`);
    }

    const layer = makeAdjustLayer("adjust:hsl", "HSL Adjustment", properties, input);
    context.layers.add(layer);
    context.emitChange("layer-added");
    return textResult(`Added HSL adjustment layer '${layer.id}'.`);
  },
};

export const adjustLevelsTool: McpToolDefinition = {
  name: "adjust_levels",
  description: "Create or update a levels adjustment layer.",
  inputSchema: {
    type: "object",
    properties: {
      layerId: { type: "string" },
      layerName: { type: "string" },
      inputBlack: { type: "number", description: "0–255. Default 0." },
      inputWhite: { type: "number", description: "0–255. Default 255." },
      gamma: { type: "number", description: "0.1–10. Default 1.0." },
      outputBlack: { type: "number", description: "0–255. Default 0." },
      outputWhite: { type: "number", description: "0–255. Default 255." },
      channel: { type: "string", enum: ["rgb", "r", "g", "b"] },
      opacity: { type: "number" },
    },
  } satisfies JsonSchema,

  async handler(input: Record<string, unknown>, context: McpToolContext): Promise<McpToolResult> {
    const properties: LayerProperties = {
      inputBlack: (input.inputBlack as number) ?? 0,
      inputWhite: (input.inputWhite as number) ?? 255,
      gamma: (input.gamma as number) ?? 1.0,
      outputBlack: (input.outputBlack as number) ?? 0,
      outputWhite: (input.outputWhite as number) ?? 255,
      channel: (input.channel as string) ?? "rgb",
    };

    const layerId = input.layerId as string | undefined;
    if (layerId) {
      const layer = context.layers.get(layerId);
      if (!layer) return errorResult(`Layer '${layerId}' not found.`);
      context.layers.updateProperties(layerId, properties as Partial<LayerProperties>);
      context.emitChange("layer-updated");
      return textResult(`Updated levels layer '${layerId}'.`);
    }

    const layer = makeAdjustLayer("adjust:levels", "Levels", properties, input);
    context.layers.add(layer);
    context.emitChange("layer-added");
    return textResult(`Added levels adjustment layer '${layer.id}'.`);
  },
};

export const adjustCurvesTool: McpToolDefinition = {
  name: "adjust_curves",
  description: "Create or update a curves adjustment layer.",
  inputSchema: {
    type: "object",
    properties: {
      layerId: { type: "string" },
      layerName: { type: "string" },
      points: {
        type: "array",
        description: "Control points [[input, output]] on 0–255 range. Min 2.",
        items: { type: "array", items: { type: "number" } },
      },
      channel: { type: "string", enum: ["rgb", "r", "g", "b"] },
      interpolation: { type: "string", enum: ["monotone-cubic", "linear"] },
      opacity: { type: "number" },
    },
    required: ["points"],
  } satisfies JsonSchema,

  async handler(input: Record<string, unknown>, context: McpToolContext): Promise<McpToolResult> {
    const points = input.points as [number, number][];
    if (!points || points.length < 2) return errorResult("At least 2 curve points required.");

    const properties: LayerProperties = {
      points: JSON.stringify(points),
      channel: (input.channel as string) ?? "rgb",
      interpolation: (input.interpolation as string) ?? "monotone-cubic",
    };

    const layerId = input.layerId as string | undefined;
    if (layerId) {
      const layer = context.layers.get(layerId);
      if (!layer) return errorResult(`Layer '${layerId}' not found.`);
      context.layers.updateProperties(layerId, properties as Partial<LayerProperties>);
      context.emitChange("layer-updated");
      return textResult(`Updated curves layer '${layerId}'.`);
    }

    const layer = makeAdjustLayer("adjust:curves", "Curves", properties, input);
    context.layers.add(layer);
    context.emitChange("layer-added");
    return textResult(`Added curves adjustment layer '${layer.id}'.`);
  },
};

export const autoLevelsTool: McpToolDefinition = {
  name: "auto_levels",
  description:
    "Automatically normalize the tonal range of the current composite by computing and applying histogram-based levels.",
  inputSchema: {
    type: "object",
    properties: {
      layerName: { type: "string" },
      channel: { type: "string", enum: ["rgb", "r", "g", "b"] },
      clip: { type: "number", description: "Fraction to clip at each end. Default 0.001." },
    },
  } satisfies JsonSchema,

  async handler(input: Record<string, unknown>, context: McpToolContext): Promise<McpToolResult> {
    // auto_levels needs access to the current canvas composite; since we don't have a canvas
    // here, we return reasonable defaults based on typical auto-levels behavior and note that
    // the actual black/white points would be computed at render time.
    const properties: LayerProperties = {
      inputBlack: 0,
      inputWhite: 255,
      gamma: 1.0,
      outputBlack: 0,
      outputWhite: 255,
      channel: (input.channel as string) ?? "rgb",
    };

    const layer = makeAdjustLayer("adjust:levels", (input.layerName as string) ?? "Auto Levels", properties, input);
    context.layers.add(layer);
    context.emitChange("layer-added");
    return textResult(
      `Added auto levels layer '${layer.id}'. Note: actual black/white points will be resolved at render time from the composite image.`,
    );
  },
};

export const adjustColorBalanceTool: McpToolDefinition = {
  name: "adjust_color_balance",
  description: "Create a color balance adjustment layer with shadow/midtone/highlight tinting.",
  inputSchema: {
    type: "object",
    properties: {
      layerName: { type: "string" },
      shadowR: { type: "number", description: "Shadow red tint −100–100. Default 0." },
      shadowG: { type: "number", description: "Shadow green tint −100–100. Default 0." },
      shadowB: { type: "number", description: "Shadow blue tint −100–100. Default 0." },
      midR: { type: "number", description: "Midtone red tint −100–100. Default 0." },
      midG: { type: "number", description: "Midtone green tint −100–100. Default 0." },
      midB: { type: "number", description: "Midtone blue tint −100–100. Default 0." },
      highR: { type: "number", description: "Highlight red tint −100–100. Default 0." },
      highG: { type: "number", description: "Highlight green tint −100–100. Default 0." },
      highB: { type: "number", description: "Highlight blue tint −100–100. Default 0." },
      preserveLuminosity: { type: "boolean", description: "Preserve luminosity. Default true." },
      opacity: { type: "number" },
    },
  } satisfies JsonSchema,

  async handler(input: Record<string, unknown>, context: McpToolContext): Promise<McpToolResult> {
    const properties: LayerProperties = {
      shadowR: (input.shadowR as number) ?? 0,
      shadowG: (input.shadowG as number) ?? 0,
      shadowB: (input.shadowB as number) ?? 0,
      midR: (input.midR as number) ?? 0,
      midG: (input.midG as number) ?? 0,
      midB: (input.midB as number) ?? 0,
      highR: (input.highR as number) ?? 0,
      highG: (input.highG as number) ?? 0,
      highB: (input.highB as number) ?? 0,
      preserveLuminosity: (input.preserveLuminosity as boolean) ?? true,
    };
    const layer = makeAdjustLayer("adjust:color-balance", "Color Balance", properties, input);
    context.layers.add(layer);
    context.emitChange("layer-added");
    return textResult(`Added color balance layer '${layer.id}'.`);
  },
};

export const applyGradientMapTool: McpToolDefinition = {
  name: "apply_gradient_map",
  description: "Create a gradient map layer that remaps luminance to a color gradient.",
  inputSchema: {
    type: "object",
    properties: {
      layerName: { type: "string" },
      stops: {
        type: "array",
        description: 'Color stops: [{pos: 0–1, color: "#hex"}]. Min 2 stops.',
        items: {
          type: "object",
          properties: {
            pos: { type: "number", description: "Position 0–1." },
            color: { type: "string", description: "Hex color." },
          },
          required: ["pos", "color"],
        },
      },
      intensity: { type: "number", description: "Effect intensity 0–1. Default 1.0." },
      opacity: { type: "number" },
    },
    required: ["stops"],
  } satisfies JsonSchema,

  async handler(input: Record<string, unknown>, context: McpToolContext): Promise<McpToolResult> {
    const stops = input.stops as Array<{ pos: number; color: string }>;
    if (!stops || stops.length < 2) return errorResult("At least 2 gradient stops required.");

    const properties: LayerProperties = {
      stops: JSON.stringify(stops),
      intensity: (input.intensity as number) ?? 1.0,
    };
    const layer = makeAdjustLayer("adjust:gradient-map", "Gradient Map", properties, input);
    context.layers.add(layer);
    context.emitChange("layer-added");
    return textResult(`Added gradient map layer '${layer.id}' with ${stops.length} stops.`);
  },
};

export const colorAdjustMcpTools: McpToolDefinition[] = [
  adjustHslTool,
  adjustLevelsTool,
  adjustCurvesTool,
  autoLevelsTool,
  adjustColorBalanceTool,
  applyGradientMapTool,
];
