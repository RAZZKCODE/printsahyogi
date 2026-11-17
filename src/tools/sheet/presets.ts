import { DEFAULT_SHEET_SETTINGS, type SheetSettings } from "@/tools/sheet/defaults";

/** Per-tool defaults for the upload → editor → print-sheet flow. */
export type SheetToolPreset = {
  defaults: SheetSettings;
  /** Settings applied when the user switches to 4×6 paper. */
  fourBySix: Partial<SheetSettings>;
  defaultCopies: number;
  fourBySixCopies: number;
  crop: { ratio: number; key: string };
  /** Bump to ignore layouts saved by older versions of this tool. */
  storageKeySuffix?: string;
  /** Which passport-specific toolbar/sheet extras to show. */
  ui: { jointPhoto: boolean; sizePresets: boolean; credits: boolean; capacityBadge: boolean; rulers: boolean };
};

const ALL_UI = { jointPhoto: true, sizePresets: true, credits: true, capacityBadge: true, rulers: true };

const PASSPORT: SheetToolPreset = {
  defaults: DEFAULT_SHEET_SETTINGS,
  fourBySix: { paper: "4x6", photosPerRow: 4, photoWidth: 35, photoHeight: 45, gapX: 7.5, gapY: 7.5, margin: 2, border: 2.5, fontSize: 14 },
  defaultCopies: 6,
  fourBySixCopies: 8,
  crop: { ratio: 3 / 4, key: "3:4" },
  ui: ALL_UI
};

/** Postcard photo = 9.06 × 13.34 cm, portrait. Row-wise: 1 photo per row, 2 rows stacked on A4, each photo printed once. */
const POSTCARD: SheetToolPreset = {
  defaults: {
    ...DEFAULT_SHEET_SETTINGS,
    paper: "A4", photosPerRow: 1, photoWidth: 90.6, photoHeight: 133.4,
    gapX: 3, gapY: 3, margin: 4, border: 0.6, fontSize: 12, fit: "cover", fixedRows: null, paperOrientation: undefined
  },
  fourBySix: { paper: "4x6", paperOrientation: "portrait", photosPerRow: 1, photoWidth: 101.6, photoHeight: 152.4, gapX: 0, gapY: 0, margin: 0, border: 0, fontSize: 14, fixedRows: null },
  defaultCopies: 1,
  fourBySixCopies: 1,
  crop: { ratio: 90.6 / 133.4, key: "postcard" },
  storageKeySuffix: ":v2",
  ui: { jointPhoto: false, sizePresets: false, credits: false, capacityBadge: false, rulers: false }
};

const PRESETS: Record<string, SheetToolPreset> = {
  "passport-photo": PASSPORT,
  "postcard-photo": POSTCARD
};

export const SHEET_TOOL_IDS = Object.keys(PRESETS);

export function getSheetPreset(toolId: string): SheetToolPreset {
  return PRESETS[toolId] ?? PASSPORT;
}
