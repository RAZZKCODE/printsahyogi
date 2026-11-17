"use client";

import { useState } from "react";
import { Download, Trash2 } from "lucide-react";
import { BlobImage } from "@/components/shared/blob-image";
import { CARD_PAPER_SIZES, type CardSheetPage } from "@/tools/card-crop/layout";
import type { CardAppearance, CardCropSettings, ProcessedCard } from "@/tools/card-crop/types";
import { CardActions } from "@/components/card-crop/card-actions";

type Props = {
  cards: ProcessedCard[];
  sheets: CardSheetPage[];
  settings: CardCropSettings;
  busy: boolean;
  onRemoveDocument: (card: ProcessedCard) => void;
  onEdit: (card: ProcessedCard) => void;
  onCrop: (card: ProcessedCard) => void;
  onRemoveCard: (card: ProcessedCard) => void;
  onDownloadCard: (card: ProcessedCard) => void;
  onChangeCardAppearance: (card: ProcessedCard, patch: Partial<CardAppearance>) => void;
  onDownloadCrop: (card: ProcessedCard, index: number) => void;
};

export function CardPrintWorkspace({ cards, sheets, settings, busy, onRemoveDocument, onEdit, onCrop, onRemoveCard, onDownloadCard, onChangeCardAppearance, onDownloadCrop }: Props) {
  const documents = cards.filter((card, index) => cards.findIndex((other) => (other.documentId ?? other.sourceName) === (card.documentId ?? card.sourceName)) === index);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [menuCardId, setMenuCardId] = useState<string | null>(null);
  const selected = documents.find((card) => card.id === selectedId) ?? documents[0];
  const paper = CARD_PAPER_SIZES[settings.paper];
  return <section className="flex min-h-[calc(100dvh-6rem)]" aria-label="Aadhaar print workspace">
    <aside aria-label="Uploaded PDF files" className="w-[100px] shrink-0 bg-slate-200/90 pb-8 pt-3 sm:w-[128px] dark:bg-slate-900">
      <div className="mb-7 flex justify-center"><button type="button" title="Remove selected PDF" aria-label="Remove selected PDF" disabled={!selected || busy} onClick={() => selected && onRemoveDocument(selected)} className="grid h-11 w-11 place-items-center bg-red-500 text-white shadow-sm hover:bg-red-600 disabled:opacity-40"><Trash2 size={17}/></button></div>
      {documents.map((card, index) => <div key={card.id} className="mx-2 mb-6 text-center sm:mx-4">
        <button type="button" aria-label={`Select PDF ${index + 1}`} aria-pressed={selected?.id === card.id} onClick={() => setSelectedId(card.id)} className={`mx-auto block w-full max-w-[88px] border bg-white p-1 shadow-sm ${selected?.id === card.id ? "border-slate-400" : "border-transparent"}`}><BlobImage blob={card.pageImage} alt={`Source PDF ${index + 1}`} className="h-auto w-full"/></button>
        <p className="mt-2 text-[11px] text-teal-700 dark:text-teal-300">Ready</p><p title={card.sourceName} className="mt-1 line-clamp-2 break-all text-[10px] text-slate-500">{card.sourceName}</p>
        {card.aadhaarStripImage && <button type="button" title="Download cropped card PNG" aria-label={`Download cropped card PNG ${index + 1}`} onClick={() => onDownloadCrop(card, index)} className="mt-2 rounded p-1 text-slate-500 hover:bg-white/60"><Download size={14}/></button>}
      </div>)}
    </aside>
    <div aria-label="Print preview" role="region" className="flex min-w-0 flex-1 flex-col items-center gap-7 overflow-hidden px-3 py-5 sm:px-8">
      {!sheets.length && <p role="alert" className="rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">The card does not fit this paper. Reduce Height or gaps, or choose a larger paper size.</p>}
      {sheets.map((sheet, pageIndex) => <div key={`${sheet.side}-${sheet.sheetIndex}-${pageIndex}`} className="flex max-w-full flex-col items-center" style={{ width: paper.width * 3.3 }}>
        {settings.paper === "PVC" && <p className="mb-2 text-[11px] text-slate-500"><span className="mr-2 rounded bg-slate-200 px-1.5 py-0.5 font-medium dark:bg-slate-800">PVC</span>Card {sheet.sheetIndex + 1} — {sheet.side === "front" ? "Front" : "Back"} Side</p>}
        <div data-card-paper={settings.paper} aria-label={`Print page ${pageIndex + 1}`} className={`relative w-full shrink-0 border border-slate-200 bg-white shadow-[0_8px_18px_-8px_rgba(15,23,42,.25)] ${settings.paper === "PVC" ? "rounded-lg" : ""}`} style={{ aspectRatio: `${paper.width}/${paper.height}` }}>
          {sheet.placements.map((place) => <div key={place.card.id} data-card-side={place.card.side} data-rotation={place.rotation ?? 0} tabIndex={0} role="group" aria-label={`${place.card.side} card`} onClick={() => setSelectedCardId(place.card.id)} onFocus={() => setSelectedCardId(place.card.id)} onDoubleClick={() => settings.cropMode !== "full" && onCrop(place.card)} onContextMenu={(event) => { event.preventDefault(); setSelectedCardId(place.card.id); setMenuCardId(place.card.id); }} title="Double-click to adjust crop" className="group absolute outline-none focus-visible:ring-2 focus-visible:ring-cyan-500" style={{ zIndex: menuCardId === place.card.id ? 30 : selectedCardId === place.card.id ? 10 : undefined, left: `${place.x / paper.width * 100}%`, top: `${place.y / paper.height * 100}%`, width: `${place.width / paper.width * 100}%`, height: `${place.height / paper.height * 100}%` }}>
            <BlobImage blob={place.card.image} alt={`${place.card.side === "front" ? "Front" : "Back"} card print placement`} className="h-full w-full object-fill" style={{ transform: `rotate(${place.rotation ?? 0}deg)` }}/>
            <CardActions card={place.card} settings={settings} busy={busy} active={selectedCardId === place.card.id} open={menuCardId === place.card.id} canCrop={settings.cropMode !== "full"} onOpenChange={(open) => setMenuCardId(open ? place.card.id : null)} onRemove={() => onRemoveCard(place.card)} onCrop={() => onCrop(place.card)} onDownload={() => onDownloadCard(place.card)} onEdit={() => onEdit(place.card)} onChange={(patch) => onChangeCardAppearance(place.card, patch)}/>

          </div>)}
        </div>
        <div className="mt-6 flex w-full items-center gap-2 text-[11px] font-semibold text-slate-600 dark:text-slate-400"><span className="min-w-0 flex-1 border-t-2 border-dotted border-slate-500"/><span>End of page</span><span className="min-w-0 flex-1 border-t-2 border-dotted border-slate-500"/></div>
      </div>)}
    </div>
  </section>;
}
