import type { FilterSettings } from "@/tools/editor/types";

export const FILTER_ADJUSTMENTS = [
  "exposure", "brighten", "darken", "deepen", "contrast", "lightenShadows", "darkenHighlights",
  "saturation", "vibrance", "temperature", "tint", "sharpen", "clarity", "noiseReduction",
  "vignette", "grain", "blur"
] as const;

export const DEFAULT_FILTER_SETTINGS: FilterSettings = {
  preset: "original",
  negative: false,
  autoColor: 0,
  autoLevels: 0,
  autoContrast: 0,
  hdr: false,
  magicColor: false,
  adjustments: {
    exposure: 0, brighten: 0, darken: 0, deepen: 0, contrast: 0,
    lightenShadows: 0, darkenHighlights: 0, saturation: 0, vibrance: 0,
    temperature: 0, tint: 0, sharpen: 0, clarity: 0, noiseReduction: 0,
    vignette: 0, grain: 0, blur: 0
  },
  maskStrokes: [],
  brushSize: 36,
  brushFeather: 28,
  eraseMode: false
};

const levelAmount = (level: number) => [0, 0.18, 0.38, 0.62][level] ?? 0;
const clamp = (value: number, min = 0, max = 255) => Math.min(max, Math.max(min, value));

function boxBlur(input: Uint8ClampedArray, width: number, height: number) {
  const output = new Uint8ClampedArray(input.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0, count = 0;
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const nx = Math.min(width - 1, Math.max(0, x + ox));
          const ny = Math.min(height - 1, Math.max(0, y + oy));
          const index = (ny * width + nx) * 4;
          r += input[index]; g += input[index + 1]; b += input[index + 2]; count++;
        }
      }
      const index = (y * width + x) * 4;
      output[index] = r / count; output[index + 1] = g / count; output[index + 2] = b / count; output[index + 3] = input[index + 3];
    }
  }
  return output;
}

function findLevels(data: Uint8ClampedArray, channel: number) {
  let min = 255, max = 0;
  for (let index = channel; index < data.length; index += 4) {
    const value = data[index];
    if (value < min) min = value;
    if (value > max) max = value;
  }
  return { min, range: Math.max(1, max - min) };
}

export function applyFilterSettings(source: ImageData, settings: FilterSettings, mask?: Uint8ClampedArray) {
  const { width, height, data: original } = source;
  const result = new Uint8ClampedArray(original);
  const adjustments = settings.adjustments;
  const levelStrength = levelAmount(settings.autoLevels);
  const autoContrast = levelAmount(settings.autoContrast);
  const autoColor = levelAmount(settings.autoColor);
  const levels = settings.autoLevels ? [findLevels(original, 0), findLevels(original, 1), findLevels(original, 2)] : null;
  let minLuma = 255, maxLuma = 0;
  if (settings.autoContrast) {
    for (let i = 0; i < original.length; i += 4) {
      const luma = original[i] * 0.2126 + original[i + 1] * 0.7152 + original[i + 2] * 0.0722;
      minLuma = Math.min(minLuma, luma); maxLuma = Math.max(maxLuma, luma);
    }
  }

  const local = adjustments.sharpen || adjustments.clarity || adjustments.noiseReduction || adjustments.blur
    ? boxBlur(original, width, height)
    : null;
  const exposure = Math.pow(2, adjustments.exposure / 50);
  const contrast = 1 + (adjustments.contrast + (settings.hdr ? 12 : 0) + autoContrast * 28) / 100;
  const saturation = 1 + (adjustments.saturation + adjustments.vibrance * 0.5 + (settings.magicColor ? 18 : 0) + autoColor * 25) / 100;
  const temperature = adjustments.temperature * 0.38;
  const tint = adjustments.tint * 0.3;
  const noiseBlend = adjustments.noiseReduction / 100 * 0.7;
  const sharpenAmount = adjustments.sharpen / 100 * 1.5 + adjustments.clarity / 100 * 0.65;
  const blurAmount = adjustments.blur / 100 * 0.8;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const alpha = original[i + 3];
      let r = original[i], g = original[i + 1], b = original[i + 2];
      const startingR = r, startingG = g, startingB = b;

      if (levels) {
        r = ((r - levels[0].min) / levels[0].range) * 255 * levelStrength + r * (1 - levelStrength);
        g = ((g - levels[1].min) / levels[1].range) * 255 * levelStrength + g * (1 - levelStrength);
        b = ((b - levels[2].min) / levels[2].range) * 255 * levelStrength + b * (1 - levelStrength);
      }

      if (settings.preset === "bw") {
        const gray = r * 0.299 + g * 0.587 + b * 0.114;
        r = gray; g = gray; b = gray;
      } else if (settings.preset === "sepia") {
        const oldR = r, oldG = g, oldB = b;
        r = oldR * 0.393 + oldG * 0.769 + oldB * 0.189;
        g = oldR * 0.349 + oldG * 0.686 + oldB * 0.168;
        b = oldR * 0.272 + oldG * 0.534 + oldB * 0.131;
      } else if (settings.preset === "cool") {
        b += 14; r -= 5;
      } else if (settings.preset === "warm") {
        r += 14; b -= 7;
      }

      if (settings.negative) { r = 255 - r; g = 255 - g; b = 255 - b; }
      r *= exposure; g *= exposure; b *= exposure;
      const bright = adjustments.brighten * 1.25 - adjustments.darken * 1.25 - adjustments.deepen * (1 - (r + g + b) / 765) * 0.8;
      r = (r - 128) * contrast + 128 + bright;
      g = (g - 128) * contrast + 128 + bright;
      b = (b - 128) * contrast + 128 + bright;

      if (settings.autoContrast) {
        const luma = startingR * 0.2126 + startingG * 0.7152 + startingB * 0.0722;
        const mapped = ((luma - minLuma) / Math.max(1, maxLuma - minLuma) - 0.5) * 255 * autoContrast + luma * (1 - autoContrast);
        const delta = mapped - luma;
        r += delta; g += delta; b += delta;
      }

      const luma = r * 0.2126 + g * 0.7152 + b * 0.0722;
      const shadowFactor = 1 - luma / 255;
      const highlightFactor = luma / 255;
      const shadowLift = adjustments.lightenShadows * 0.55 * shadowFactor;
      const highlightDrop = adjustments.darkenHighlights * 0.55 * highlightFactor;
      r += shadowLift - highlightDrop; g += shadowLift - highlightDrop; b += shadowLift - highlightDrop;

      const gray = r * 0.299 + g * 0.587 + b * 0.114;
      r = gray + (r - gray) * saturation;
      g = gray + (g - gray) * saturation;
      b = gray + (b - gray) * saturation;
      r += temperature + tint; g += tint * -1.4; b -= temperature - tint;

      if (local) {
        const blurR = local[i], blurG = local[i + 1], blurB = local[i + 2];
        r = (r * (1 - noiseBlend)) + (blurR * noiseBlend) + (startingR - blurR) * sharpenAmount;
        g = (g * (1 - noiseBlend)) + (blurG * noiseBlend) + (startingG - blurG) * sharpenAmount;
        b = (b * (1 - noiseBlend)) + (blurB * noiseBlend) + (startingB - blurB) * sharpenAmount;
        r = r * (1 - blurAmount) + blurR * blurAmount;
        g = g * (1 - blurAmount) + blurG * blurAmount;
        b = b * (1 - blurAmount) + blurB * blurAmount;
      }

      const nx = (x / Math.max(1, width - 1)) * 2 - 1;
      const ny = (y / Math.max(1, height - 1)) * 2 - 1;
      const vignette = Math.max(0, (nx * nx + ny * ny - 0.2) * adjustments.vignette * 0.003);
      r *= 1 - vignette; g *= 1 - vignette; b *= 1 - vignette;
      if (adjustments.grain) {
        const noise = (Math.sin((x + 1) * 12.9898 + (y + 1) * 78.233) * 43758.5453 % 1) * adjustments.grain * 0.5;
        r += noise; g += noise; b += noise;
      }

      const maskAlpha = mask ? mask[i + 3] / 255 : 1;
      result[i] = clamp(startingR * (1 - maskAlpha) + r * maskAlpha);
      result[i + 1] = clamp(startingG * (1 - maskAlpha) + g * maskAlpha);
      result[i + 2] = clamp(startingB * (1 - maskAlpha) + b * maskAlpha);
      result[i + 3] = alpha;
    }
  }
  return new ImageData(result, width, height);
}

export function getFilterHistogram(imageData: ImageData, buckets = 64) {
  const channels = [new Array<number>(buckets).fill(0), new Array<number>(buckets).fill(0), new Array<number>(buckets).fill(0)];
  for (let i = 0; i < imageData.data.length; i += 4) {
    channels[0][Math.min(buckets - 1, Math.floor(imageData.data[i] / 256 * buckets))]++;
    channels[1][Math.min(buckets - 1, Math.floor(imageData.data[i + 1] / 256 * buckets))]++;
    channels[2][Math.min(buckets - 1, Math.floor(imageData.data[i + 2] / 256 * buckets))]++;
  }
  return channels;
}
