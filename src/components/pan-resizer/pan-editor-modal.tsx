"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Crop, FlipHorizontal2, FlipVertical2, Grid3X3, History, Maximize, Redo2, RotateCcw, RotateCw,
  Save, SlidersHorizontal, Undo2, Wand2, X, ZoomIn, ZoomOut
} from "lucide-react";
import { CropStage, getOrientedSize } from "@/components/editor/crop-stage";
import { FiltersWorkspace } from "@/components/editor/filters-workspace";
import { RemoveBgWorkspace } from "@/components/editor/remove-bg-workspace";
import { DEFAULT_FILTER_SETTINGS } from "@/tools/editor/filter-engine";
import type { CropRect, FilterSettings, PhotoEditSnapshot } from "@/tools/editor/types";
import type { PanSpec } from "@/tools/pan-resizer/config";
import type { PanEditState } from "@/tools/pan-resizer/process";

type Props = {
  image: HTMLImageElement;
  spec: PanSpec;
  savedState: PanEditState | null;
  onSave: (state: PanEditState) => void;
  onClose: () => void;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

function maxCrop(bounds: { width: number; height: number }, ratio: number): CropRect {
  let width = bounds.width;
  let height = width / ratio;
  if (height > bounds.height) { height = bounds.height; width = height * ratio; }
  return { x: (bounds.width - width) / 2, y: (bounds.height - height) / 2, width, height };
}

export function defaultPanState(image: HTMLImageElement, spec: PanSpec): PanEditState {
  const ratio = spec.width / spec.height;
  return {
    snapshot: { crop: maxCrop({ width: image.naturalWidth, height: image.naturalHeight }, ratio), aspectRatio: ratio, aspectKey: "portal", rotation: 0, flipHorizontal: false, flipVertical: false, straighten: 0 },
    filters: DEFAULT_FILTER_SETTINGS,
    background: null,
    backgroundColor: "#FFFFFF"
  };
}

/** Make an existing state follow a (possibly new) portal ratio. */
export function fitStateToSpec(image: HTMLImageElement, state: PanEditState, spec: PanSpec): PanEditState {
  const ratio = spec.width / spec.height;
  if (Math.abs((state.snapshot.aspectRatio ?? 0) - ratio) < 0.0001) return state;
  const bounds = getOrientedSize(image.naturalWidth, image.naturalHeight, state.snapshot.rotation);
  return { ...state, background: null, snapshot: { ...state.snapshot, aspectRatio: ratio, crop: maxCrop(bounds, ratio) } };
}

export function PanEditorModal({ image, spec, savedState, onSave, onClose }: Props) {
  const ratio = spec.width / spec.height;
  const initial = useRef(savedState ? fitStateToSpec(image, savedState, spec) : defaultPanState(image, spec)).current;
  const [tab, setTab] = useState<"crop" | "filters" | "remove-bg">("crop");
  const [history, setHistory] = useState<PhotoEditSnapshot[]>([initial.snapshot]);
  const [index, setIndex] = useState(0);
  const [draftCrop, setDraftCrop] = useState<CropRect | null>(null);
  const [straightenDraft, setStraightenDraft] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [grid, setGrid] = useState(true);
  const [filters, setFilters] = useState<FilterSettings[]>([initial.filters]);
  const [filterIndex, setFilterIndex] = useState(0);
  const [background, setBackground] = useState<Blob | null>(initial.background);
  const [backgroundColor, setBackgroundColor] = useState(initial.backgroundColor);
  const [notice, setNotice] = useState("");
  const [widthInput, setWidthInput] = useState("");

  const current = history[index];
  const visible: PhotoEditSnapshot = { ...current, crop: draftCrop ?? current.crop, straighten: straightenDraft ?? current.straighten };
  const bounds = getOrientedSize(image.naturalWidth, image.naturalHeight, current.rotation);
  const filter = filters[filterIndex];

  useEffect(() => { setWidthInput(String(Math.round(current.crop.width))); }, [current.crop.width]);
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(""), 3200); return () => window.clearTimeout(timer); }, [notice]);

  const commit = useCallback((next: PhotoEditSnapshot) => {
    setHistory((items) => [...items.slice(0, index + 1), next]);
    setIndex((value) => value + 1);
    setDraftCrop(null);
    setStraightenDraft(null);
    if (background) { setBackground(null); setNotice("Crop changed — run Remove BG again for the new area."); }
  }, [background, index]);

  const rotate = useCallback((direction: 1 | -1) => {
    const rotation = ((current.rotation + direction) % 4 + 4) % 4;
    const nextBounds = getOrientedSize(image.naturalWidth, image.naturalHeight, rotation);
    commit({ ...current, rotation, crop: maxCrop(nextBounds, ratio) });
  }, [commit, current, image, ratio]);

  const flip = useCallback((axis: "h" | "v") => {
    const crop = axis === "h" ? { ...current.crop, x: bounds.width - current.crop.x - current.crop.width } : { ...current.crop, y: bounds.height - current.crop.y - current.crop.height };
    commit({ ...current, crop, flipHorizontal: axis === "h" ? !current.flipHorizontal : current.flipHorizontal, flipVertical: axis === "v" ? !current.flipVertical : current.flipVertical });
  }, [bounds.height, bounds.width, commit, current]);

  const setCropWidth = (value: number) => {
    if (!Number.isFinite(value)) return;
    const max = Math.min(bounds.width, bounds.height * ratio);
    const width = clamp(value, 24, max);
    const height = width / ratio;
    const cx = current.crop.x + current.crop.width / 2;
    const cy = current.crop.y + current.crop.height / 2;
    commit({ ...current, crop: { width, height, x: clamp(cx - width / 2, 0, bounds.width - width), y: clamp(cy - height / 2, 0, bounds.height - height) } });
  };

  const undo = useCallback(() => { if (index > 0) { setIndex(index - 1); setDraftCrop(null); } }, [index]);
  const redo = useCallback(() => { if (index < history.length - 1) { setIndex(index + 1); setDraftCrop(null); } }, [history.length, index]);

  const changeFilters = (settings: FilterSettings) => {
    setFilters((items) => [...items.slice(0, filterIndex + 1), settings]);
    setFilterIndex((value) => value + 1);
  };

  const save = (bgOverride?: Blob, colorOverride?: string) => {
    onSave({ snapshot: current, filters: filter, background: bgOverride ?? background, backgroundColor: colorOverride ?? backgroundColor });
  };

  const restore = () => {
    const base = savedState ? fitStateToSpec(image, savedState, spec) : defaultPanState(image, spec);
    commit(base.snapshot);
    setBackground(base.background);
    setBackgroundColor(base.backgroundColor);
    setFilters([base.filters]);
    setFilterIndex(0);
    setNotice(savedState ? "Restored your last saved edit." : "Nothing saved yet — back to the original.");
  };

  const reset = () => {
    const base = defaultPanState(image, spec);
    commit(base.snapshot);
    setBackground(null);
    setFilters([DEFAULT_FILTER_SETTINGS]);
    setFilterIndex(0);
    setZoom(1);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (event.key === "Escape") { onClose(); return; }
      if (tab !== "crop") return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); if (event.shiftKey) redo(); else undo(); return; }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") { event.preventDefault(); redo(); return; }
      if (event.key.toLowerCase() === "r") { rotate(event.shiftKey ? -1 : 1); return; }
      if (event.key.toLowerCase() === "h") { flip("h"); return; }
      if (event.key.toLowerCase() === "v") { flip("v"); return; }
      const step = event.shiftKey ? 10 : 1;
      const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
      if (delta) {
        event.preventDefault();
        const crop = current.crop;
        commit({ ...current, crop: { ...crop, x: clamp(crop.x + delta[0], 0, bounds.width - crop.width), y: clamp(crop.y + delta[1], 0, bounds.height - crop.height) } });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bounds.height, bounds.width, commit, current, flip, onClose, redo, rotate, tab, undo]);

  const tabClass = (active: boolean) => `flex flex-1 items-center justify-center gap-2 px-3 text-sm font-semibold ${active ? "bg-violet-700 text-white" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900"}`;

  return <div className="fixed inset-0 z-[90] flex flex-col bg-[#f6f6f7] text-slate-900 dark:bg-slate-950 dark:text-slate-100">
    <div className="relative flex h-11 shrink-0 items-stretch justify-center border-b border-slate-200 dark:border-slate-800">
      <div role="tablist" className="flex w-full max-w-3xl border-x border-slate-200 dark:border-slate-800">
        <button type="button" role="tab" aria-selected={tab === "crop"} onClick={() => setTab("crop")} className={tabClass(tab === "crop")}><Crop className="h-4 w-4" />Crop</button>
        <button type="button" role="tab" aria-selected={tab === "filters"} onClick={() => setTab("filters")} className={`${tabClass(tab === "filters")} border-x border-slate-200 dark:border-slate-800`}><SlidersHorizontal className="h-4 w-4" />Filters</button>
        <button type="button" role="tab" aria-selected={tab === "remove-bg"} onClick={() => setTab("remove-bg")} className={tabClass(tab === "remove-bg")}><Wand2 className="h-4 w-4" />Remove BG</button>
      </div>
      <button type="button" aria-label="Close editor" onClick={onClose} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
    </div>

    {tab === "crop" && <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 lg:flex-row lg:p-4">
      <div className="flex min-h-[50vh] flex-1 flex-col">
        <div className="mb-3 flex justify-center"><span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold shadow-sm dark:border-slate-700 dark:bg-slate-900"><Crop className="h-3.5 w-3.5" />Standard Crop</span></div>
        <div className="relative flex min-h-0 flex-1 overflow-hidden rounded-lg">
          <CropStage image={image} snapshot={visible} showGrid={grid} zoom={zoom} onZoomChange={setZoom} onCropPreview={setDraftCrop} onCropCommit={(crop) => commit({ ...current, crop })} />
          <span className="pointer-events-none absolute bottom-3 left-4 text-[11px] font-semibold text-white">{Math.round(visible.crop.width)} × {Math.round(visible.crop.height)} px</span>
        </div>
      </div>

      <aside className="flex w-full shrink-0 flex-col gap-3 lg:w-72">
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5"><IconButton label="Undo" disabled={index === 0} onClick={undo}><Undo2 /></IconButton><IconButton label="Redo" disabled={index >= history.length - 1} onClick={redo}><Redo2 /></IconButton></div>
          <div className="flex gap-1.5"><IconButton label="Zoom out" onClick={() => setZoom((value) => clamp(value - 0.1, 0.25, 3))}><ZoomOut /></IconButton><IconButton label="Fit" onClick={() => setZoom(1)}><Maximize /></IconButton><IconButton label="Zoom in" onClick={() => setZoom((value) => clamp(value + 0.1, 0.25, 3))}><ZoomIn /></IconButton></div>
        </div>
        <p className="rounded-lg bg-slate-200/60 px-3 py-2 text-[11px] leading-4 text-slate-500 dark:bg-slate-800">The crop shape is fixed to match the selected portal size ({spec.width}×{spec.height} px).</p>
        <section className="rounded-lg bg-slate-200/60 p-3 dark:bg-slate-800">
          <h3 className="mb-2 text-xs font-semibold">Rotate &amp; Flip</h3>
          <div className="flex gap-2"><IconButton label="Rotate left (Shift+R)" onClick={() => rotate(-1)}><RotateCcw /></IconButton><IconButton label="Rotate right (R)" onClick={() => rotate(1)}><RotateCw /></IconButton><IconButton label="Flip horizontal (H)" onClick={() => flip("h")}><FlipHorizontal2 /></IconButton><IconButton label="Flip vertical (V)" onClick={() => flip("v")}><FlipVertical2 /></IconButton></div>
          <label className="mt-3 block text-xs">
            <span className="flex justify-between"><span>Straighten</span><span className="text-[10px] text-slate-500">{(straightenDraft ?? current.straighten).toFixed(1)}°</span></span>
            <input type="range" min={-45} max={45} step={0.5} value={straightenDraft ?? current.straighten} onChange={(event) => setStraightenDraft(Number(event.target.value))} onPointerUp={() => { if (straightenDraft !== null) commit({ ...current, straighten: straightenDraft }); }} onKeyUp={() => { if (straightenDraft !== null) commit({ ...current, straighten: straightenDraft }); }} onDoubleClick={() => commit({ ...current, straighten: 0 })} className="mt-2 w-full accent-slate-700" />
          </label>
        </section>
        <section className="rounded-lg bg-slate-200/60 p-3 dark:bg-slate-800">
          <h3 className="mb-2 text-xs font-semibold">Crop Size</h3>
          <div className="flex items-center gap-2 text-xs">
            <input aria-label="Crop width" type="number" value={widthInput} onChange={(event) => setWidthInput(event.target.value)} onBlur={() => setCropWidth(Number(widthInput))} onKeyDown={(event) => { if (event.key === "Enter") setCropWidth(Number(widthInput)); }} className="h-8 w-full rounded bg-white px-2 text-center outline-none dark:bg-slate-900" />
            <span className="text-slate-400">×</span>
            <input aria-label="Crop height (locked to portal ratio)" readOnly value={Math.round(current.crop.height)} className="h-8 w-full rounded bg-white/60 px-2 text-center text-slate-500 dark:bg-slate-900/60" />
            <span className="text-[10px] text-slate-400">px</span>
          </div>
          <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs">
            <button type="button" role="switch" aria-checked={grid} onClick={() => setGrid((value) => !value)} className={`relative h-5 w-9 rounded-full transition ${grid ? "bg-slate-900 dark:bg-white" : "bg-slate-300"}`}><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition dark:bg-slate-900 ${grid ? "left-[18px]" : "left-0.5"}`} /></button>
            <Grid3X3 className="h-3.5 w-3.5" />Rule-of-thirds grid
          </label>
        </section>
        <p className="text-[10px] leading-4 text-slate-500">Arrow keys move the crop (Shift = 10px). R / Shift+R rotate, H / V flip.</p>
        <div className="mt-auto grid grid-cols-2 gap-2">
          <button type="button" onClick={restore} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white text-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900"><History className="h-4 w-4" />Restore</button>
          <button type="button" onClick={reset} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white text-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900"><RotateCcw className="h-4 w-4" />Reset</button>
          <button type="button" onClick={() => save()} className="col-span-2 inline-flex h-10 items-center justify-center gap-2 rounded-md bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"><Save className="h-4 w-4" />Save</button>
        </div>
      </aside>
    </div>}

    {tab === "filters" && <FiltersWorkspace image={image} snapshot={current} settings={filter} onSettingsChange={changeFilters} onUndo={() => setFilterIndex((value) => Math.max(0, value - 1))} onRedo={() => setFilterIndex((value) => Math.min(filters.length - 1, value + 1))} canUndo={filterIndex > 0} canRedo={filterIndex < filters.length - 1} onSave={() => save()} />}
    {tab === "remove-bg" && <RemoveBgWorkspace image={image} snapshot={current} initialResult={background} initialColor={backgroundColor} onResultChange={setBackground} onColorChange={setBackgroundColor} onSave={(result, color) => save(result, color)} />}

    {notice && <div role="status" className="fixed bottom-5 left-1/2 z-[95] -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs text-white shadow-xl">{notice}</div>}
  </div>;
}

function IconButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return <button type="button" title={label} aria-label={label} disabled={disabled} onClick={onClick} className="grid h-8 w-8 place-items-center rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 [&>svg]:h-4 [&>svg]:w-4">{children}</button>;
}
