/**
 * Render test: Color adjustment plugin visual outputs
 * 1. HSL adjustments on a test gradient
 * 2. Levels before/after
 * 3. Curves S-curve before/after
 */
const { createCanvas } = require("canvas");
const fs = require("fs");
const path = require("path");

const {
  hslLayerType,
  levelsLayerType,
  curvesLayerType,
  buildLevelsLut,
  buildCurvesLut,
} = require("./dist/index.cjs");

const outDir = path.join(__dirname, "test-renders");
fs.mkdirSync(outDir, { recursive: true });

const resources = {};

/** Draw a rainbow gradient bar as test source */
function drawTestGradient(ctx, x, y, w, h) {
  const grad = ctx.createLinearGradient(x, y, x + w, y);
  grad.addColorStop(0, "#ff0000");
  grad.addColorStop(0.17, "#ffff00");
  grad.addColorStop(0.33, "#00ff00");
  grad.addColorStop(0.5, "#00ffff");
  grad.addColorStop(0.67, "#0000ff");
  grad.addColorStop(0.83, "#ff00ff");
  grad.addColorStop(1, "#ff0000");
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);
}

/** Draw a grayscale gradient as test source */
function drawGrayGradient(ctx, x, y, w, h) {
  const grad = ctx.createLinearGradient(x, y, x + w, y);
  grad.addColorStop(0, "#000000");
  grad.addColorStop(1, "#ffffff");
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);
}

/** Draw a photo-like gradient (landscape sim) */
function drawPhotoGradient(ctx, x, y, w, h) {
  // Vertical: dark ground → blue sky
  const grad = ctx.createLinearGradient(x, y + h, x, y);
  grad.addColorStop(0, "#3a2a1a");
  grad.addColorStop(0.3, "#6b8e5a");
  grad.addColorStop(0.5, "#7ab648");
  grad.addColorStop(0.7, "#87ceeb");
  grad.addColorStop(1, "#4a9fd8");
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);
  // Add some warm tones
  const grad2 = ctx.createLinearGradient(x, y, x + w, y);
  grad2.addColorStop(0, "rgba(255,200,100,0.3)");
  grad2.addColorStop(0.5, "rgba(255,200,100,0)");
  grad2.addColorStop(1, "rgba(100,150,255,0.2)");
  ctx.fillStyle = grad2;
  ctx.fillRect(x, y, w, h);
}

// ─── 1. HSL Adjustments ───
{
  const CW = 260, CH = 60, PAD = 4, LABEL_H = 20, LABEL_W = 120;
  const ROWS = 6;
  const W = LABEL_W + CW + PAD * 2;
  const H = ROWS * (CH + PAD) + PAD + 30;

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#1a1a2e";
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#e0e0e0";
  ctx.font = "bold 13px sans-serif";
  ctx.fillText("HSL Adjustments", PAD + 4, 20);

  const adjustments = [
    ["Original", { hue: 0, saturation: 0, lightness: 0, targetHue: -1, targetRange: 30, targetFalloff: 15 }],
    ["Hue +90°", { hue: 90, saturation: 0, lightness: 0, targetHue: -1, targetRange: 30, targetFalloff: 15 }],
    ["Hue +180°", { hue: 180, saturation: 0, lightness: 0, targetHue: -1, targetRange: 30, targetFalloff: 15 }],
    ["Saturation −60", { hue: 0, saturation: -60, lightness: 0, targetHue: -1, targetRange: 30, targetFalloff: 15 }],
    ["Lightness +30", { hue: 0, saturation: 0, lightness: 30, targetHue: -1, targetRange: 30, targetFalloff: 15 }],
    ["Target Red +120°", { hue: 120, saturation: 0, lightness: 0, targetHue: 0, targetRange: 30, targetFalloff: 15 }],
  ];

  adjustments.forEach(([label, props], row) => {
    const x = LABEL_W + PAD;
    const y = 30 + row * (CH + PAD);
    const bounds = { x, y, width: CW, height: CH };

    drawTestGradient(ctx, x, y, CW, CH);

    if (row > 0) {
      hslLayerType.render(props, ctx, bounds, resources);
    }

    ctx.fillStyle = "#b0b0b0";
    ctx.font = "11px sans-serif";
    ctx.fillText(label, PAD + 4, y + CH / 2 + 4);
  });

  fs.writeFileSync(path.join(outDir, "hsl-adjustments.png"), canvas.toBuffer("image/png"));
  console.log("Wrote hsl-adjustments.png");
}

// ─── 2. Levels ───
{
  const CW = 260, CH = 60, PAD = 4, LABEL_W = 140;
  const ROWS = 5;
  const W = LABEL_W + CW + PAD * 2;
  const H = ROWS * (CH + PAD) + PAD + 30;

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#1a1a2e";
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#e0e0e0";
  ctx.font = "bold 13px sans-serif";
  ctx.fillText("Levels Adjustments", PAD + 4, 20);

  const adjustments = [
    ["Original", levelsLayerType.createDefault()],
    ["Crush Shadows (64–255)", { inputBlack: 64, inputWhite: 255, gamma: 1.0, outputBlack: 0, outputWhite: 255, channel: "rgb" }],
    ["Crush Highlights (0–192)", { inputBlack: 0, inputWhite: 192, gamma: 1.0, outputBlack: 0, outputWhite: 255, channel: "rgb" }],
    ["Gamma 0.4 (darken)", { inputBlack: 0, inputWhite: 255, gamma: 0.4, outputBlack: 0, outputWhite: 255, channel: "rgb" }],
    ["Gamma 2.5 (brighten)", { inputBlack: 0, inputWhite: 255, gamma: 2.5, outputBlack: 0, outputWhite: 255, channel: "rgb" }],
  ];

  adjustments.forEach(([label, props], row) => {
    const x = LABEL_W + PAD;
    const y = 30 + row * (CH + PAD);
    const bounds = { x, y, width: CW, height: CH };

    drawGrayGradient(ctx, x, y, CW, CH);

    if (row > 0) {
      levelsLayerType.render(props, ctx, bounds, resources);
    }

    ctx.fillStyle = "#b0b0b0";
    ctx.font = "11px sans-serif";
    ctx.fillText(label, PAD + 4, y + CH / 2 + 4);
  });

  fs.writeFileSync(path.join(outDir, "levels-adjustments.png"), canvas.toBuffer("image/png"));
  console.log("Wrote levels-adjustments.png");
}

// ─── 3. Curves ───
{
  const CW = 260, CH = 60, PAD = 4, LABEL_W = 140;
  const ROWS = 5;
  const W = LABEL_W + CW + PAD * 2;
  const H = ROWS * (CH + PAD) + PAD + 30;

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#1a1a2e";
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#e0e0e0";
  ctx.font = "bold 13px sans-serif";
  ctx.fillText("Curves Adjustments", PAD + 4, 20);

  const adjustments = [
    ["Original", curvesLayerType.createDefault()],
    ["S-Curve (contrast)", { points: JSON.stringify([[0, 0], [64, 32], [192, 224], [255, 255]]), channel: "rgb", interpolation: "monotone-cubic" }],
    ["Inverse", { points: JSON.stringify([[0, 255], [255, 0]]), channel: "rgb", interpolation: "linear" }],
    ["Posterize", { points: JSON.stringify([[0, 0], [85, 0], [86, 128], [170, 128], [171, 255], [255, 255]]), channel: "rgb", interpolation: "linear" }],
    ["Red channel boost", { points: JSON.stringify([[0, 0], [128, 200], [255, 255]]), channel: "r", interpolation: "monotone-cubic" }],
  ];

  adjustments.forEach(([label, props], row) => {
    const x = LABEL_W + PAD;
    const y = 30 + row * (CH + PAD);
    const bounds = { x, y, width: CW, height: CH };

    drawPhotoGradient(ctx, x, y, CW, CH);

    if (row > 0) {
      curvesLayerType.render(props, ctx, bounds, resources);
    }

    ctx.fillStyle = "#b0b0b0";
    ctx.font = "11px sans-serif";
    ctx.fillText(label, PAD + 4, y + CH / 2 + 4);
  });

  fs.writeFileSync(path.join(outDir, "curves-adjustments.png"), canvas.toBuffer("image/png"));
  console.log("Wrote curves-adjustments.png");
}
