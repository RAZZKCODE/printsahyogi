import JSZip from "jszip";
import { canvasToBlob } from "@/tools/editor/image-export";
import type { SheetSettings } from "@/tools/sheet/defaults";
import { capacityForLayout, layoutJointRows, layoutPlacements, mmToPx } from "@/tools/sheet/layout";
import { paperDimensions } from "@/tools/sheet/defaults";
import type { JointPhotoRecord } from "@/tools/upload/store";

export type ExportPhoto = { image: Blob; quantity: number; text?: string };

export async function renderSheetPages(settings: SheetSettings, photos: ExportPhoto[], jointPhotos: JointPhotoRecord[]) {
  const paper = paperDimensions(settings.paper);
  const capacity = capacityForLayout({ paper, photo: { width: settings.photoWidth, height: settings.photoHeight }, photosPerRow: settings.photosPerRow, gapX: settings.gapX, gapY: settings.gapY, margin: settings.margin });
  const regularFlow = layoutPlacements({ paper, photo: { width: settings.photoWidth, height: settings.photoHeight }, photosPerRow: settings.photosPerRow, gapX: settings.gapX, gapY: settings.gapY, margin: settings.margin }, photos.map(({ quantity }) => quantity));
  const jointDimensions = { width: settings.jointTurnToFit ? settings.jointHeight : settings.jointWidth, height: settings.jointTurnToFit ? settings.jointWidth : settings.jointHeight };
  const jointFlow = layoutJointRows({ paper, joint: jointDimensions, margin: settings.margin, gapX: settings.gapX, gapY: settings.gapY, regularCount: photos.reduce((sum, photo) => sum + photo.quantity, 0), regularColumns: capacity.columns, regularRowsPerPage: capacity.rows, regularPhotoHeight: capacity.photoHeight, jointCount: jointPhotos.length });
  const pageCount = Math.max(regularFlow.pageCount, jointFlow.pageCount);
  const scale = 300 / 25.4;
  const cellWidth = capacity.photoWidth;
  const cellHeight = capacity.photoHeight;
  const gapX = settings.gapX;
  const gapY = settings.gapY;
  const pageBlobs: Blob[] = [];
  for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(mmToPx(paper.width, 300));
    canvas.height = Math.round(mmToPx(paper.height, 300));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas export is not available in this browser.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    const placements = regularFlow.placements.filter((placement) => placement.page === pageIndex);
    for (const placement of placements) {
      const photo = photos[placement.photoIndex];
      if (!photo) continue;
      const image = await loadImage(photo.image);
      const x = settings.margin + placement.column * (cellWidth + gapX);
      const y = settings.margin + placement.row * (cellHeight + gapY);
      drawFitted(context, image, x * scale, y * scale, cellWidth * scale, cellHeight * scale, settings.fit);
      if (settings.border > 0) {
        context.strokeStyle = "#18212f";
        context.lineWidth = Math.max(1, settings.border * scale);
        context.strokeRect(x * scale, y * scale, cellWidth * scale, cellHeight * scale);
      }
      if (photo.text) {
        const textSize = settings.fontSize * (300 / (SHEET_SCREEN_SCALE * 25.4));
        context.fillStyle = "#ffffff";
        context.fillRect(x * scale, (y + cellHeight - 4.2) * scale, cellWidth * scale, 4.2 * scale);
        context.font = `${textSize}px sans-serif`;
        context.textAlign = "center";
        context.fillStyle = "#000000";
        context.fillText(photo.text, (x + cellWidth / 2) * scale, (y + cellHeight - 1.2) * scale, cellWidth * scale - 6);
      }
    }
    const jointOnPage = jointFlow.placements.filter((placement) => placement.page === pageIndex);
    for (const placement of jointOnPage) {
      const record = jointPhotos[placement.jointIndex];
      if (!record) continue;
      const image = await loadImage(record.image);
      const x = settings.margin + placement.column * (jointDimensions.width + gapX);
      const y = placement.top;
      if (settings.jointTurnToFit) {
        context.save();
        context.translate((x + jointDimensions.width / 2) * scale, (y + jointDimensions.height / 2) * scale);
        context.rotate(Math.PI / 2);
        drawFitted(context, image, -jointDimensions.height * scale / 2, -jointDimensions.width * scale / 2, jointDimensions.height * scale, jointDimensions.width * scale, "cover");
        context.restore();
      } else drawFitted(context, image, x * scale, y * scale, jointDimensions.width * scale, jointDimensions.height * scale, "cover");
      if (settings.border > 0) {
        context.strokeStyle = "#18212f";
        context.lineWidth = Math.max(1, settings.border * scale);
        context.strokeRect(x * scale, y * scale, jointDimensions.width * scale, jointDimensions.height * scale);
      }
    }
    pageBlobs.push(await canvasToBlob(canvas, "image/png"));
  }
  return pageBlobs;
}

export async function createPdfBlob(settings: SheetSettings, photos: ExportPhoto[], jointPhotos: JointPhotoRecord[]) {
  const { PDFDocument } = await import("pdf-lib");
  const paper = paperDimensions(settings.paper);
  const pdf = await PDFDocument.create();
  pdf.setTitle("Print sheet");
  pdf.setCreator("PrintSahyogi");
  const pngPages = await renderSheetPages(settings, photos, jointPhotos);
  const widthPt = paper.width / 25.4 * 72;
  const heightPt = paper.height / 25.4 * 72;
  for (const blob of pngPages) {
    const png = await pdf.embedPng(await blob.arrayBuffer());
    const page = pdf.addPage([widthPt, heightPt]);
    page.drawImage(png, { x: 0, y: 0, width: widthPt, height: heightPt });
  }
  const bytes = await pdf.save();
  return new Blob([new Uint8Array(bytes).buffer], { type: "application/pdf" });
}

export async function createImageDownloads(settings: SheetSettings, photos: ExportPhoto[], jointPhotos: JointPhotoRecord[], format: "png" | "jpg") {
  const pages = await renderSheetPages(settings, photos, jointPhotos);
  const converted = format === "png" ? pages : await Promise.all(pages.map(async (blob) => {
    const image = await loadImage(blob);
    const canvas = document.createElement("canvas"); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    canvas.getContext("2d")?.drawImage(image, 0, 0);
    return canvasToBlob(canvas, "image/jpeg", 0.94);
  }));
  if (converted.length === 1) return converted[0];
  const zip = new JSZip();
  converted.forEach((blob, index) => zip.file(`print-sheet-${index + 1}.${format}`, blob));
  return zip.generateAsync({ type: "blob" });
}

export async function createPhotosZip(photos: ExportPhoto[], jointPhotos: JointPhotoRecord[] = []) {
  const zip = new JSZip();
  for (let index = 0; index < photos.length; index++) {
    const photo = photos[index];
    const image = await loadImage(photo.image);
    const canvas = document.createElement("canvas"); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    canvas.getContext("2d")?.drawImage(image, 0, 0);
    if (photo.text) {
      const ctx = canvas.getContext("2d");
      if (ctx) { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, canvas.height - 38, canvas.width, 38); ctx.fillStyle = "#000000"; ctx.font = "26px sans-serif"; ctx.textAlign = "center"; ctx.fillText(photo.text, canvas.width / 2, canvas.height - 10); }
    }
    zip.file(`photo-${String(index + 1).padStart(2, "0")}.png`, await canvasToBlob(canvas));
  }
  for (let index = 0; index < jointPhotos.length; index++) zip.file(`joint-photo-${String(index + 1).padStart(2, "0")}.png`, jointPhotos[index].image);
  return zip.generateAsync({ type: "blob" });
}

const SHEET_SCREEN_SCALE = 2.45;

export function openAndDownload(blob: Blob, filename: string, openTab = false) {
  const url = URL.createObjectURL(blob);
  if (openTab) window.open(url, "_blank", "noopener,noreferrer");
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function drawFitted(context: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number, fit: SheetSettings["fit"]) {
  if (fit === "fill") { context.drawImage(image, x, y, width, height); return; }
  if (fit === "tile") {
    const tileWidth = width * 0.5;
    const tileHeight = tileWidth * image.naturalHeight / image.naturalWidth;
    for (let row = y; row < y + height; row += tileHeight) for (let column = x; column < x + width; column += tileWidth) context.drawImage(image, column, row, tileWidth, tileHeight);
    return;
  }
  const scale = fit === "cover" ? Math.max(width / image.naturalWidth, height / image.naturalHeight) : Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  context.save();
  context.beginPath(); context.rect(x, y, width, height); context.clip();
  context.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
  context.restore();
}

function loadImage(blob: Blob) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(blob);
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not decode export image")); };
    image.src = url;
  });
}

