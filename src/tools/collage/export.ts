import { canvasToBlob } from "@/tools/editor/image-export";
import { collagePaper, pxToMm, type CollagePage, type CollageSettings } from "@/tools/collage/layout";

const DPI = 300;
const MM = DPI / 25.4;

export async function renderCollagePages(settings: CollageSettings, pages: CollagePage[], files: Blob[]) {
  const paper = collagePaper(settings);
  const cache = new Map<number, HTMLImageElement>();
  const getImage = async (index: number) => {
    const cached = cache.get(index);
    if (cached) return cached;
    const image = await loadImage(files[index]);
    cache.set(index, image);
    return image;
  };
  const blobs: Blob[] = [];
  for (const page of pages) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(paper.width * MM);
    canvas.height = Math.round(paper.height * MM);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas export is not available in this browser.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingQuality = "high";
    for (const placement of page.placements) {
      const file = files[placement.photoIndex];
      if (!file) continue;
      const image = await getImage(placement.photoIndex);
      const { box, image: rect } = placement;
      context.save();
      context.beginPath();
      context.rect(box.x * MM, box.y * MM, box.width * MM, box.height * MM);
      context.clip();
      context.drawImage(image, rect.x * MM, rect.y * MM, rect.width * MM, rect.height * MM);
      context.restore();
      if (settings.borderWidth > 0) {
        const line = pxToMm(settings.borderWidth) * MM;
        context.strokeStyle = settings.borderColor;
        context.lineWidth = line;
        context.strokeRect(box.x * MM + line / 2, box.y * MM + line / 2, box.width * MM - line, box.height * MM - line);
      }
    }
    blobs.push(await canvasToBlob(canvas, "image/jpeg", 0.95));
  }
  return blobs;
}

export async function createCollagePdf(settings: CollageSettings, pages: CollagePage[], files: Blob[]) {
  const { PDFDocument } = await import("pdf-lib");
  const paper = collagePaper(settings);
  const pdf = await PDFDocument.create();
  pdf.setTitle("Photo collage");
  pdf.setCreator("PrintSathi");
  const widthPt = paper.width / 25.4 * 72;
  const heightPt = paper.height / 25.4 * 72;
  for (const blob of await renderCollagePages(settings, pages, files)) {
    const jpg = await pdf.embedJpg(await blob.arrayBuffer());
    pdf.addPage([widthPt, heightPt]).drawImage(jpg, { x: 0, y: 0, width: widthPt, height: heightPt });
  }
  const bytes = await pdf.save();
  return new Blob([new Uint8Array(bytes).buffer], { type: "application/pdf" });
}

function loadImage(file: Blob) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not decode image")); };
    image.src = url;
  });
}
