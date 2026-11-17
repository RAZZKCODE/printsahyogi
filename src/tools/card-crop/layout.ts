import { PAPER_SIZES } from "@/tools/sheet/layout";
import type { CardCropSettings, CardPaperSize, PdfSide, ProcessedCard } from "@/tools/card-crop/types";

export const CARD_PAPER_SIZES: Record<CardPaperSize, { width: number; height: number }> = {
  A4: PAPER_SIZES.A4,
  A5: PAPER_SIZES.A5,
  Letter: PAPER_SIZES.Letter,
  "4x6": { width: 101.6, height: 152.4 },
  "4x6-glossy": { width: 101.6, height: 152.4 },
  PVC: { width: 85.6, height: 54 }
};

export function cardDimensions(settings: CardCropSettings, aspectRatio: number) {
  if (settings.inlineSides && settings.cropMode !== "full") {
    const width = settings.paper === "PVC" ? CARD_PAPER_SIZES.PVC.width : settings.heightMm;
    return { width, height: settings.paper === "PVC" ? CARD_PAPER_SIZES.PVC.height : width / aspectRatio };
  }
  const paper = CARD_PAPER_SIZES[settings.paper];
  const height = settings.inlineSides && settings.cropMode === "full" ? Math.min(settings.heightMm, paper.height - settings.margin * 2, (paper.width - settings.margin * 2) / aspectRatio) : settings.heightMm;
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
  placements: Array<{ card: ProcessedCard; x: number; y: number; width: number; height: number; slot: number; rotation?: 0 | 180 }>;
};

function arrangeAadhaarSheets(cards: ProcessedCard[], settings: CardCropSettings, aspectRatio: number): CardSheetPage[] {
  const paper = CARD_PAPER_SIZES[settings.paper];
  const size = cardDimensions(settings, aspectRatio);
  const gapX = settings.gapX * 25.4 / 96, gapY = settings.gapY * 25.4 / 96;
  const margin = settings.paper === "PVC" ? 0 : 5.5;
  const pairs = Array.from(new Set(cards.map((item) => item.pairIndex))).sort((a, b) => a - b);
  const pages: CardSheetPage[] = [];
  const both = settings.sides === "Both Sides";
  const selected = cards.filter((item) => both || item.side === (settings.sides === "Front" ? "front" : "back"));
  const pairWidth = size.width * (both ? 2 : 1) + (both ? gapX : 0);
  if (size.width > paper.width || size.height > paper.height - margin * 2) return [];
  if (settings.paper === "A4" && pairWidth > paper.width - margin * 2) return [];
  const rows = Math.floor((paper.height - margin * 2 + gapY) / (size.height + gapY));
  if (!rows) return [];
  pairs.forEach((pairIndex, pairSlot) => {
    const sides = selected.filter((item) => item.pairIndex === pairIndex).sort((a, b) => a.side === b.side ? 0 : a.side === "front" ? -1 : 1);
    if (!sides.length) return;
    if (settings.paper === "A4") {
      const pageIndex = Math.floor(pairSlot / rows);
      const page = pages[pageIndex] ?? (pages[pageIndex] = { side: "front", sheetIndex: pageIndex, placements: [] });
      for (const item of sides) page.placements.push({ card: item, ...size, x: (paper.width - pairWidth) / 2 + (both && item.side === "back" ? size.width + gapX : 0), y: margin + pairSlot % rows * (size.height + gapY), slot: pairSlot, rotation: 0 });
    } else if (settings.paper === "4x6") {
      if (sides.length * size.height + (sides.length - 1) * gapY > paper.height - margin * 2) return;
      pages.push({ side: "front", sheetIndex: pairSlot, placements: sides.map((item, index) => ({ card: item, ...size, x: (paper.width - size.width) / 2, y: margin + index * (size.height + gapY), slot: pairSlot, rotation: item.side === "back" ? 180 : 0 })) });
    } else {
      for (const item of sides) pages.push({ side: item.side, sheetIndex: pairSlot, placements: [{ card: item, ...size, x: (paper.width - size.width) / 2, y: margin, slot: pairSlot, rotation: 0 }] });
    }
  });
  return pages.filter(Boolean);
}

export function arrangeCardSheets(cards: ProcessedCard[], settings: CardCropSettings, aspectRatio: number, duplexAlign = false): CardSheetPage[] {
  if (settings.inlineSides && settings.cropMode !== "full") return arrangeAadhaarSheets(cards, settings, aspectRatio);
  const paper = CARD_PAPER_SIZES[settings.paper];
  const card = cardDimensions(settings, aspectRatio);
  const capacity = cardSheetCapacity(paper, card, settings.gapX, settings.gapY, settings.margin);
  if (capacity.perSheet === 0) return [];
  if (settings.cropMode === "full" || (settings.inlineSides && !duplexAlign)) {
    const seen = new Set<string>();
    const selected = cards.filter((item) => {
      if (settings.cropMode === "full") {
        const key = `${item.documentId ?? item.sourceName}:${item.pageNumber}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }
      return settings.sides === "Both Sides" || item.side === (settings.sides === "Front" ? "front" : "back");
    });
    return Array.from({ length: Math.ceil(selected.length / capacity.perSheet) }, (_, sheetIndex) => ({
      side: "front" as const,
      sheetIndex,
      placements: selected.slice(sheetIndex * capacity.perSheet, (sheetIndex + 1) * capacity.perSheet).map((item, index) => ({
        card: item, x: settings.margin + index % capacity.columns * (card.width + settings.gapX),
        y: settings.margin + Math.floor(index / capacity.columns) * (card.height + settings.gapY),
        width: card.width, height: card.height, slot: sheetIndex * capacity.perSheet + index
      }))
    }));
  }
  const front = cards.filter((item) => item.side === "front").sort((a, b) => a.pairIndex - b.pairIndex);
  const back = cards.filter((item) => item.side === "back").sort((a, b) => a.pairIndex - b.pairIndex);
  const selectedSides: PdfSide[] = settings.sides === "Both Sides" ? ["front", "back"] : [settings.sides === "Front" ? "front" : "back"];
  const pairs = Array.from(new Set(cards.map((item) => item.pairIndex))).sort((a, b) => a - b);
  const pairSlots = new Map(pairs.map((pairIndex, slot) => [pairIndex, slot]));
  const maxSheets = duplexAlign ? Math.ceil(pairs.length / capacity.perSheet) : settings.sides === "Both Sides"
    ? Math.max(1, Math.ceil(front.length / capacity.perSheet), Math.ceil(back.length / capacity.perSheet))
    : Math.max(1, Math.ceil((selectedSides[0] === "front" ? front : back).length / capacity.perSheet));
  const pages: CardSheetPage[] = [];
  for (let sheetIndex = 0; sheetIndex < maxSheets; sheetIndex++) {
    for (const side of selectedSides) {
      const list = side === "front" ? front : back;
      const visible = duplexAlign
        ? list.filter((item) => Math.floor(pairSlots.get(item.pairIndex)! / capacity.perSheet) === sheetIndex)
        : list.slice(sheetIndex * capacity.perSheet, (sheetIndex + 1) * capacity.perSheet);
      const placements = visible.map((item, index) => {
        const slot = duplexAlign ? pairSlots.get(item.pairIndex)! : sheetIndex * capacity.perSheet + index;
        const inSheet = slot % capacity.perSheet;
        const row = Math.floor(inSheet / capacity.columns);
        const col = inSheet % capacity.columns;
        const frontX = settings.margin + col * (card.width + settings.gapX);
        return {
          card: item,
          x: duplexAlign && side === "back" ? paper.width - frontX - card.width : frontX,
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
