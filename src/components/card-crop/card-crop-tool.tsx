"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import JSZip from "jszip";
import { degrees, PDFDocument } from "pdf-lib";
import { ChevronDown, CloudUpload, FileText, FolderArchive, FolderOpen, Trash2, ShieldCheck, LoaderCircle, Crop, Eye, EyeOff, Info } from "lucide-react";
import type { CardCropConfig } from "@/tools/card-crop/config";
import { CARD_PAPER_SIZES, arrangeCardSheets, cardDimensions } from "@/tools/card-crop/layout";
import type { CardAppearance, CardCropSettings, NormalizedCrop, ProcessedCard } from "@/tools/card-crop/types";
import { useCardCropStore } from "@/tools/card-crop/store";
import { renderCardImage, processPdfFile, ProtectedPdfError } from "@/tools/card-crop/pdf-processing";
import { writePersistedState } from "@/lib/db";
import { CardCropToolbar } from "@/components/card-crop/card-crop-toolbar";
import { CardPrintWorkspace } from "@/components/card-crop/card-print-workspace";
import { BlobImage } from "@/components/shared/blob-image";
import { CardAppearanceControls } from "@/components/card-crop/card-actions";
import { downloadBlob } from "@/lib/download";

const initialSettings: CardCropSettings = { paper: "A4", enhance: true, sides: "Both Sides", heightMm: 54, gapX: 8, gapY: 8, margin: 8 };
const EMPTY_CARDS: ProcessedCard[] = [];

export function CardCropTool({ config }: { config: CardCropConfig }) {
  const session = useCardCropStore((s) => s.sessions[config.slug]);
  const hydrated = useCardCropStore((s) => s.hydrated);
  const aadhaar = config.slug === "aadhaar-crop" || config.slug === "aadhaar-crop-a4-double-side-glossy";
  const defaults = useMemo<CardCropSettings>(() => ({ ...initialSettings, heightMm: config.heightMm, ...(aadhaar ? { heightMm: 83.3, gapY: 10, border: 1, rounded: false, cropMode: "card", background: "normal", backgroundColor: "#e6f2ff", inlineSides: true } : {}) }), [config.heightMm, aadhaar]);
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
  const [showPassword, setShowPassword] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState("");
  const [activeCropId, setActiveCropId] = useState<string | null>(null);
  const [activeEditTab, setActiveEditTab] = useState<"crop" | "appearance">("crop");
  const [folderMenuOpen, setFolderMenuOpen] = useState(false);
  const [renderBusy, setRenderBusy] = useState(false);
  const [renderRevision, setRenderRevision] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const zipRef = useRef<HTMLInputElement>(null);
  const cropRef = useRef<HTMLDivElement>(null);
  const pendingFilesRef = useRef<File[]>([]);
  const processingRef = useRef(false);
  const awaitingPasswordRef = useRef(false);

  useEffect(() => { void hydrate(); }, [hydrate]);
  useEffect(() => {
    if (hydrated && !session) setSession(config.slug, { config, settings: defaults, cards: [], updatedAt: Date.now() });
  }, [config, defaults, hydrated, session, setSession]);
  const settings = useMemo(() => ({ ...defaults, ...session?.settings }), [defaults, session?.settings]);
  const cards = session?.cards ?? EMPTY_CARDS;
  const activeCard = cards.find((card) => card.id === activeCropId);
  const ratio = settings.cropMode === "full" ? cards[0]?.pageAspectRatio ?? 210 / 297 : settings.manualAspectRatio ?? config.aspectRatio;
  const dimensions = cardDimensions(settings, ratio);
  const duplex = config.duplexGlossy || settings.paper === "4x6-glossy";
  const sheets = useMemo(() => arrangeCardSheets(cards, settings, ratio, duplex), [cards, settings, ratio, duplex]);
  const shown = settings.cropMode === "full" ? sheets.flatMap((sheet) => sheet.placements.map((place) => place.card)) : settings.sides === "Both Sides" ? cards : cards.filter((card) => card.side === (settings.sides === "Front" ? "front" : "back"));
  const renderKey = JSON.stringify([renderRevision, cards.map((card) => [card.id, card.crop, card.appearance]), settings.cropMode, settings.enhance, settings.background, settings.backgroundColor, settings.rounded, settings.border, settings.heightMm, dimensions.height]);
  useEffect(() => {
    let cancelled = false;
    if (!cards.length) { setRenderBusy(false); return; }
    setRenderBusy(true);
    void Promise.all(cards.map(async (card) => ({ id: card.id, image: await renderCardImage(card, settings, dimensions.height) }))).then((results) => {
      if (!cancelled) results.forEach(({ id, image }) => updateCard(config.slug, id, { image }));
    }).catch((error) => { if (!cancelled) setMessage(`Could not update card appearance: ${(error as Error).message}`); }).finally(() => { if (!cancelled) setRenderBusy(false); });
    return () => { cancelled = true; };
  }, [renderKey, aadhaar, config.slug, updateCard]);

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
      if (!next.length) { notify(`No card regions found in ${file.name}. You can still adjust a detected crop manually.`); return true; }
      const existing = useCardCropStore.getState().sessions[config.slug];
      const pairOffset = existing?.cards.length ? Math.max(...existing.cards.map((card) => card.pairIndex)) + 1 : 0;
      const enhanced = await Promise.all(next.map(async (card) => ({ ...card, pairIndex: card.pairIndex + pairOffset, image: await renderCardImage(card, settings, dimensions.height) })));
      if (!existing) setSession(config.slug, { config, settings, cards: enhanced, updatedAt: Date.now() }); else appendCards(config.slug, enhanced);
      await emitCardEvents(enhanced);
      notify(`${enhanced.length} card side${enhanced.length === 1 ? "" : "s"} added from ${file.name}.`);
    } catch (error) {
      if (error instanceof ProtectedPdfError) {
        awaitingPasswordRef.current = true;
        setPasswordPrompt({ file, password: password ?? "", error: error.message });
        return false;
      } else notify(`Could not process ${file.name}: ${(error as Error).message}`);
    } finally { setBusy(""); setProgress(""); }
    return true;
  };

  const processQueue = async (unlock?: { file: File; password: string }) => {
    if (processingRef.current) return;
    processingRef.current = true;
    try {
      if (unlock && !await processFile(unlock.file, unlock.password)) return;
      while (!awaitingPasswordRef.current && pendingFilesRef.current.length) {
        const file = pendingFilesRef.current.shift()!;
        if (!await processFile(file)) break;
      }
    } finally { processingRef.current = false; }
  };

  const handleFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    const pdfs = list.filter((file) => file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf");
    const archives = list.filter((file) => file.name.toLowerCase().endsWith(".zip"));
    if (pdfs.length + archives.length !== list.length) notify("Unsupported file. Choose PDF files or a ZIP containing PDFs.");
    for (const archive of archives) {
      try {
        const zip = await JSZip.loadAsync(archive);
        const entries = Object.values(zip.files).filter((item) => !item.dir && item.name.toLowerCase().endsWith(".pdf"));
        if (!entries.length) notify("No PDF files were found in that ZIP archive.");
        for (const entry of entries) {
          pdfs.push(await entry.async("blob").then((blob) => new File([blob], entry.name.split("/").pop() || "document.pdf", { type: "application/pdf" })));
        }
      } catch (error) { notify(`Could not read ZIP: ${(error as Error).message}`); }
    }
    pendingFilesRef.current.push(...pdfs);
    if (!awaitingPasswordRef.current) await processQueue();
  };
  const onChange = (event: ChangeEvent<HTMLInputElement>) => { if (event.target.files) void handleFiles(event.target.files); event.target.value = ""; };
  const onDrop = (event: DragEvent) => { event.preventDefault(); setDragging(false); void handleFiles(event.dataTransfer.files); };

  const adjustCrop = (card: ProcessedCard, crop: NormalizedCrop) => {
    const x = Math.max(0, Math.min(.98, crop.x)), y = Math.max(0, Math.min(.98, crop.y));
    const bounded = { x, y, width: Math.max(.02, Math.min(1 - x, crop.width)), height: Math.max(.02, Math.min(1 - y, crop.height)) };
    updateCard(config.slug, card.id, { crop: bounded, confidence: 1 });
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

  const update = (patch: Partial<CardCropSettings>) => {
    updateSettings(config.slug, { ...settings, ...patch });
    if (patch.background !== undefined) cards.forEach((card) => updateCard(config.slug, card.id, { appearance: { ...card.appearance, background: undefined } }));
  };
  const updateCardAppearance = (card: ProcessedCard, patch: Partial<CardAppearance>) => updateCard(config.slug, card.id, { appearance: { ...card.appearance, ...patch } });
  const downloadAadhaarStrip = (card: ProcessedCard, index: number) => {
    if (!card.aadhaarStripImage) return;
    downloadBlob(card.aadhaarStripImage, `aadhaar-card-${index + 1}.png`, 1000);
  };
  const removeShownCard = (card: ProcessedCard) => {
    const removing = settings.cropMode === "full" ? cards.filter((item) => item.pageNumber === card.pageNumber && (item.documentId ?? item.sourceName) === (card.documentId ?? card.sourceName)) : [card];
    removing.forEach((item) => removeCard(config.slug, item.id));
    if (removing.some((item) => item.id === activeCropId)) setActiveCropId(null);
  };
  const makePdf = async (open: boolean) => {
    if (!sheets.length) { notify("Upload a PDF before exporting."); return; }
    const previewTab = open ? window.open("about:blank", "_blank") : null;
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
          const width = place.width / 25.4 * 72, height = place.height / 25.4 * 72;
          page.drawImage(img, { x: place.rotation === 180 ? x + width : x, y: place.rotation === 180 ? y + height : y, width, height, rotate: degrees(place.rotation ?? 0) });
        }
      }
      const saved = await output.save();
      const blob = new Blob([new Uint8Array(saved).buffer as ArrayBuffer], { type: "application/pdf" });
      const url = downloadBlob(blob, `${config.slug}-print.pdf`);
      if (previewTab) previewTab.location.href = url;
    } catch (error) { previewTab?.close(); notify(`Export failed: ${(error as Error).message}`); } finally { setBusy(""); }
  };

  const cropCards = <div className={aadhaar ? "grid gap-4" : "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"}>{(aadhaar ? shown.filter((card) => card.id === activeCropId) : shown).map((card) => <article key={card.id} className={`rounded-xl border bg-white p-3 shadow-sm dark:bg-slate-900 ${activeCropId === card.id ? "ring-2 ring-cyan-500" : ""}`}>
              <div ref={activeCropId === card.id ? cropRef : undefined} className={`relative mx-auto w-full overflow-hidden bg-slate-100 ${activeCropId === card.id ? "max-w-[320px]" : "max-w-[180px]"}`} style={{ aspectRatio: activeCropId === card.id ? card.pageAspectRatio ?? 210 / 297 : ratio }} onPointerDown={(event) => activeCropId === card.id && onCropPointerDown(event, card)}>
                {/* page image keeps the crop editable against the original rendered PDF page */}<BlobImage blob={activeCropId === card.id ? card.pageImage : card.image} className="h-full w-full object-fill" alt={activeCropId === card.id ? "Rendered PDF page" : "Cropped card"} />
                {activeCropId === card.id && <div className="absolute border-2 border-cyan-500 bg-cyan-400/10" style={{ left: `${card.crop.x * 100}%`, top: `${card.crop.y * 100}%`, width: `${card.crop.width * 100}%`, height: `${card.crop.height * 100}%`, cursor: activeCropId === card.id ? "move" : "default" }}>
                  {activeCropId === card.id && <button data-resize="true" className="absolute -bottom-1.5 -right-1.5 h-3 w-3 rounded-sm border border-white bg-cyan-600" aria-label="Resize crop"/>}
                </div>}
              </div>
              <div className="mt-3 flex items-center justify-between gap-2"><div className="min-w-0"><p className="truncate text-sm font-medium">{card.sourceName}</p><p className="text-xs text-slate-500">Page {card.pageNumber} · {card.side} · {Math.round(card.confidence * 100)}% match</p></div><button title="Remove card" onClick={() => removeShownCard(card)} className="rounded p-1 text-rose-500"><Trash2 size={16}/></button></div>
              <button disabled={settings.cropMode === "full"} onClick={() => setActiveCropId(activeCropId === card.id ? null : card.id)} className="mt-2 rounded border px-2.5 py-1.5 text-xs"><Crop className="mr-1 inline" size={13}/>{activeCropId === card.id ? "Done adjusting" : "Adjust crop"}</button>
            </article>)}</div>;

  return <main className="min-h-full bg-slate-50 pb-12 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
    <CardCropToolbar settings={settings} aadhaar={aadhaar} hasCards={cards.length > 0} busy={Boolean(busy) || renderBusy || !hydrated} onChange={update} onUpload={() => inputRef.current?.click()} onClear={() => { if (window.confirm("Remove all cards from this queue?")) { clear(config.slug); setActiveCropId(null); } }} onReset={() => { updateSettings(config.slug, defaults); cards.forEach((card) => updateCard(config.slug, card.id, { appearance: undefined })); setActiveCropId(null); }} onRefresh={() => setRenderRevision((value) => value + 1)} onExport={(print) => void makePdf(print)}/>
    {aadhaar && cards.length > 0 ? <CardPrintWorkspace cards={cards} sheets={sheets} settings={settings} busy={Boolean(busy) || renderBusy} onCrop={(card) => { setActiveCropId(card.id); setActiveEditTab("crop"); }} onEdit={(card) => { setActiveCropId(card.id); setActiveEditTab("appearance"); }} onRemoveCard={removeShownCard} onDownloadCard={(card) => downloadBlob(card.image, `aadhaar-${card.side}.png`, 1000)} onChangeCardAppearance={updateCardAppearance} onDownloadCrop={downloadAadhaarStrip} onRemoveDocument={(card) => {
      cards.filter((item) => (item.documentId ?? item.sourceName) === (card.documentId ?? card.sourceName)).forEach((item) => removeCard(config.slug, item.id));
      setActiveCropId(null);
    }}/> : <div className="mx-auto max-w-[1500px] px-4 pt-10 sm:px-8">
      <section className={`text-center ${cards.length ? "mb-8" : "mb-14 mt-14"}`}><h1 className="font-serif text-3xl font-semibold">{config.name} Crop &amp; Print</h1><p className="mt-2 text-sm text-slate-500">Auto crop {config.shortName} from PDF and arrange for printing</p></section>
      {cards.length === 0 ? <div className="mx-auto max-w-[640px]">
        <div role="button" tabIndex={0} aria-label={`Upload ${config.shortName} PDF`} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); inputRef.current?.click(); } }} onClick={() => { if (!busy) inputRef.current?.click(); }} onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop} className={`flex min-h-[320px] cursor-pointer flex-col items-center justify-center rounded-md border-[3px] border-dashed bg-slate-100/80 px-6 text-center shadow-[0_16px_24px_-14px_rgba(15,23,42,.35)] transition dark:bg-slate-900 ${dragging ? "border-cyan-500 bg-cyan-50" : "border-slate-200 hover:border-cyan-400"}`}>
          {busy ? <LoaderCircle className="mb-4 animate-spin text-cyan-600" size={48} /> : <CloudUpload className="mb-4" size={54} strokeWidth={1.8} />}
          <h2 className="text-2xl font-semibold">Upload {config.shortName} PDF</h2><p className="mt-4 text-sm text-slate-500">Supported formats: .pdf</p><p className="mt-4 text-xs text-slate-400">Press Ctrl + V to paste a file</p>
          {progress && <p className="mt-3 text-xs text-cyan-700">{progress}</p>}
        </div>
        <div className="relative mx-auto mt-12 w-fit"><button type="button" aria-expanded={folderMenuOpen} onClick={() => setFolderMenuOpen((open) => !open)} disabled={Boolean(busy) || renderBusy} className="inline-flex items-center gap-2 rounded-lg border bg-transparent px-4 py-2.5 text-xs text-slate-500"><FolderOpen size={15}/>Upload Folder or ZIP<ChevronDown size={13}/></button>{folderMenuOpen && <div className="absolute left-0 top-full z-30 mt-1 w-full rounded-lg border bg-white p-1 shadow-lg dark:bg-slate-900"><button type="button" onClick={() => { setFolderMenuOpen(false); folderRef.current?.click(); }} className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-800"><FolderOpen size={14}/>Upload Folder</button><button type="button" onClick={() => { setFolderMenuOpen(false); zipRef.current?.click(); }} className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-800"><FolderArchive size={14}/>Upload ZIP</button></div>}</div>
        <p className="mt-12 text-center"><span className="inline-flex items-center justify-center gap-1 rounded-full border border-cyan-200 bg-cyan-50/60 px-4 py-2 text-xs text-cyan-700 dark:border-cyan-900 dark:bg-cyan-950/30 dark:text-cyan-300"><ShieldCheck className="mr-2 inline" size={14}/>100% Client-Side Processing · Your files never leave your device</span></p>
      </div> : <>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-5">

            <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Card queue <span className="text-slate-400">({shown.length})</span></h2><p className="text-xs text-slate-500">{dimensions.width.toFixed(1)} × {dimensions.height.toFixed(1)} mm · {sheets.length} print sides</p></div>
            {cropCards}
            <div className="rounded-xl border bg-white p-5 dark:bg-slate-900"><div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">Print preview</h3><span className="text-xs text-slate-500">{settings.paper} layout · exact-size export</span></div><div className="flex flex-wrap justify-center gap-5">{sheets.map((sheet, index) => { const paper = CARD_PAPER_SIZES[settings.paper]; return <div key={`${sheet.side}-${sheet.sheetIndex}`} data-card-paper={settings.paper} className="min-w-[100px] border border-slate-300 bg-white shadow" style={{ width: `${Math.min(260, paper.width / paper.height * 260)}px`, aspectRatio: `${paper.width}/${paper.height}` }}><div className="relative h-full w-full">{sheet.placements.map((place) => <BlobImage key={place.card.id} blob={place.card.image} className="absolute object-fill" style={{ left: `${place.x / paper.width * 100}%`, top: `${place.y / paper.height * 100}%`, width: `${place.width / paper.width * 100}%`, height: `${place.height / paper.height * 100}%` }} alt="Card print placement"/>)}<span className="absolute bottom-0 right-1 text-[9px] text-slate-400">{sheet.side} {index + 1}</span></div></div>; })}</div></div>
          </div>
          <aside className="h-fit rounded-xl border bg-white p-4 dark:bg-slate-900"><h3 className="mb-3 font-semibold">Detected cards</h3><p className="mb-4 text-xs text-slate-500">Auto detection is checked against {config.shortName}&apos;s {config.aspectRatio.toFixed(2)}:1 aspect ratio. Select a card to drag its crop box or use the corner handle to resize.</p>{cards.map((card) => <div key={card.id} className="mb-2 flex items-center gap-2 rounded-lg border p-2"><FileText size={16} className="shrink-0 text-cyan-700"/><span className="min-w-0 flex-1 truncate text-xs">{card.sourceName} · p.{card.pageNumber} · {card.side}</span><button onClick={() => setActiveCropId(card.id)} className="text-xs text-cyan-700">Edit</button></div>)}<div className="mt-5 rounded-lg bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-800">{duplex ? "Duplex glossy alignment is enabled; back-side columns are mirrored for two-sided printing." : `Front/back pages pair by sequence. ${config.sides === 2 ? "Both sides are included." : "This card is single-sided."}`}</div></aside>
        </div>
      </>}
    </div>}
    {aadhaar && activeCard && <div role="dialog" aria-modal="true" aria-label={activeEditTab === "crop" ? "Adjust card crop" : "Edit card"} className="fixed inset-0 z-[60] grid place-items-center overflow-auto bg-black/50 p-5"><div className="w-full max-w-md rounded-xl bg-white p-4 dark:bg-slate-950"><div className="mb-4 flex items-center gap-2"><button type="button" disabled={settings.cropMode === "full"} aria-pressed={activeEditTab === "crop"} onClick={() => setActiveEditTab("crop")} className={`rounded border px-3 py-1.5 text-xs ${activeEditTab === "crop" ? "bg-slate-100 dark:bg-slate-800" : ""}`}>Crop</button><button type="button" aria-pressed={activeEditTab === "appearance"} onClick={() => setActiveEditTab("appearance")} className={`rounded border px-3 py-1.5 text-xs ${activeEditTab === "appearance" ? "bg-slate-100 dark:bg-slate-800" : ""}`}>Edit</button><button type="button" onClick={() => setActiveCropId(null)} className="ml-auto rounded border px-3 py-1.5 text-xs">Close crop editor</button></div>{activeEditTab === "crop" ? cropCards : <><BlobImage blob={activeCard.image} alt="Selected card preview" className="mb-4 h-auto w-full"/><div role="group" aria-label="Card appearance" className="overflow-hidden rounded border"><CardAppearanceControls card={activeCard} settings={settings} busy={Boolean(busy) || renderBusy} onChange={(patch) => updateCardAppearance(activeCard, patch)}/></div></>}</div></div>}


    <input ref={inputRef} type="file" accept="application/pdf,.pdf,.zip" multiple className="hidden" onChange={onChange}/>
    <input ref={folderRef} type="file" accept="application/pdf,.pdf" multiple className="hidden" {...({ webkitdirectory: "", directory: "" } as object)} onChange={onChange}/>
    <input ref={zipRef} type="file" accept=".zip,application/zip" multiple className="hidden" onChange={onChange}/>
    {cards.length > 0 && sheets.length === 0 && <p role="alert" className="mx-8 mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">The card does not fit this paper. Reduce Height or gaps, or choose a larger paper size.</p>}
    {message && <div role="status" className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-slate-900 px-4 py-3 text-sm text-white shadow-xl">{message}</div>}
    {passwordPrompt && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><form onSubmit={(e) => { e.preventDefault(); const { file, password } = passwordPrompt; setPasswordPrompt(null); awaitingPasswordRef.current = false; void processQueue({ file, password }); }} className="w-full max-w-sm rounded-xl bg-white p-6 text-slate-900 shadow-2xl"><h2 className="font-semibold">PDF password required</h2><p className="mt-2 text-sm text-slate-500">{passwordPrompt.error}</p><div className="mt-3 flex gap-2 rounded-lg border border-violet-200 bg-violet-50 p-3 text-xs text-violet-900"><Info size={16} className="mt-0.5 shrink-0 text-violet-600"/><div><p className="font-semibold">Aadhaar password hint</p><p className="mt-1">First 4 letters of name in CAPITALS + year of birth</p><p className="mt-1 text-violet-700">Example: Name <b>RAJVEER</b>, DOB <b>2004</b> → <b className="font-mono">RAJV2004</b></p></div></div><div className="relative mt-4"><input autoFocus type={showPassword ? "text" : "password"} value={passwordPrompt.password} onChange={(e) => setPasswordPrompt({ ...passwordPrompt, password: e.target.value })} className="w-full rounded border px-3 py-2 pr-10" placeholder="e.g. RAJV2004" autoComplete="off" autoCapitalize="characters" spellCheck={false}/><button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Hide password" : "Show password"} title={showPassword ? "Hide password" : "Show password"} className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-500 hover:text-slate-900">{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div><div className="mt-4 flex justify-end gap-2"><button type="button" className="rounded border px-3 py-2 text-sm" onClick={() => { setPasswordPrompt(null); awaitingPasswordRef.current = false; void processQueue(); }}>Cancel</button><button className="rounded bg-slate-900 px-3 py-2 text-sm text-white">Unlock PDF</button></div></form></div>}
    {(busy || renderBusy) && <div className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs text-white shadow"><LoaderCircle size={14} className="animate-spin"/>{progress || busy || "Updating preview..."}</div>}
  </main>;
}

