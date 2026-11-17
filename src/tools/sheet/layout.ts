export type PaperSize = "A4" | "4x6" | "5x7" | "A5" | "Letter";

export type DimensionsMm = { width: number; height: number };
export type SheetLayoutInput = {
  paper: DimensionsMm;
  photo: DimensionsMm;
  photosPerRow: number;
  gapX: number;
  gapY: number;
  margin: number;
  /** undefined = legacy (7 rows on A4), null = no row cap, number = cap. */
  fixedRows?: number | null;
};

export const PAPER_SIZES: Record<PaperSize, DimensionsMm> = {
  A4: { width: 210, height: 297 },
  "4x6": { width: 152.4, height: 101.6 },
  "5x7": { width: 127, height: 177.8 },
  A5: { width: 148, height: 210 },
  Letter: { width: 215.9, height: 279.4 }
};

export const PHOTO_PRESETS: Array<{ name: string; width: number; height: number }> = [
  { name: "India · 3.5 × 4.5 cm", width: 35, height: 45 },
  { name: "US · 2 × 2 in", width: 50.8, height: 50.8 },
  { name: "UK / EU · 35 × 45 mm", width: 35, height: 45 },
  { name: "China · 33 × 48 mm", width: 33, height: 48 },
  { name: "Stamp · 25 × 35 mm", width: 25, height: 35 }
];

export const mmToPx = (millimeters: number, dpi = 96) => millimeters * dpi / 25.4;
export const cmToMm = (centimeters: number) => centimeters * 10;
export const mmToCm = (millimeters: number) => millimeters / 10;

export function capacityForLayout({ paper, photo, photosPerRow, gapX, gapY, margin, fixedRows }: SheetLayoutInput) {
  const safeColumns = Math.max(1, Math.floor(photosPerRow));
  const availableWidth = Math.max(0, paper.width - margin * 2);
  const availableHeight = Math.max(0, paper.height - margin * 2);
  const targetRows = fixedRows === null ? undefined
    : fixedRows !== undefined ? fixedRows
    : paper.width === PAPER_SIZES.A4.width && paper.height === PAPER_SIZES.A4.height ? 7 : undefined;
  const maxPhotoHeight = targetRows ? Math.max(0, (availableHeight - gapY * (targetRows - 1)) / targetRows) : Infinity;
  const photoWidth = Math.min(photo.width, Math.max(0, (availableWidth - gapX * (safeColumns - 1)) / safeColumns), maxPhotoHeight * photo.width / Math.max(0.0001, photo.height));
  const photoHeight = photoWidth * photo.height / Math.max(0.0001, photo.width);
  const rows = photoWidth > 0 && photoHeight > 0
    ? Math.min(targetRows ?? Infinity, Math.max(0, Math.floor((availableHeight + gapY) / (photoHeight + gapY) + 1e-9)))
    : 0;
  return { columns: safeColumns, rows, total: safeColumns * rows, photoWidth, photoHeight };
}

export function fitPhotoWidthForColumns(input: Omit<SheetLayoutInput, "photo"> & { aspectRatio: number }) {
  const columns = Math.max(1, Math.floor(input.photosPerRow));
  const usableWidth = Math.max(0, input.paper.width - input.margin * 2 - input.gapX * (columns - 1));
  const width = usableWidth / columns;
  return { width, height: width / Math.max(0.0001, input.aspectRatio) };
}

export function layoutPlacements(input: SheetLayoutInput, copyCounts: number[]) {
  const capacity = capacityForLayout(input);
  const placements: Array<{ photoIndex: number; copyIndex: number; page: number; row: number; column: number }> = [];
  if (capacity.total === 0) return { capacity, placements, pageCount: 1 };
  let absoluteIndex = 0;
  copyCounts.forEach((copies, photoIndex) => {
    for (let copyIndex = 0; copyIndex < Math.max(0, Math.floor(copies)); copyIndex++) {
      const page = capacity.total ? Math.floor(absoluteIndex / capacity.total) : 0;
      const inPage = capacity.total ? absoluteIndex % capacity.total : absoluteIndex;
      placements.push({ photoIndex, copyIndex, page, row: Math.floor(inPage / capacity.columns), column: inPage % capacity.columns });
      absoluteIndex++;
    }
  });
  return { capacity, placements, pageCount: Math.max(1, Math.ceil(absoluteIndex / Math.max(1, capacity.total))) };
}

export function layoutJointRows(input: {
  paper: DimensionsMm;
  joint: DimensionsMm;
  margin: number;
  gapX: number;
  gapY: number;
  regularCount: number;
  regularColumns: number;
  regularRowsPerPage: number;
  regularPhotoHeight: number;
  jointCount: number;
}) {
  const columns = input.joint.width > 0 ? Math.max(0, Math.floor((input.paper.width - input.margin * 2 + input.gapX) / (input.joint.width + input.gapX))) : 0;
  const rowsPerPage = input.joint.height > 0 ? Math.max(0, Math.floor((input.paper.height - input.margin * 2 + input.gapY) / (input.joint.height + input.gapY))) : 0;
  const regularCapacity = Math.max(1, input.regularColumns * input.regularRowsPerPage);
  const regularPageCount = Math.max(1, Math.ceil(input.regularCount / regularCapacity));
  if (columns === 0 || rowsPerPage === 0 || input.jointCount === 0) {
    return { columns, rowsPerPage, placements: [], pageCount: regularPageCount };
  }
  let page = Math.floor(input.regularCount / regularCapacity);
  const remaining = input.regularCount % regularCapacity;
  const regularRowsUsed = remaining === 0 ? 0 : Math.ceil(remaining / Math.max(1, input.regularColumns));
  let top = input.margin + regularRowsUsed * (input.regularPhotoHeight + input.gapY);
  if (input.regularCount === 0) { page = 0; top = input.margin; }
  const placements: Array<{ jointIndex: number; page: number; top: number; column: number }> = [];
  for (let jointIndex = 0; jointIndex < input.jointCount; jointIndex++) {
    if (top + input.joint.height > input.paper.height - input.margin && top > input.margin) { page++; top = input.margin; }
    for (let column = 0; column < columns; column++) placements.push({ jointIndex, page, top, column });
    top += input.joint.height + input.gapY;
  }
  return { columns, rowsPerPage, placements, pageCount: Math.max(1, page + (input.jointCount ? 1 : 0)) };
}
