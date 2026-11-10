"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import JSZip from "jszip";
import { PDFDocument, rgb } from "pdf-lib";
import { CloudUpload, FileText, FolderArchive, Printer, RotateCcw, Download, Trash2, ShieldCheck, LoaderCircle, Crop } from "lucide-react";
import type { CardCropConfig } from "@/tools/card-crop/config";
import { CARD_PAPER_SIZES, arrangeCardSheets, cardDimensions } from "@/tools/card-crop/layout";
import type { CardCropSettings, NormalizedCrop, ProcessedCard } from "@/tools/card-crop/types";
import { useCardCropStore } from "@/tools/card-crop/store";
import { cropPageImage, processPdfFile, ProtectedPdfError } from "@/tools/card-crop/pdf-processing";
import { writePersistedState } from "@/lib/db";

const initialSettings: CardCropSettings = { paper: "A4", enhance: true, sides: "Both Sides", heightMm: 54, gapX: 8, gapY: 8, margin: 8 };
const cardPx = (mm: number) => mm * 96 / 25.4;

export function CardCropTool({ config }: { config: CardCropConfig }) {
  const session = useCardCropStore((s) => s.sessions[config.slug]);
  const hydrate = useCardCropStore((s) => s.hydrate);
  const setSession = useCardCropStore((s) => s.setSession);
  const updateSettings = useCardCropStore((s) => s.updateSettings);
  const updateCard = useCardCropStore((s) => s.updateCard);
  const appendCards = useCardCropStore((s) => s.appendCards);
  const removeCard = useCardCropStore((s) => s.removeCard);
  const clear = useCardCropStore((s) => s.clear);
  const [busy, setBusy] = useState("");
  const [progress, setProgress] = useState("");
  const [passwordPrompt, setPasswordPrompt] = useState<{ file: File; password: string; error: string } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState("");
  const [activeCropId, setActiveCropId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const zipRef = useRef<HTMLInputElement>(null);
  const cropRef = useRef<HTMLDivElement>(null);

  useEffect(() => { void hydrate(); }, [hydrate]);
  useEffect(() => {
    if (!session) setSession(config.slug, { config, settings: { ...initialSettings, heightMm: config.heightMm }, cards: [], updatedAt: Date.now() });
  }, [config, session, setSession]);
  const settings = session?.settings ?? { ...initialSettings, heightMm: config.heightMm };
  const cards = session?.cards ?? [];
  const ratio = settings.manualAspectRatio ?? config.aspectRatio;
  const dimensions = cardDimensions(settings, ratio);
  const sheets = useMemo(() => arrangeCardSheets(cards, settings, ratio, config.duplexGlossy), [cards, settings, ratio, config.duplexGlossy]);
  const shown = settings.sides === "Both Sides" ? cards : cards.filter((card) => card.side === (settings.sides === "Front" ? "front" : "back"));

  const notify = (text: string) => { setMessage(text); window.setTimeout(() => setMessage(""), 3500); };
  useEffect(() => {
    const pastePdf = (event: ClipboardEvent) => {
      const files = Array.from(event.clipboardData?.files ?? []).filter((file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));
      if (files.length) { event.preventDefault(); void handleFiles(files); }
    };
    window.addEventListener("paste", pastePdf);
    return () => window.removeEventListener("paste", pastePdf);
  });
  const emitCardEvents = async (items: ProcessedCard[]) => {
    const events = items.map((card) => ({ id: card.id, type: "card-processed", tool: config.slug, cardName: config.name, source: card.sourceName, page: card.pageNumber, side: card.side, timestamp: Date.now(), count: 1 }));
    for (const event of events) window.dispatchEvent(new CustomEvent("papermitra:card-processed", { detail: event }));
    try {
      const { readPersistedState } = await import("@/lib/db");
      const previous = (await readPersistedState<typeof events>("dashboard-card-events")) ?? [];
      await writePersistedState("dashboard-card-events", [...previous, ...events]);
    } catch { /* Dashboard can consume the in-memory event when storage is unavailable. */ }
  };

  const processFile = async (file: File, password?: string) => {
    setBusy(`Reading ${file.name}`);
    try {
      const next = await processPdfFile(file, config, password, (page, total) => setProgress(`Rendering page ${page} of ${total} · ${file.name}`));
      if (!next.length) { notify(`No card regions found in ${file.name}. You can still adjust a detected crop manually.`); return; }
      const enhanced = await Promise.all(next.map(async (card) => ({ ...card, image: await cropPageImage(card.pageImage, card.crop, settings.enhance) })));
      const existing = useCardCropStore.getState().sessions[config.slug];
      if (!existing) setSession(config.slug, { config, settings, cards: enhanced, updatedAt: Date.now() }); else appendCards(config.slug, enhanced);
      await emitCardEvents(enhanced);
      notify(`${enhanced.length} card side${enhanced.length === 1 ? "" : "s"} added from ${file.name}.`);
    } catch (error) {
      if (error instanceof ProtectedPdfError) {
        setPasswordPrompt({ file, password: password ?? "", error: error.message });
      } else notify(`Could not process ${file.name}: ${(error as Error).message}`);
    } finally { setBusy(""); setProgress(""); }
  };

  const handleFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    const pdfs = list.filter((file) => file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf");
    const archives = list.filter((file) => file.name.toLowerCase().endsWith(".zip"));
    if (pdfs.length + archives.length !== list.length) notify("Unsupported file. Choose PDF files or a ZIP containing PDFs.");
    for (const archive of archives) {
      try {
        const zip = await JSZip.loadAsync(archive);
        for (const entry of Object.values(zip.files).filter((item) => !item.dir && item.name.toLowerCase().endsWith(".pdf"))) {
          await processFile(await entry.async("blob").then((blob) => new File([blob], entry.name.split("/").pop() || "document.pdf", { type: "application/pdf" })));
        }
      } catch (error) { notify(`Could not read ZIP: ${(error as Error).message}`); }
    }
    for (const pdf of pdfs) await processFile(pdf);
  };
  const onChange = (event: ChangeEvent<HTMLInputElement>) => { if (event.target.files) void handleFiles(event.target.files); event.target.value = ""; };
  const onDrop = (event: DragEvent) => { event.preventDefault(); setDragging(false); void handleFiles(event.dataTransfer.files); };

  const adjustCrop = async (card: ProcessedCard, crop: NormalizedCrop) => {
    const bounded = { x: Math.max(0, Math.min(.98, crop.x)), y: Math.max(0, Math.min(.98, crop.y)), width: Math.max(.02, Math.min(1 - crop.x, crop.width)), height: Math.max(.02, Math.min(1 - crop.y, crop.height)) };
    updateCard(config.slug, card.id, { crop: bounded, confidence: 1 });
    const image = await cropPageImage(card.pageImage, bounded, settings.enhance);
    updateCard(config.slug, card.id, { image });
  };
  const onCropPointerDown = (event: React.PointerEvent<HTMLDivElement>, card: ProcessedCard) => {
    const root = cropRef.current; if (!root) return;
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
    const rect = root.getBoundingClientRect(); const startX = event.clientX; const startY = event.clientY; const start = card.crop;
    const resize = (event.target as HTMLElement).dataset.resize === "true";
    const move = (pointer: PointerEvent) => {
      const dx = (pointer.clientX - startX) / rect.width, dy = (pointer.clientY - startY) / rect.height;
      void adjustCrop(card, resize ? { ...start, width: start.width + dx, height: start.height + dy } : { ...start, x: start.x + dx, y: start.y + dy });
    };
    const end = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", end); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", end, { once: true });
  };

  const update = (patch: Partial<CardCropSettings>) => updateSettings(config.slug, { ...settings, ...patch });
  const makePdf = async (open: boolean) => {
    if (!sheets.length) { notify("Upload a PDF before exporting."); return; }
    setBusy("Building print PDF…");
    try {
      const output = await PDFDocument.create();
      const pageSize = CARD_PAPER_SIZES[settings.paper];
      for (const sheet of sheets) {
        const page = output.addPage([pageSize.width / 25.4 * 72, pageSize.height / 25.4 * 72]);
        for (const place of sheet.placements) {
          const bytes = await place.card.image.arrayBuffer();
          const img = await output.embedPng(bytes);
          const x = place.x / 25.4 * 72, y = (pageSize.height - place.y - place.height) / 25.4 * 72;
          page.drawImage(img, { x, y, width: place.width / 25.4 * 72, height: place.height / 25.4 * 72 });
          page.drawRectangle({ x, y, width: place.width / 25.4 * 72, height: place.height / 25.4 * 72, borderWidth: .2, borderColor: rgb(.25, .25, .25) });
        }
      }
      const saved = await output.save();
      const blob = new Blob([new Uint8Array(saved).buffer as ArrayBuffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      if (open) { window.open(url, "_blank", "noopener,noreferrer"); }
      const anchor = window.document.createElement("a"); anchor.href = url; anchor.download = `${config.slug}-print.pdf`; anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) { notify(`Export failed: ${(error as Error).message}`); } finally { setBusy(""); }
  };

  return <main className="min-h-[calc(100vh-2rem)] bg-slate-50 px-4 pb-12 pt-10 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:px-8">
    <div className="mx-auto max-w-[1500px]">
      <section className="mb-8 text-center"><h1 className="font-serif text-3xl font-semibold">{config.shortName} Crop &amp; Print</h1><p className="mt-2 text-sm text-slate-500">Auto crop {config.shortName} from PDF and arrange for printing</p></section>
      {cards.length === 0 ? <div className="mx-auto max-w-2xl">
        <div onClick={() => inputRef.current?.click()} onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop} className={`flex min-h-[290px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed bg-white px-6 text-center shadow-sm transition dark:bg-slate-900 ${dragging ? "border-cyan-500 bg-cyan-50" : "border-slate-200 hover:border-cyan-400"}`}>
          {busy ? <LoaderCircle className="mb-4 animate-spin text-cyan-600" size={48} /> : <CloudUpload className="mb-4" size={54} strokeWidth={1.8} />}
          <h2 className="text-2xl font-semibold">Upload {config.shortName} PDF</h2><p className="mt-4 text-sm text-slate-500">Supported formats: .pdf</p><p className="mt-4 text-xs text-slate-400">Press Ctrl + V to paste a file</p>
          {progress && <p className="mt-3 text-xs text-cyan-700">{progress}</p>}
        </div>
        <div className="mt-6 flex justify-center gap-3"><button onClick={() => folderRef.current?.click()} className="rounded-lg border bg-white px-4 py-2 text-sm shadow-sm dark:bg-slate-900"><FolderArchive className="mr-2 inline" size={16}/> Upload Folder</button><button onClick={() => zipRef.current?.click()} className="rounded-lg border bg-white px-4 py-2 text-sm shadow-sm dark:bg-slate-900">Upload ZIP</button></div>
        <p className="mt-12 text-center"><span className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs text-emerald-700"><ShieldCheck className="mr-2 inline" size={14}/>100% Client-Side Processing · Your files never leave your device</span></p>
      </div> : <>
        <div className="sticky top-0 z-20 mb-5 flex flex-wrap items-center gap-2 rounded-xl border bg-white/95 p-3 shadow-sm backdrop-blur dark:bg-slate-900/95">
          <button title="Remove all" onClick={() => { if (window.confirm("Remove all cards from this queue?")) { clear(config.slug); setActiveCropId(null); } }} className="rounded border p-2 text-rose-600"><Trash2 size={17}/></button>
          <button onClick={() => void makePdf(true)} className="rounded border px-3 py-2 text-sm"><Printer className="mr-2 inline" size={16}/>Print</button>
          <button onClick={() => void makePdf(false)} className="rounded border px-3 py-2 text-sm"><Download className="mr-2 inline" size={16}/>Download PDF</button>
          <button onClick={() => inputRef.current?.click()} className="rounded border px-3 py-2 text-sm">+ Add PDF</button>
          <label className="ml-1 flex items-center gap-2 text-xs"><input type="checkbox" checked={settings.enhance} onChange={(e) => { const enhance = e.target.checked; update({ enhance }); void Promise.all(cards.map(async (card) => updateCard(config.slug, card.id, { image: await cropPageImage(card.pageImage, card.crop, enhance) }))); }}/>Enhance</label>
          <select className="rounded border bg-transparent px-2 py-2 text-sm" value={settings.sides} onChange={(e) => update({ sides: e.target.value as CardCropSettings["sides"] })}><option>Front</option><option>Back</option><option>Both Sides</option></select>
          <select className="rounded border bg-transparent px-2 py-2 text-sm" value={settings.paper} onChange={(e) => update({ paper: e.target.value as CardCropSettings["paper"] })}><option>A4</option><option>A5</option><option>Letter</option></select>
          <label className="text-xs">Height cm <input className="ml-1 w-16 rounded border bg-transparent px-2 py-1.5" type="number" step=".1" value={(settings.heightMm / 10).toFixed(2)} onChange={(e) => update({ heightMm: Math.max(5, Number(e.target.value) * 10) })}/></label>
          <label className="text-xs">Gap X <input className="ml-1 w-14 rounded border bg-transparent px-2 py-1.5" type="number" value={settings.gapX} onChange={(e) => update({ gapX: Math.max(0, Number(e.target.value)) })}/></label>
          <label className="text-xs">Gap Y <input className="ml-1 w-14 rounded border bg-transparent px-2 py-1.5" type="number" value={settings.gapY} onChange={(e) => update({ gapY: Math.max(0, Number(e.target.value)) })}/></label>
          <button onClick={() => { clear(config.slug); setActiveCropId(null); }} className="ml-auto rounded border px-3 py-2 text-sm"><RotateCcw className="mr-1 inline" size={14}/>Reset</button>
        </div>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Card queue <span className="text-slate-400">({shown.length})</span></h2><p className="text-xs text-slate-500">{dimensions.width.toFixed(1)} × {dimensions.height.toFixed(1)} mm · {sheets.length} print sides</p></div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{shown.map((card) => <article key={card.id} className={`rounded-xl border bg-white p-3 shadow-sm dark:bg-slate-900 ${activeCropId === card.id ? "ring-2 ring-cyan-500" : ""}`}>
              <div ref={activeCropId === card.id ? cropRef : undefined} className="relative mx-auto aspect-[1.58] max-h-64 w-full overflow-hidden bg-slate-100" onPointerDown={(event) => activeCropId === card.id && onCropPointerDown(event, card)}>
                {/* page image keeps the crop editable against the original rendered PDF page */}<BlobImage blob={card.pageImage} className="h-full w-full object-fill" alt="Rendered PDF page" />
                <div className="absolute border-2 border-cyan-500 bg-cyan-400/10" style={{ left: `${card.crop.x * 100}%`, top: `${card.crop.y * 100}%`, width: `${card.crop.width * 100}%`, height: `${card.crop.height * 100}%`, cursor: activeCropId === card.id ? "move" : "default" }}>
                  {activeCropId === card.id && <button data-resize="true" onPointerDown={(e) => e.stopPropagation()} className="absolute -bottom-1.5 -right-1.5 h-3 w-3 rounded-sm border border-white bg-cyan-600" aria-label="Resize crop"/>}
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2"><div className="min-w-0"><p className="truncate text-sm font-medium">{card.sourceName}</p><p className="text-xs text-slate-500">Page {card.pageNumber} · {card.side} · {Math.round(card.confidence * 100)}% match</p></div><button title="Remove card" onClick={() => removeCard(config.slug, card.id)} className="rounded p-1 text-rose-500"><Trash2 size={16}/></button></div>
              <button onClick={() => setActiveCropId(activeCropId === card.id ? null : card.id)} className="mt-2 rounded border px-2.5 py-1.5 text-xs"><Crop className="mr-1 inline" size={13}/>{activeCropId === card.id ? "Done adjusting" : "Adjust crop"}</button>
            </article>)}</div>
            <div className="rounded-xl border bg-white p-5 dark:bg-slate-900"><div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">Print preview</h3><span className="text-xs text-slate-500">{settings.paper} layout · exact-size export</span></div><div className="flex flex-wrap justify-center gap-5">{sheets.map((sheet, index) => { const paper = CARD_PAPER_SIZES[settings.paper]; return <div key={`${sheet.side}-${sheet.sheetIndex}`} className="min-w-[170px] border border-slate-300 bg-white p-1 shadow" style={{ width: `${Math.min(260, paper.width / paper.height * 260)}px`, aspectRatio: `${paper.width}/${paper.height}` }}><div className="relative h-full w-full">{sheet.placements.map((place) => <BlobImage key={place.card.id} blob={place.card.image} className="absolute border border-slate-500 object-fill" style={{ left: `${place.x / paper.width * 100}%`, top: `${place.y / paper.height * 100}%`, width: `${place.width / paper.width * 100}%`, height: `${place.height / paper.height * 100}%` }} alt="Card print placement"/>)}<span className="absolute bottom-0 right-1 text-[9px] text-slate-400">{sheet.side} {index + 1}</span></div></div>; })}</div></div>
          </div>
          <aside className="h-fit rounded-xl border bg-white p-4 dark:bg-slate-900"><h3 className="mb-3 font-semibold">Detected cards</h3><p className="mb-4 text-xs text-slate-500">Auto detection is checked against {config.shortName}&apos;s {config.aspectRatio.toFixed(2)}:1 aspect ratio. Select a card to drag its crop box or use the corner handle to resize.</p>{cards.map((card) => <div key={card.id} className="mb-2 flex items-center gap-2 rounded-lg border p-2"><FileText size={16} className="shrink-0 text-cyan-700"/><span className="min-w-0 flex-1 truncate text-xs">{card.sourceName} · p.{card.pageNumber} · {card.side}</span><button onClick={() => setActiveCropId(card.id)} className="text-xs text-cyan-700">Edit</button></div>)}<div className="mt-5 rounded-lg bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-800">{config.duplexGlossy ? "Duplex glossy alignment is enabled; back-side columns are mirrored for two-sided printing." : `Front/back pages pair by sequence. ${config.sides === 2 ? "Both sides are included." : "This card is single-sided."}`}</div></aside>
        </div>
      </>}
    </div>

    <input ref={inputRef} type="file" accept="application/pdf,.pdf,.zip" multiple className="hidden" onChange={onChange}/>
    <input ref={folderRef} type="file" accept="application/pdf,.pdf" multiple className="hidden" {...({ webkitdirectory: "", directory: "" } as object)} onChange={onChange}/>
    <input ref={zipRef} type="file" accept=".zip,application/zip" multiple className="hidden" onChange={onChange}/>
    {message && <div role="status" className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-slate-900 px-4 py-3 text-sm text-white shadow-xl">{message}</div>}
    {passwordPrompt && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><form onSubmit={(e) => { e.preventDefault(); const { file, password } = passwordPrompt; setPasswordPrompt(null); void processFile(file, password); }} className="w-full max-w-sm rounded-xl bg-white p-6 text-slate-900 shadow-2xl"><h2 className="font-semibold">PDF password required</h2><p className="mt-2 text-sm text-slate-500">{passwordPrompt.error}</p><input autoFocus type="password" value={passwordPrompt.password} onChange={(e) => setPasswordPrompt({ ...passwordPrompt, password: e.target.value })} className="mt-4 w-full rounded border px-3 py-2" placeholder="Enter PDF password"/><div className="mt-4 flex justify-end gap-2"><button type="button" className="rounded border px-3 py-2 text-sm" onClick={() => setPasswordPrompt(null)}>Cancel</button><button className="rounded bg-slate-900 px-3 py-2 text-sm text-white">Unlock PDF</button></div></form></div>}
    {busy && <div className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs text-white shadow"><LoaderCircle size={14} className="animate-spin"/>{progress || busy}</div>}
  </main>;
}

function BlobImage({ blob, className, style, alt }: { blob: Blob; className?: string; style?: React.CSSProperties; alt: string }) {
  const [url, setUrl] = useState("");
  useEffect(() => { const next = URL.createObjectURL(blob); setUrl(next); return () => URL.revokeObjectURL(next); }, [blob]);
  return url ? <img src={url} className={className} style={style} alt={alt}/> : <span className={className} style={style} aria-label={alt}/>;
}
