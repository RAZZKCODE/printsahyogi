export type CropRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PhotoEditOperation =
  | { type: "rotate"; quarterTurns: number }
  | { type: "flip"; horizontal: boolean; vertical: boolean }
  | { type: "straighten"; degrees: number }
  | { type: "crop"; rect: CropRect; aspectRatio: number | null; aspectKey: string }
  | { type: "filters"; settings: FilterSettings }
  | { type: "remove-background" };

export type PhotoEditSnapshot = {
  crop: CropRect;
  aspectRatio: number | null;
  aspectKey: string;
  rotation: number;
  flipHorizontal: boolean;
  flipVertical: boolean;
  straighten: number;
};

export type FilterAdjustment =
  | "exposure" | "brighten" | "darken" | "deepen" | "contrast"
  | "lightenShadows" | "darkenHighlights"
  | "saturation" | "vibrance" | "temperature" | "tint"
  | "sharpen" | "clarity" | "noiseReduction"
  | "vignette" | "grain" | "blur";

export type BrushStroke = {
  points: Array<{ x: number; y: number }>;
  radius: number;
  feather: number;
  erase: boolean;
};

export type FilterSettings = {
  preset: string;
  negative: boolean;
  autoColor: number;
  autoLevels: number;
  autoContrast: number;
  hdr: boolean;
  magicColor: boolean;
  adjustments: Record<FilterAdjustment, number>;
  maskStrokes: BrushStroke[];
  brushSize: number;
  brushFeather: number;
  eraseMode: boolean;
};
