import type { CardCropConfig } from "@/tools/card-crop/config";

export type PdfSide = "front" | "back";
export type NormalizedCrop = { x: number; y: number; width: number; height: number };
export type CardSideMode = "Front" | "Back" | "Both Sides";
export type CardPaperSize = "A4" | "A5" | "Letter" | "4x6" | "4x6-glossy" | "PVC";

export type CardCropSettings = {
  paper: CardPaperSize;
  enhance: boolean;
  sides: CardSideMode;
  heightMm: number;
  gapX: number;
  gapY: number;
  margin: number;
  manualAspectRatio?: number;
  cropMode?: "card" | "full";
  background?: "normal" | "colored";
  backgroundColor?: string;
  rounded?: boolean;
  border?: number;
  inlineSides?: boolean;
};

export type CardAppearance = {
  flipHorizontal?: boolean;
  flipVertical?: boolean;
  background?: "normal" | "colored";
};

export type ProcessedCard = {
  id: string;
  sourceName: string;
  pageNumber: number;
  side: PdfSide;
  pairIndex: number;
  pageImage: Blob;
  crop: NormalizedCrop;
  image: Blob;
  confidence: number;
  config: CardCropConfig;
  documentId?: string;
  pageAspectRatio?: number;
  aadhaarStripImage?: Blob;
  appearance?: CardAppearance;
};
