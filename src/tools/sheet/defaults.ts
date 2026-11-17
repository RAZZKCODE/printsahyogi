import { PAPER_SIZES, type PaperSize } from "@/tools/sheet/layout";

export type ImageFit = "cover" | "contain" | "fill" | "tile";
export type SheetSettings = {
  paper: PaperSize;
  photosPerRow: number;
  photoWidth: number;
  photoHeight: number;
  gapX: number;
  gapY: number;
  margin: number;
  border: number;
  fontSize: number;
  fit: ImageFit;
  showGhosts: boolean;
  jointWidth: number;
  jointHeight: number;
  jointTurnToFit: boolean;
  /** Max rows per page. undefined = legacy (7 rows on A4), null = as many as fit. */
  fixedRows?: number | null;
  /** Force paper orientation. undefined = the paper's natural orientation. */
  paperOrientation?: "portrait" | "landscape";
};

export const DEFAULT_SHEET_SETTINGS: SheetSettings = {
  paper: "A4", photosPerRow: 6, photoWidth: 32, photoHeight: 39.6,
  gapX: 2, gapY: 2, margin: 3, border: 0.35, fontSize: 7,
  fit: "cover", showGhosts: false, jointWidth: 45, jointHeight: 35, jointTurnToFit: false
};

export function paperDimensions(paper: PaperSize, orientation?: "portrait" | "landscape") {
  const size = PAPER_SIZES[paper];
  if (!orientation) return size;
  const portrait = size.width <= size.height;
  return (orientation === "portrait") === portrait ? size : { width: size.height, height: size.width };
}
