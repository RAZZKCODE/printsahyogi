import { PAPER_SIZES, type PaperSize } from "@/tools/sheet/layout";
import type { CardCropSettings, CardPaperSize, PdfSide, ProcessedCard } from "@/tools/card-crop/types";

export const CARD_PAPER_SIZES: Record<CardPaperSize, { width: number; height: number }> = {
  A4: PAPER_SIZES.A4,
  A5: PAPER_SIZES.A5,
  Letter: PAPER_SIZES.Letter
};

export function cardDimensions(settings: CardCropSettings, aspectRatio: number) {
  const height = settings.heightMm;
  return { width: height * aspectRatio, height };
}

export function cardSheetCapacity(paper: { width: number; height: number }, card: { width: number; height: number }, gapX: number, gapY: number, margin: number) {
  const columns = Math.max(0, Math.floor((paper.width - margin * 2 + gapX) / (card.width + gapX)));
  const rows = Math.max(0, Math.floor((paper.height - margin * 2 + gapY) / (card.height + gapY)));
  return { columns, rows, perSheet: columns * rows };
}

export type CardSheetPage = {
  side: PdfSide;
  sheetIndex: number;
  placements: Array<{ card: ProcessedCard; x: number; y: number; width: number; height: number; slot: number }>;
};

export function arrangeCardSheets(cards: ProcessedCard[], settings: CardCropSettings, aspectRatio: number, duplexAlign = false): CardSheetPage[] {
  const paper = CARD_PAPER_SIZES[settings.paper];
  const card = cardDimensions(settings, aspectRatio);
  const capacity = cardSheetCapacity(paper, card, settings.gapX, settings.gapY, settings.margin);
  if (capacity.perSheet === 0) return [];
  const front = cards.filter((item) => item.side === "front").sort((a, b) => a.pairIndex - b.pairIndex);
  const back = cards.filter((item) => item.side === "back").sort((a, b) => a.pairIndex - b.pairIndex);
  const selectedSides: PdfSide[] = settings.sides === "Both Sides" ? ["front", "back"] : [settings.sides === "Front" ? "front" : "back"];
  const maxSheets = settings.sides === "Both Sides"
    ? Math.max(1, Math.ceil(front.length / capacity.perSheet), Math.ceil(back.length / capacity.perSheet))
    : Math.max(1, Math.ceil((selectedSides[0] === "front" ? front : back).length / capacity.perSheet));
  const pages: CardSheetPage[] = [];
  for (let sheetIndex = 0; sheetIndex < maxSheets; sheetIndex++) {
    for (const side of selectedSides) {
      const list = side === "front" ? front : back;
      const visible = list.slice(sheetIndex * capacity.perSheet, (sheetIndex + 1) * capacity.perSheet);
      const placements = visible.map((item, index) => {
        const slot = sheetIndex * capacity.perSheet + index;
        const row = Math.floor(index / capacity.columns);
        const col = index % capacity.columns;
        const alignedCol = duplexAlign && side === "back" ? capacity.columns - col - 1 : col;
        return {
          card: item,
          x: settings.margin + alignedCol * (card.width + settings.gapX),
          y: settings.margin + row * (card.height + settings.gapY),
          width: card.width,
          height: card.height,
          slot
        };
      });
      pages.push({ side, sheetIndex, placements });
    }
  }
  return pages;
}
