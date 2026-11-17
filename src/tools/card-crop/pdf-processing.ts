import type { CardCropSettings, NormalizedCrop, ProcessedCard, PdfSide } from "@/tools/card-crop/types";
import type { CardCropConfig } from "@/tools/card-crop/config";
import { canvasToBlob } from "@/tools/editor/image-export";
import { detectAadhaarCardStrip } from "@/tools/card-crop/aadhaar-detection";

export class ProtectedPdfError extends Error {
  constructor(message = "This PDF is password protected.") { super(message); this.name = "ProtectedPdfError"; }
}

export async function processPdfFile(file: File, config: CardCropConfig, password?: string, onProgress?: (current: number, total: number) => void): Promise<ProcessedCard[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument({ data, password });
  let pdfDocument;
  try {
    pdfDocument = await loadingTask.promise;
  } catch (error) {
    if ((error as { name?: string })?.name === "PasswordException") throw new ProtectedPdfError(password ? "The password is incorrect. Try again." : undefined);
    throw error;
  }

  const documentId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const crops: Array<{ pageNumber: number; pageImage: Blob; pageAspectRatio: number; crop: NormalizedCrop; confidence: number; aadhaarStripImage?: Blob }> = [];
  try {
    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber++) {
      onProgress?.(pageNumber, pdfDocument.numPages);
      const page = await pdfDocument.getPage(pageNumber);
      const baseViewport = page.getViewport({ scale: 1 });
      // Large enough to keep card crops near 300 DPI at their configured print size.
      const scale = Math.min(6, 3600 / baseViewport.width);
      const viewport = page.getViewport({ scale });
      const canvas = window.document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) continue;
      context.fillStyle = "white";
      context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: context, viewport }).promise;
      const pageImage = await canvasToBlob(canvas, "image/png");
      const aadhaar = config.slug === "aadhaar-crop" || config.slug === "aadhaar-crop-a4-double-side-glossy";
      const regions = detectCardRegions(canvas, config.aspectRatio, aadhaar);
      const stripCrop = regions[0]?.stripCrop;
      const aadhaarStripImage = stripCrop ? await cropPageImage(pageImage, stripCrop, false) : undefined;
      regions.forEach((region) => crops.push({ pageNumber, pageImage, pageAspectRatio: canvas.width / canvas.height, crop: region.crop, confidence: region.confidence, aadhaarStripImage }));
      page.cleanup();
    }
  } finally {
    await pdfDocument.destroy();
  }

  return Promise.all(crops.map(async (item, index) => ({
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
    sourceName: file.name,
    pageNumber: item.pageNumber,
    side: config.sides === 1 ? "front" : (index % 2 === 0 ? "front" : "back") as PdfSide,
    pairIndex: Math.floor(index / Math.max(1, config.sides)),
    pageImage: item.pageImage,
    crop: item.crop,
    image: await cropPageImage(item.pageImage, item.crop, false),
    confidence: item.confidence,
    config,
    documentId,
    pageAspectRatio: item.pageAspectRatio,
    aadhaarStripImage: item.aadhaarStripImage
  })));
}

export async function renderCardImage(card: ProcessedCard, settings: CardCropSettings, printHeightMm = settings.heightMm) {
  const crop = settings.cropMode === "full" ? { x: 0, y: 0, width: 1, height: 1 } : card.crop;
  const blob = await cropPageImage(card.pageImage, crop, settings.enhance);
  const image = await imageFromBlob(blob);
  const trim = card.aadhaarStripImage && settings.cropMode !== "full";
  const insetX = trim ? Math.ceil(image.naturalWidth * .004) : 0;
  const insetY = trim ? Math.ceil(image.naturalHeight * .004) : 0;
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth - insetX * 2;
  canvas.height = image.naturalHeight - insetY * 2;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Image processing is not available.");
  context.drawImage(image, insetX, insetY, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
  if ((card.appearance?.background ?? settings.background) === "colored") {
    const data = context.getImageData(0, 0, canvas.width, canvas.height);
    const background = document.createElement("canvas");
    background.width = canvas.width; background.height = canvas.height;
    const bg = background.getContext("2d", { willReadFrequently: true });
    if (!bg) throw new Error("Background rendering is not available.");
    if (settings.inlineSides) {
      const gradient = bg.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, "#fff9e9"); gradient.addColorStop(.55, "#f7f8ee"); gradient.addColorStop(1, "#c6e3cd");
      bg.fillStyle = gradient; bg.fillRect(0, 0, canvas.width, canvas.height);
      bg.strokeStyle = "rgba(255,255,255,.33)"; bg.lineWidth = canvas.height * .045;
      for (let index = 0; index < 6; index++) {
        const y = canvas.height * (.15 + index * .12);
        bg.beginPath(); bg.moveTo(-canvas.width * .1, y);
        bg.bezierCurveTo(canvas.width * .2, y - canvas.height * .2, canvas.width * .55, y + canvas.height * .2, canvas.width * 1.1, y - canvas.height * .05); bg.stroke();
      }
    } else { bg.fillStyle = settings.backgroundColor ?? "#e6f2ff"; bg.fillRect(0, 0, canvas.width, canvas.height); }
    const backgroundData = bg.getImageData(0, 0, canvas.width, canvas.height).data;
    for (let i = 0; i < data.data.length; i += 4) {
      const minimum = Math.min(data.data[i], data.data[i + 1], data.data[i + 2]);
      if (minimum < 245) continue;
      for (let channel = 0; channel < 3; channel++) data.data[i + channel] = backgroundData[i + channel];
    }
    context.putImageData(data, 0, 0);
  }
  const result = document.createElement("canvas");
  result.width = canvas.width; result.height = canvas.height;
  const output = result.getContext("2d");
  if (!output) throw new Error("Image processing is not available.");
  const border = (settings.border ?? 0) * canvas.height / Math.max(1, printHeightMm * 96 / 25.4);
  const inset = border / 2;
  output.beginPath();
  output.roundRect(inset, inset, Math.max(1, canvas.width - border), Math.max(1, canvas.height - border), settings.rounded ? Math.min(canvas.width, canvas.height) * .045 : 0);
  output.save(); output.clip();
  output.translate(card.appearance?.flipHorizontal ? canvas.width : 0, card.appearance?.flipVertical ? canvas.height : 0);
  output.scale(card.appearance?.flipHorizontal ? -1 : 1, card.appearance?.flipVertical ? -1 : 1);
  output.drawImage(canvas, 0, 0); output.restore();
  if (border > 0) { output.strokeStyle = "#334155"; output.lineWidth = border; output.stroke(); }
  return canvasToBlob(result, "image/png");
}

export function detectCardRegions(page: HTMLCanvasElement, aspectRatio: number, aadhaar = false): Array<{ crop: NormalizedCrop; confidence: number; stripCrop?: NormalizedCrop }> {
  const sampleWidth = Math.min(aadhaar ? 1000 : 520, page.width);
  const sampleHeight = Math.max(1, Math.round(page.height * sampleWidth / page.width));
  const sample = document.createElement("canvas");
  sample.width = sampleWidth;
  sample.height = sampleHeight;
  const sampleContext = sample.getContext("2d", { willReadFrequently: true });
  if (!sampleContext) return [{ crop: centeredCrop(aspectRatio), confidence: 0.2 }];
  sampleContext.drawImage(page, 0, 0, sampleWidth, sampleHeight);
  const { data } = sampleContext.getImageData(0, 0, sampleWidth, sampleHeight);
  if (aadhaar) {
    const detected = detectAadhaarCardStrip(data, sampleWidth, sampleHeight, aspectRatio);
    if (detected) return [detected.front, detected.back].map((crop) => ({ crop, confidence: detected.confidence, stripCrop: detected.strip }));
  }
  const foreground = new Uint8Array(sampleWidth * sampleHeight);
  const rows = new Uint16Array(sampleHeight);
  for (let y = 0; y < sampleHeight; y++) {
    for (let x = 0; x < sampleWidth; x++) {
      const i = (y * sampleWidth + x) * 4;
      const max = Math.max(data[i], data[i + 1], data[i + 2]);
      const min = Math.min(data[i], data[i + 1], data[i + 2]);
      const isInk = max < 242 || max - min > 20;
      if (isInk) { foreground[y * sampleWidth + x] = 1; rows[y]++; }
    }
  }
  const rowBands = runs(rows, Math.max(2, Math.round(sampleWidth * 0.008)), Math.max(2, Math.round(sampleHeight * 0.012)));
  const found: Array<{ crop: NormalizedCrop; confidence: number }> = [];
  for (const [top, bottom] of rowBands) {
    if (bottom - top < sampleHeight * 0.055) continue;
    const columns = new Uint16Array(sampleWidth);
    for (let y = top; y <= bottom; y++) for (let x = 0; x < sampleWidth; x++) if (foreground[y * sampleWidth + x]) columns[x]++;
    const colRuns = runs(columns, Math.max(2, Math.round((bottom - top) * 0.018)), Math.max(2, Math.round(sampleWidth * 0.01)));
    for (const [left, right] of colRuns) {
      const width = right - left;
      const height = bottom - top;
      if (width * height < sampleWidth * sampleHeight * 0.012) continue;
      const ratio = width / Math.max(1, height);
      const ratioError = Math.abs(Math.log(ratio / aspectRatio));
      if (ratioError > 0.48) continue;
      const padX = Math.max(1, Math.round(width * 0.012));
      const padY = Math.max(1, Math.round(height * 0.012));
      const x0 = Math.max(0, left - padX), y0 = Math.max(0, top - padY);
      const x1 = Math.min(sampleWidth, right + padX), y1 = Math.min(sampleHeight, bottom + padY);
      found.push({ crop: { x: x0 / sampleWidth, y: y0 / sampleHeight, width: (x1 - x0) / sampleWidth, height: (y1 - y0) / sampleHeight }, confidence: Math.max(0.3, 1 - ratioError) });
    }
  }
  const unique = found.filter((candidate, index) => found.findIndex((other) => Math.abs(other.crop.x - candidate.crop.x) < 0.025 && Math.abs(other.crop.y - candidate.crop.y) < 0.025 && Math.abs(other.crop.width - candidate.crop.width) < 0.04 && Math.abs(other.crop.height - candidate.crop.height) < 0.04) === index);
  if (unique.length) return unique.slice(0, 12);

  let left = sampleWidth, right = 0, top = sampleHeight, bottom = 0;
  foreground.forEach((value, index) => {
    if (!value) return;
    const x = index % sampleWidth, y = Math.floor(index / sampleWidth);
    left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
  });
  const bboxRatio = (right - left) / Math.max(1, bottom - top);
  if (right > left && bottom > top && Math.abs(Math.log(bboxRatio / aspectRatio)) < 0.5) {
    return [{ crop: { x: left / sampleWidth, y: top / sampleHeight, width: (right - left) / sampleWidth, height: (bottom - top) / sampleHeight }, confidence: 0.45 }];
  }
  return [{ crop: centeredCrop(aspectRatio), confidence: 0.18 }];
}

export async function cropPageImage(pageBlob: Blob, crop: NormalizedCrop, enhance: boolean) {
  const image = await imageFromBlob(pageBlob);
  const sx = Math.max(0, Math.round(crop.x * image.naturalWidth));
  const sy = Math.max(0, Math.round(crop.y * image.naturalHeight));
  const sw = Math.max(1, Math.min(image.naturalWidth - sx, Math.round(crop.width * image.naturalWidth)));
  const sh = Math.max(1, Math.min(image.naturalHeight - sy, Math.round(crop.height * image.naturalHeight)));
  const canvas = document.createElement("canvas");
  canvas.width = sw; canvas.height = sh;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return pageBlob;
  context.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);
  if (enhance) {
    const data = context.getImageData(0, 0, sw, sh);
    const original = new Uint8ClampedArray(data.data);
    for (let i = 0; i < data.data.length; i += 4) {
      for (let channel = 0; channel < 3; channel++) data.data[i + channel] = Math.max(0, Math.min(255, (original[i + channel] - 128) * 1.12 + 128));
    }
    context.putImageData(data, 0, 0);
  }
  return canvasToBlob(canvas, "image/png");
}

export function runs(values: ArrayLike<number>, threshold: number, maxGap: number) {
  const result: Array<[number, number]> = [];
  let start = -1, last = -1;
  for (let i = 0; i < values.length; i++) {
    if (values[i] < threshold) continue;
    if (start < 0) start = i;
    else if (i - last > maxGap + 1) { result.push([start, last]); start = i; }
    last = i;
  }
  if (start >= 0) result.push([start, last]);
  return result;
}

function centeredCrop(aspectRatio: number): NormalizedCrop {
  const pageAspect = 0.707;
  let width = 0.78, height = width / aspectRatio;
  if (height > 0.78 / pageAspect) { height = 0.78 / pageAspect; width = height * aspectRatio; }
  return { x: (1 - width) / 2, y: (1 - height) / 2, width, height };
}

function imageFromBlob(blob: Blob) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(blob);
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not read PDF page image.")); };
    image.src = url;
  });
}
