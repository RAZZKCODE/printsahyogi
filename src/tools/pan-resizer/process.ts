import { applyFilterSettings } from "@/tools/editor/filter-engine";
import { canvasToBlob, renderCropCanvas } from "@/tools/editor/image-export";
import type { FilterSettings, PhotoEditSnapshot } from "@/tools/editor/types";
import type { PanSpec } from "@/tools/pan-resizer/config";

export type PanEditState = {
  snapshot: PhotoEditSnapshot;
  filters: FilterSettings;
  background: Blob | null;
  backgroundColor: string;
};

export type PanOutput = { blob: Blob; url: string; width: number; height: number; sizeKb: number; withinLimit: boolean; quality: number };

/** Crop → background → resize to exact portal size → filters → JPEG compressed under the KB limit. */
export async function processPanImage(image: HTMLImageElement, state: PanEditState, spec: PanSpec): Promise<PanOutput> {
  let source: HTMLCanvasElement = renderCropCanvas(image, state.snapshot);

  if (state.background) {
    const foreground = await loadBlobImage(state.background);
    const composed = document.createElement("canvas");
    composed.width = foreground.naturalWidth;
    composed.height = foreground.naturalHeight;
    const context = composed.getContext("2d");
    if (!context) throw new Error("Canvas is unavailable.");
    context.fillStyle = state.backgroundColor === "transparent" ? "#ffffff" : state.backgroundColor;
    context.fillRect(0, 0, composed.width, composed.height);
    context.drawImage(foreground, 0, 0);
    source = composed;
  }

  const output = resizeHighQuality(source, spec.width, spec.height);
  applyFiltersToCanvas(output, state.filters);

  // JPEG has no transparency — flatten on white
  const flat = document.createElement("canvas");
  flat.width = spec.width;
  flat.height = spec.height;
  const flatContext = flat.getContext("2d");
  if (!flatContext) throw new Error("Canvas is unavailable.");
  flatContext.fillStyle = "#ffffff";
  flatContext.fillRect(0, 0, flat.width, flat.height);
  flatContext.drawImage(output, 0, 0);

  const { blob, quality } = await compressJpeg(flat, spec.maxKb * 1024);
  return { blob, url: URL.createObjectURL(blob), width: spec.width, height: spec.height, sizeKb: blob.size / 1024, withinLimit: blob.size <= spec.maxKb * 1024, quality };
}

/** Highest JPEG quality that stays under maxBytes (binary search). */
async function compressJpeg(canvas: HTMLCanvasElement, maxBytes: number) {
  const best = await canvasToBlob(canvas, "image/jpeg", 0.95);
  if (best.size <= maxBytes) return { blob: best, quality: 0.95 };
  let low = 0.05, high = 0.95;
  let found: { blob: Blob; quality: number } | null = null;
  for (let step = 0; step < 8; step++) {
    const mid = (low + high) / 2;
    const blob = await canvasToBlob(canvas, "image/jpeg", mid);
    if (blob.size <= maxBytes) { found = { blob, quality: mid }; low = mid; }
    else high = mid;
  }
  if (found) return found;
  const smallest = await canvasToBlob(canvas, "image/jpeg", 0.05);
  return { blob: smallest, quality: 0.05 };
}

/** Step-down resize for sharp results on large downscales. */
function resizeHighQuality(source: HTMLCanvasElement, width: number, height: number) {
  let current = source;
  while (current.width / 2 > width && current.height / 2 > height) {
    const half = document.createElement("canvas");
    half.width = Math.round(current.width / 2);
    half.height = Math.round(current.height / 2);
    const context = half.getContext("2d");
    if (!context) break;
    context.imageSmoothingQuality = "high";
    context.drawImage(current, 0, 0, half.width, half.height);
    current = half;
  }
  const output = document.createElement("canvas");
  output.width = width;
  output.height = height;
  const context = output.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable.");
  context.imageSmoothingQuality = "high";
  context.drawImage(current, 0, 0, width, height);
  return output;
}

function applyFiltersToCanvas(canvas: HTMLCanvasElement, settings: FilterSettings) {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return;
  let maskData: Uint8ClampedArray | undefined;
  if (settings.maskStrokes.length) {
    const mask = document.createElement("canvas");
    mask.width = canvas.width;
    mask.height = canvas.height;
    const maskContext = mask.getContext("2d");
    if (maskContext) {
      for (const stroke of settings.maskStrokes) {
        if (!stroke.points.length) continue;
        maskContext.save();
        maskContext.globalCompositeOperation = stroke.erase ? "destination-out" : "source-over";
        maskContext.lineWidth = Math.max(1, stroke.radius * canvas.width * 2);
        maskContext.lineCap = "round";
        maskContext.lineJoin = "round";
        maskContext.strokeStyle = "white";
        maskContext.fillStyle = "white";
        maskContext.shadowColor = "white";
        maskContext.shadowBlur = stroke.feather * canvas.width;
        maskContext.beginPath();
        if (stroke.points.length === 1) {
          const point = stroke.points[0];
          maskContext.arc(point.x * canvas.width, point.y * canvas.height, maskContext.lineWidth / 2, 0, Math.PI * 2);
          maskContext.fill();
        } else {
          maskContext.moveTo(stroke.points[0].x * canvas.width, stroke.points[0].y * canvas.height);
          for (const point of stroke.points.slice(1)) maskContext.lineTo(point.x * canvas.width, point.y * canvas.height);
          maskContext.stroke();
        }
        maskContext.restore();
      }
      maskData = maskContext.getImageData(0, 0, canvas.width, canvas.height).data;
    }
  }
  context.putImageData(applyFilterSettings(context.getImageData(0, 0, canvas.width, canvas.height), settings, maskData), 0, 0);
}

export function loadBlobImage(blob: Blob) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not open this image.")); };
    image.src = url;
  });
}
