"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CloudUpload, Download, ImagePlus, LoaderCircle, Lock, Printer, RotateCcw, Trash2, X } from "lucide-react";
import { useUploadStore } from "@/tools/upload/store";
import { PAPER_SIZES, type PaperSize } from "@/tools/sheet/layout";
import {
  DEFAULT_COLLAGE_SETTINGS, PER_PAGE_PRESETS, collagePaper, layoutCollage,
  type CollageSettings, type Size
} from "@/tools/collage/layout";
import { createCollagePdf, renderCollagePages } from "@/tools/collage/export";
import { printImagePages } from "@/lib/print-pages";

const TOOL_ID = "collage";
const SETTINGS_KEY = "printsahyogi-collage-settings";
const PX_PER_MM_100 = 96 / 25.4;
const RULER = 22;

export function CollageWorkspace() {
  const hydrated = useUploadStore((s) => s.hydrated);
  const files = useUploadStore((s) => s.sessions[TOOL_ID]?.files) ?? EMPTY_FILES;
  const setFiles = useUploadStore((s) => s.setFiles);
  const appendFiles = useUploadStore((s) => s.appendFiles);
  const clearFiles = useUploadStore((s) => s.clearFiles);
  const reorderFiles = useUploadStore((s) => s.reorderFiles);

  const [settings, setSettings] = useState<CollageSettings>(DEFAULT_COLLAGE_SETTINGS);
  const [settingsReady, setSettingsReady] = useState(false);
  const [urls, setUrls] = useState<string[]>([]);
  const [sizes, setSizes] = useState<Array<Size | null>>([]);
  const [zoomMode, setZoomMode] = useState<"fit" | "actual">("fit");
  const [fitScale, setFitScale] = useState(2);
  const [busy, setBusy] = useState<"" | "print" | "download">("");
  const [notice, setNotice] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null);
  const [fileDragging, setFileDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  // Settings persistence (per browser)
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(SETTINGS_KEY);
      if (stored) setSettings({ ...DEFAULT_COLLAGE_SETTINGS, ...JSON.parse(stored) });
    } catch { /* ignore */ }
    setSettingsReady(true);
  }, []);
  useEffect(() => {
    if (!settingsReady) return;
    try { window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* ignore */ }
  }, [settings, settingsReady]);

  // Object URLs + natural sizes for each photo
  useEffect(() => {
    const next = files.map((file) => URL.createObjectURL(file));
    setUrls(next);
    let cancelled = false;
    Promise.all(next.map((url) => new Promise<Size | null>((resolve) => {
      const image = new Image();
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => resolve(null);
      image.src = url;
    }))).then((result) => { if (!cancelled) setSizes(result); });
    return () => { cancelled = true; next.forEach(URL.revokeObjectURL); };
  }, [files]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const paper = collagePaper(settings);
  const layoutSizes = useMemo(() => files.map((_, index) => sizes[index] ?? null), [files, sizes]);
  const pages = useMemo(() => layoutCollage(settings, layoutSizes), [settings, layoutSizes]);
  const pageCount = Math.max(1, pages.length);

  // Fit-to-screen scale
  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const measure = () => {
      const width = element.clientWidth - RULER - 48;
      const height = element.clientHeight - RULER - 72;
      setFitScale(Math.max(0.5, Math.min(width / paper.width, height / paper.height)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [paper.width, paper.height, files.length > 0]);

  const scale = zoomMode === "fit" ? fitScale : PX_PER_MM_100;
  const update = <K extends keyof CollageSettings>(key: K, value: CollageSettings[K]) => setSettings((current) => ({ ...current, [key]: value }));
  const perPage = settings.rows * settings.columns;

  const addFiles = useCallback((list: FileList | File[] | null) => {
    const images = Array.from(list ?? []).filter((file) => file.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|bmp)$/i.test(file.name));
    if (!images.length) { setNotice("Please choose image files (JPG, PNG, WEBP)."); return; }
    if (files.length) appendFiles(TOOL_ID, images); else setFiles(TOOL_ID, images);
  }, [appendFiles, files.length, setFiles]);

  const removePhoto = (index: number) => {
    const next = files.filter((_, i) => i !== index);
    if (next.length) setFiles(TOOL_ID, next); else clearFiles(TOOL_ID);
  };

  const exportPdf = async (mode: "print" | "download") => {
    if (!files.length || busy) return;
    setBusy(mode);
    try {
      if (mode === "print") {
        // Direct print dialog — no new tab, no download
        await printImagePages(await renderCollagePages(settings, pages, files), paper);
      } else {
        const url = URL.createObjectURL(await createCollagePdf(settings, pages, files));
        saveBlob(url, "photo-collage.pdf");
        window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      }
    } catch (error) {
      console.error("Collage export failed", error);
      setNotice(mode === "print" ? "Could not open the print window. Please try again." : "Could not create the PDF. Please try again.");
    } finally {
      setBusy("");
    }
  };

  const onFileDrag = (event: React.DragEvent) => {
    if (!Array.from(event.dataTransfer.types).includes("Files")) return;
    event.preventDefault();
    setFileDragging(event.type !== "dragleave");
  };
  const onFileDrop = (event: React.DragEvent) => {
    if (!event.dataTransfer.files.length) return;
    event.preventDefault();
    setFileDragging(false);
    addFiles(event.dataTransfer.files);
  };

  const hiddenInput = <input ref={inputRef} type="file" accept="image/*,.jpg,.jpeg,.png,.webp" multiple className="hidden" onChange={(event) => { addFiles(event.target.files); event.target.value = ""; }} />;

  if (!hydrated || !settingsReady) return <div className="grid h-full place-items-center text-sm text-slate-500"><LoaderCircle className="h-5 w-5 animate-spin" /></div>;

  if (!files.length) {
    return <div className="flex min-h-full flex-col items-center justify-center p-5" onDragEnter={onFileDrag} onDragOver={onFileDrag} onDragLeave={onFileDrag} onDrop={onFileDrop}>
      {hiddenInput}
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Photo Collage Maker</h1>
        <p className="mt-1 text-sm text-slate-500">Arrange many photos on A4 / 4×6 pages and print in one go</p>
      </div>
      <button type="button" onClick={() => inputRef.current?.click()} className={`flex w-full max-w-xl flex-col items-center gap-3 rounded-2xl border-2 border-dashed bg-white px-6 py-14 text-center transition dark:bg-slate-900 ${fileDragging ? "border-violet-500 bg-violet-50" : "border-slate-300 hover:border-violet-400 dark:border-slate-700"}`}>
        <CloudUpload className="h-10 w-10 text-violet-600" />
        <span className="text-base font-semibold text-slate-800 dark:text-slate-100">Upload photos</span>
        <span className="text-xs text-slate-500">Click or drag & drop · JPG, PNG, WEBP · multiple allowed</span>
      </button>
      <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-500"><Lock className="h-3.5 w-3.5" />Photos stay on your device</p>
      {notice && <Toast text={notice} onClose={() => setNotice("")} />}
    </div>;
  }

  return <div className="flex h-full min-h-0 flex-col bg-slate-50 dark:bg-slate-950">
    {hiddenInput}
    {/* Top bar */}
    <div className="flex h-12 shrink-0 items-center justify-end gap-2 border-b border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-900">
      <span className="mr-auto truncate text-xs text-slate-500">{files.length} photo{files.length === 1 ? "" : "s"} · {pageCount} page{pageCount === 1 ? "" : "s"}</span>
      <button type="button" onClick={() => inputRef.current?.click()} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"><ImagePlus className="h-4 w-4" /><span className="hidden sm:inline">Add photos</span></button>
      <button type="button" disabled={!!busy} onClick={() => void exportPdf("print")} className="inline-flex h-9 items-center gap-2 rounded-lg bg-slate-900 px-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-900">{busy === "print" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}Print</button>
      <button type="button" disabled={!!busy} onClick={() => void exportPdf("download")} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">{busy === "download" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}Download</button>
    </div>

    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      {/* Preview */}
      <div ref={viewportRef} className={`relative min-h-[60vh] flex-1 overflow-auto lg:min-h-0 ${fileDragging ? "outline-dashed outline-2 -outline-offset-4 outline-violet-500" : ""}`} onDragEnter={onFileDrag} onDragOver={onFileDrag} onDragLeave={onFileDrag} onDrop={onFileDrop}>
        <div className="sticky top-3 z-10 flex justify-end pr-3">
          <div className="flex rounded-md border border-slate-200 bg-white p-0.5 text-[11px] shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <button type="button" onClick={() => setZoomMode("fit")} className={`rounded px-2.5 py-1 font-medium ${zoomMode === "fit" ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "text-slate-600 dark:text-slate-300"}`}>Fit</button>
            <button type="button" onClick={() => setZoomMode("actual")} className={`rounded px-2.5 py-1 font-medium ${zoomMode === "actual" ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "text-slate-600 dark:text-slate-300"}`}>100%</button>
          </div>
        </div>
        <div className="-mt-6 flex flex-col items-center gap-8 px-6 pb-10">
          {pages.map((page, pageIndex) => <div key={pageIndex} className="flex flex-col items-center">
            <div className="relative" style={{ paddingLeft: RULER, paddingTop: RULER }}>
              <Ruler orientation="horizontal" lengthMm={paper.width} scale={scale} />
              <Ruler orientation="vertical" lengthMm={paper.height} scale={scale} />
              <div className="relative bg-white shadow-[0_4px_20px_rgba(15,23,42,.12)]" style={{ width: paper.width * scale, height: paper.height * scale }}>
                <div className="pointer-events-none absolute border border-dashed border-cyan-500/70" style={{ left: settings.margin * scale, top: settings.margin * scale, right: settings.margin * scale, bottom: settings.margin * scale }} />
                {page.placements.map((placement) => {
                  const { box, image, photoIndex } = placement;
                  const borderPx = settings.borderWidth * scale / PX_PER_MM_100;
                  return <div key={photoIndex}
                    draggable
                    onDragStart={(event) => { setDragIndex(photoIndex); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", String(photoIndex)); }}
                    onDragOver={(event) => { if (dragIndex === null) return; event.preventDefault(); setDropTarget(photoIndex); }}
                    onDragLeave={() => setDropTarget((current) => current === photoIndex ? null : current)}
                    onDrop={(event) => { if (dragIndex === null) return; event.preventDefault(); event.stopPropagation(); reorderFiles(TOOL_ID, dragIndex, photoIndex); setDragIndex(null); setDropTarget(null); }}
                    onDragEnd={() => { setDragIndex(null); setDropTarget(null); }}
                    title="Drag to reorder"
                    className={`group absolute cursor-grab overflow-hidden active:cursor-grabbing ${dropTarget === photoIndex && dragIndex !== photoIndex ? "ring-2 ring-violet-500" : ""} ${dragIndex === photoIndex ? "opacity-50" : ""}`}
                    style={{ left: box.x * scale, top: box.y * scale, width: box.width * scale, height: box.height * scale }}>
                    {urls[photoIndex] && <img draggable={false} src={urls[photoIndex]} alt={files[photoIndex]?.name ?? `Photo ${photoIndex + 1}`} className="pointer-events-none absolute max-w-none select-none" style={{ left: (image.x - box.x) * scale, top: (image.y - box.y) * scale, width: image.width * scale, height: image.height * scale }} />}
                    {borderPx > 0 && <span className="pointer-events-none absolute inset-0" style={{ boxShadow: `inset 0 0 0 ${Math.max(0.5, borderPx)}px ${settings.borderColor}` }} />}
                    <button type="button" aria-label={`Remove photo ${photoIndex + 1}`} onClick={(event) => { event.stopPropagation(); removePhoto(photoIndex); }} className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-rose-600 text-white opacity-0 shadow transition group-hover:opacity-100 focus:opacity-100 [@media(hover:none)]:opacity-90"><X className="h-3.5 w-3.5" /></button>
                  </div>;
                })}
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-500">Page {pageIndex + 1} of {pageCount}</p>
          </div>)}
        </div>
      </div>

      {/* Settings panel */}
      <aside className="w-full shrink-0 overflow-y-auto border-t border-slate-200 bg-white text-sm dark:border-slate-800 dark:bg-slate-900 lg:w-[280px] lg:border-l lg:border-t-0">
        <div className="flex gap-2 border-b border-slate-200 p-3 dark:border-slate-800">
          <button type="button" onClick={() => setSettings(DEFAULT_COLLAGE_SETTINGS)} className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md border border-slate-200 text-xs hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"><RotateCcw className="h-3.5 w-3.5" />Reset settings</button>
          <button type="button" onClick={() => { if (window.confirm("Remove all photos from the collage?")) clearFiles(TOOL_ID); }} className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md border border-rose-200 text-xs text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:hover:bg-rose-950/30"><Trash2 className="h-3.5 w-3.5" />Clear all photos</button>
        </div>

        <Section title="Layout">
          <Segmented value={settings.mode} onChange={(value) => update("mode", value)} options={[{ value: "grid", label: "Grid" }, { value: "natural", label: "Natural shapes" }]} />
          {settings.mode === "grid" ? <>
            <p className="mt-4 mb-2 text-[13px] text-slate-700 dark:text-slate-200">Photos per page</p>
            <div className="grid grid-cols-4 gap-1.5">
              {PER_PAGE_PRESETS.map((preset) => <button key={preset.count} type="button" onClick={() => setSettings((current) => ({ ...current, rows: preset.rows, columns: preset.columns }))} className={`h-8 rounded-md border text-xs ${perPage === preset.count && settings.rows === preset.rows && settings.columns === preset.columns ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900" : "border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"}`}>{preset.count}</button>)}
            </div>
            <NumberRow label="Rows" value={settings.rows} min={1} max={20} onChange={(value) => update("rows", value)} />
            <NumberRow label="Columns" value={settings.columns} min={1} max={20} onChange={(value) => update("columns", value)} />
          </> : <>
            <p className="mt-3 text-xs leading-5 text-slate-500">Photos keep their original shape and flow onto new pages as needed.</p>
            <NumberRow label="Columns" value={settings.naturalColumns} min={1} max={10} onChange={(value) => update("naturalColumns", value)} />
          </>}
        </Section>

        <Section title="Page">
          <label className="flex items-center justify-between gap-3">
            <span className="text-[13px] text-slate-700 dark:text-slate-200">Paper size</span>
            <select value={settings.paper} onChange={(event) => update("paper", event.target.value as PaperSize)} className="h-8 w-28 rounded-md border border-slate-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-900">
              {(Object.keys(PAPER_SIZES) as PaperSize[]).map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
          </label>
          <div className="mt-3"><Segmented value={settings.orientation} onChange={(value) => update("orientation", value)} options={[{ value: "portrait", label: "Portrait" }, { value: "landscape", label: "Landscape" }]} /></div>
          <NumberRow label="Page margin" unit="mm" value={settings.margin} min={0} max={50} step={0.5} onChange={(value) => update("margin", value)} />
          <NumberRow label="Space between photos" unit="mm" value={settings.gap} min={0} max={50} step={0.5} onChange={(value) => update("gap", value)} />
        </Section>

        <Section title="Photos">
          {settings.mode === "grid" && <>
            <p className="mb-2 text-[13px] text-slate-700 dark:text-slate-200">Photo fit</p>
            <Segmented value={settings.fit} onChange={(value) => update("fit", value)} options={[{ value: "contain", label: "Fit whole photo" }, { value: "cover", label: "Fill the box" }, { value: "fill", label: "Stretch to box" }]} />
            {settings.fit !== "fill" && <>
              <p className="mb-2 mt-4 text-[13px] text-slate-700 dark:text-slate-200">Position in box</p>
              <Segmented value={settings.position} onChange={(value) => update("position", value)} options={[{ value: "top", label: "Top" }, { value: "center", label: "Center" }, { value: "bottom", label: "Bottom" }]} />
            </>}
          </>}
          <NumberRow label="Border width" unit="px" value={settings.borderWidth} min={0} max={20} onChange={(value) => update("borderWidth", value)} />
          <label className="mt-3 flex items-center justify-between gap-3">
            <span className="text-[13px] text-slate-700 dark:text-slate-200">Border color</span>
            <input type="color" value={settings.borderColor} onChange={(event) => update("borderColor", event.target.value)} className="h-8 w-14 cursor-pointer rounded border border-slate-200 bg-white p-0.5 dark:border-slate-700" />
          </label>
          <p className="mt-4 text-[11px] leading-4 text-slate-400">Tip: drag photos on the page to reorder. Drop images anywhere on the preview to add them.</p>
        </Section>
      </aside>
    </div>
    {notice && <Toast text={notice} onClose={() => setNotice("")} />}
  </div>;
}

const EMPTY_FILES: File[] = [];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="border-b border-slate-200 p-4 dark:border-slate-800">
    <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{title}</h2>
    {children}
  </section>;
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: Array<{ value: T; label: string }>; onChange: (value: T) => void }) {
  return <div className="flex rounded-md border border-slate-200 p-0.5 dark:border-slate-700">
    {options.map((option) => <button key={option.value} type="button" aria-pressed={value === option.value} onClick={() => onChange(option.value)} className={`min-h-8 flex-1 rounded px-1.5 py-1 text-xs leading-tight ${value === option.value ? "bg-slate-900 font-medium text-white dark:bg-white dark:text-slate-900" : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"}`}>{option.label}</button>)}
  </div>;
}

function NumberRow({ label, value, min, max, step = 1, unit, onChange }: { label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => { setDraft(String(value)); }, [value]);
  const commit = (text: string) => {
    const number = Number(text);
    if (text.trim() === "" || !Number.isFinite(number)) { setDraft(String(value)); return; }
    const clamped = Math.min(max, Math.max(min, number));
    onChange(clamped);
    setDraft(String(clamped));
  };
  return <label className="mt-3 flex items-center justify-between gap-3">
    <span className="text-[13px] text-slate-700 dark:text-slate-200">{label}</span>
    <span className="flex items-center gap-1.5">
      <input type="number" inputMode="decimal" min={min} max={max} step={step} value={draft}
        onChange={(event) => { setDraft(event.target.value); const number = Number(event.target.value); if (event.target.value !== "" && Number.isFinite(number) && number >= min && number <= max) onChange(number); }}
        onBlur={(event) => commit(event.target.value)}
        className="h-8 w-16 rounded-md border border-slate-200 bg-white px-2 text-xs outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-900" />
      {unit && <span className="w-5 text-[11px] text-slate-400">{unit}</span>}
    </span>
  </label>;
}

function Ruler({ orientation, lengthMm, scale }: { orientation: "horizontal" | "vertical"; lengthMm: number; scale: number }) {
  const horizontal = orientation === "horizontal";
  const step = scale < 2 ? 2 : 1; // fewer minor ticks when zoomed out
  const ticks: React.ReactNode[] = [];
  for (let mm = 0; mm <= Math.floor(lengthMm); mm += step) {
    const isCm = mm % 10 === 0;
    const isHalf = mm % 5 === 0;
    const size = isCm ? 10 : isHalf ? 6 : 3;
    const pos = mm * scale;
    ticks.push(<span key={mm} className="absolute bg-sky-400/80" style={horizontal ? { left: pos, bottom: 0, width: 1, height: size } : { top: pos, right: 0, height: 1, width: size }} />);
    if (isCm && mm > 0) ticks.push(<span key={`l${mm}`} className="absolute text-[8px] leading-none text-slate-500" style={horizontal ? { left: pos + 2, top: 2 } : { top: pos + 2, left: 2 }}>{mm / 10}</span>);
  }
  return <div aria-hidden="true" className="pointer-events-none absolute overflow-hidden bg-sky-50 dark:bg-sky-950/60" style={horizontal ? { left: RULER, top: 0, width: lengthMm * scale, height: RULER - 4 } : { top: RULER, left: 0, height: lengthMm * scale, width: RULER - 4 }}>
    {ticks}
    <span className="absolute text-[7px] text-slate-400" style={horizontal ? { right: 2, top: 2 } : { bottom: 2, left: 2 }}>cm</span>
  </div>;
}

function Toast({ text, onClose }: { text: string; onClose: () => void }) {
  return <div role="status" className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-xs text-white shadow-xl">{text}<button type="button" aria-label="Dismiss" onClick={onClose}><X className="h-3.5 w-3.5" /></button></div>;
}

function saveBlob(url: string, name: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
}
