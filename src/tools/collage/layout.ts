import { PAPER_SIZES, type PaperSize } from "@/tools/sheet/layout";

export type CollageMode = "grid" | "natural";
export type CollageFit = "contain" | "cover" | "fill";
export type CollagePosition = "top" | "center" | "bottom";
export type CollageOrientation = "portrait" | "landscape";

export type CollageSettings = {
  mode: CollageMode;
  rows: number;
  columns: number;
  naturalColumns: number;
  paper: PaperSize;
  orientation: CollageOrientation;
  margin: number; // mm
  gap: number; // mm
  fit: CollageFit;
  position: CollagePosition;
  borderWidth: number; // px (96 dpi)
  borderColor: string;
};

export const DEFAULT_COLLAGE_SETTINGS: CollageSettings = {
  mode: "grid",
  rows: 3,
  columns: 2,
  naturalColumns: 2,
  paper: "A4",
  orientation: "portrait",
  margin: 10,
  gap: 4,
  fit: "contain",
  position: "center",
  borderWidth: 1,
  borderColor: "#e5e7eb"
};

/** Photos-per-page presets → rows × columns (portrait-friendly). */
export const PER_PAGE_PRESETS: Array<{ count: number; rows: number; columns: number }> = [
  { count: 1, rows: 1, columns: 1 },
  { count: 2, rows: 2, columns: 1 },
  { count: 4, rows: 2, columns: 2 },
  { count: 6, rows: 3, columns: 2 },
  { count: 8, rows: 4, columns: 2 },
  { count: 9, rows: 3, columns: 3 },
  { count: 12, rows: 4, columns: 3 }
];

export type Size = { width: number; height: number };

/** One photo on a page. `box` is the cell / slot; `image` is where the photo is actually drawn (mm). */
export type CollagePlacement = {
  photoIndex: number;
  box: { x: number; y: number; width: number; height: number };
  image: { x: number; y: number; width: number; height: number };
};

export type CollagePage = { placements: CollagePlacement[] };

export function collagePaper(settings: Pick<CollageSettings, "paper" | "orientation">): Size {
  const base = PAPER_SIZES[settings.paper];
  return settings.orientation === "landscape" ? { width: base.height, height: base.width } : { width: base.width, height: base.height };
}

export const pxToMm = (px: number) => px * 25.4 / 96;

export function layoutCollage(settings: CollageSettings, sizes: Array<Size | null>): CollagePage[] {
  return settings.mode === "grid" ? layoutGrid(settings, sizes) : layoutNatural(settings, sizes);
}

function layoutGrid(settings: CollageSettings, sizes: Array<Size | null>): CollagePage[] {
  const paper = collagePaper(settings);
  const rows = clampInt(settings.rows, 1, 20);
  const columns = clampInt(settings.columns, 1, 20);
  const perPage = rows * columns;
  const availW = Math.max(1, paper.width - settings.margin * 2);
  const availH = Math.max(1, paper.height - settings.margin * 2);
  const cellW = Math.max(1, (availW - settings.gap * (columns - 1)) / columns);
  const cellH = Math.max(1, (availH - settings.gap * (rows - 1)) / rows);
  const pages: CollagePage[] = [];
  sizes.forEach((size, photoIndex) => {
    const pageIndex = Math.floor(photoIndex / perPage);
    const slot = photoIndex % perPage;
    if (!pages[pageIndex]) pages[pageIndex] = { placements: [] };
    const box = {
      x: settings.margin + (slot % columns) * (cellW + settings.gap),
      y: settings.margin + Math.floor(slot / columns) * (cellH + settings.gap),
      width: cellW,
      height: cellH
    };
    pages[pageIndex].placements.push({ photoIndex, box, image: fitInBox(box, size, settings.fit, settings.position) });
  });
  return pages;
}

/** Masonry: photos keep their aspect ratio, fill the shortest column, and flow to a new page when nothing fits. */
function layoutNatural(settings: CollageSettings, sizes: Array<Size | null>): CollagePage[] {
  const paper = collagePaper(settings);
  const columns = clampInt(settings.naturalColumns, 1, 10);
  const availW = Math.max(1, paper.width - settings.margin * 2);
  const availH = Math.max(1, paper.height - settings.margin * 2);
  const colW = Math.max(1, (availW - settings.gap * (columns - 1)) / columns);
  const pages: CollagePage[] = [];
  let current: CollagePage = { placements: [] };
  let heights = new Array<number>(columns).fill(0);

  sizes.forEach((size, photoIndex) => {
    const ratio = size && size.width > 0 ? size.height / size.width : 1;
    let width = colW;
    let height = colW * ratio;
    if (height > availH) {
      height = availH;
      width = height / ratio;
    }
    const top = (column: number) => heights[column] === 0 ? 0 : heights[column] + settings.gap;
    const order = heights.map((_, column) => column).sort((a, b) => heights[a] - heights[b] || a - b);
    let column = order.find((candidate) => top(candidate) + height <= availH + 0.001);
    if (column === undefined) {
      pages.push(current);
      current = { placements: [] };
      heights = new Array<number>(columns).fill(0);
      column = 0;
    }
    const y = settings.margin + top(column);
    const x = settings.margin + column * (colW + settings.gap) + (colW - width) / 2;
    const rect = { x, y, width, height };
    current.placements.push({ photoIndex, box: rect, image: rect });
    heights[column] = top(column) + height;
  });
  if (current.placements.length) pages.push(current);
  return pages;
}

function fitInBox(box: CollagePlacement["box"], size: Size | null, fit: CollageFit, position: CollagePosition): CollagePlacement["image"] {
  if (fit === "fill" || !size || size.width <= 0 || size.height <= 0) return { ...box };
  const scale = fit === "contain"
    ? Math.min(box.width / size.width, box.height / size.height)
    : Math.max(box.width / size.width, box.height / size.height);
  const width = size.width * scale;
  const height = size.height * scale;
  const align = position === "top" ? 0 : position === "bottom" ? 1 : 0.5;
  return { x: box.x + (box.width - width) / 2, y: box.y + (box.height - height) * align, width, height };
}

function clampInt(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(Number.isFinite(value) ? value : min)));
}
