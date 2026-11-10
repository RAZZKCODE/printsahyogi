import type { PhotoEditSnapshot } from "@/tools/editor/types";
import { getOrientedSize } from "@/components/editor/crop-stage";

export function renderCropCanvas(image: HTMLImageElement, snapshot: PhotoEditSnapshot, maxEdge = Infinity) {
  const outputSize = getOrientedSize(image.naturalWidth, image.naturalHeight, snapshot.rotation);
  const scale = Math.min(1, maxEdge / Math.max(snapshot.crop.width, snapshot.crop.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(snapshot.crop.width * scale));
  canvas.height = Math.max(1, Math.round(snapshot.crop.height * scale));
  const context = canvas.getContext("2d");
  if (!context) return canvas;
  context.translate((outputSize.width / 2 - snapshot.crop.x) * scale, (outputSize.height / 2 - snapshot.crop.y) * scale);
  context.rotate((snapshot.rotation * 90 + snapshot.straighten) * Math.PI / 180);
  context.scale((snapshot.flipHorizontal ? -1 : 1) * scale, (snapshot.flipVertical ? -1 : 1) * scale);
  context.imageSmoothingQuality = "high";
  context.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = "image/png", quality?: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Canvas export failed")), type, quality);
  });
}
