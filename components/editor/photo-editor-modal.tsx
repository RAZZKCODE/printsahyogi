"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeftRight, Crop, Download, FlipHorizontal2,
  FlipVertical2, Grid3X3, Maximize, Minus,
  MoveDiagonal, Plus, Redo2, RotateCcw, RotateCw, Save, SlidersHorizontal,
  Sparkles, Undo2, X
} from "lucide-react";
import { CropStage, getOrientedSize } from "@/components/editor/crop-stage";
import { FiltersWorkspace } from "@/components/editor/filters-workspace";
import { RemoveBgWorkspace } from "@/components/editor/remove-bg-workspace";
import { useUploadStore } from "@/tools/upload/store";
import { DEFAULT_FILTER_SETTINGS } from "@/tools/editor/filter-engine";
import type { CropRect, FilterSettings, PhotoEditOperation, PhotoEditSnapshot } from "@/tools/editor/types";

type Props = { toolId: string; fileIndex?: number; returnToJoint?: boolean; returnToSheet?: boolean };

const EMPTY_OPERATIONS: PhotoEditOperation[] = [];
const aspectOptions = [
  { label: "1:1", ratio: 1 },
  { label: "4:3", ratio: 4 / 3 },
  { label: "3:4", ratio: 3 / 4 },
  { label: "3:2", ratio: 3 / 2 },
  { label: "2:3", ratio: 2 / 3 },
  { label: "16:9", ratio: 16 / 9 },
  { label: "9:16", ratio: 9 / 16 }
];

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function normalizeTurns(turns: number) {
  return ((turns % 4) + 4) % 4;
}

function centeredCrop(width: number, height: number, ratio: number | null, fill = 0.94): CropRect {
  if (!ratio) return { x: 0, y: 0, width, height };
  let cropWidth = width * fill;
  let cropHeight = cropWidth / ratio;
  if (cropHeight > height * fill) {
    cropHeight = height * fill;
    cropWidth = cropHeight * ratio;
  }
  return { x: (width - cropWidth) / 2, y: (height - cropHeight) / 2, width: cropWidth, height: cropHeight };
}

function fitRectToRatio(rect: CropRect, ratio: number | null, bounds: { width: number; height: number }): CropRect {
  if (!ratio) return rect;
  let width = rect.width;
  let height = rect.height;
  if (width / height > ratio) width = height * ratio;
  else height = width / ratio;
  const maxWidth = Math.min(bounds.width, bounds.height * ratio);
  width = Math.min(width, maxWidth);
  height = width / ratio;
  const x = clamp(rect.x + (rect.width - width) / 2, 0, Math.max(0, bounds.width - width));
  const y = clamp(rect.y + (rect.height - height) / 2, 0, Math.max(0, bounds.height - height));
  return { x, y, width, height };
}

function buildSavedSnapshot(width: number, height: number, operations: PhotoEditOperation[]): PhotoEditSnapshot {
  let rotation = 0;
  let flipHorizontal = false;
  let flipVertical = false;
  let straighten = 0;
  let savedCrop: Extract<PhotoEditOperation, { type: "crop" }> | undefined;
  for (const operation of operations) {
    if (operation.type === "rotate") rotation = normalizeTurns(operation.quarterTurns);
    if (operation.type === "flip") {
      flipHorizontal = operation.horizontal;
      flipVertical = operation.vertical;
    }
    if (operation.type === "straighten") straighten = operation.degrees;
    if (operation.type === "crop") savedCrop = operation;
  }
  const oriented = getOrientedSize(width, height, rotation);
  const crop = savedCrop?.rect ?? centeredCrop(oriented.width, oriented.height, 3 / 4);
  return {
    crop,
    aspectRatio: savedCrop?.aspectRatio ?? 3 / 4,
    aspectKey: savedCrop?.aspectKey ?? "3:4",
    rotation,
    flipHorizontal,
    flipVertical,
    straighten
  };
}

export function PhotoEditorModal({ toolId, fileIndex = 0, returnToJoint = false, returnToSheet = false }: Props) {
  const router = useRouter();
  const session = useUploadStore((state) => state.sessions[toolId]);
  const setPhotoOperations = useUploadStore((state) => state.setPhotoOperations);
  const setBackgroundResult = useUploadStore((state) => state.setBackgroundResult);
  const setBackgroundColor = useUploadStore((state) => state.setBackgroundColor);
  const file = session?.files[fileIndex] ?? null;
  const savedOperations = session?.photoOperations?.[fileIndex] ?? (fileIndex === 0 ? session?.operations : undefined) ?? EMPTY_OPERATIONS;
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imageError, setImageError] = useState(false);
  const [history, setHistory] = useState<PhotoEditSnapshot[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [draftCrop, setDraftCrop] = useState<CropRect | null>(null);
  const [straightenDraft, setStraightenDraft] = useState<number | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [customWidth, setCustomWidth] = useState("5");
  const [customHeight, setCustomHeight] = useState("7");
  const [cropWidthInput, setCropWidthInput] = useState("");
  const [cropHeightInput, setCropHeightInput] = useState("");
  const [notice, setNotice] = useState("");
  const [activeTab, setActiveTab] = useState<"crop" | "filters" | "remove-bg">("crop");
  const [filterHistory, setFilterHistory] = useState<FilterSettings[]>([DEFAULT_FILTER_SETTINGS]);
  const [filterHistoryIndex, setFilterHistoryIndex] = useState(0);
  const [backgroundResult, setLocalBackgroundResult] = useState<Blob | null>(session?.backgroundResults?.[fileIndex] ?? (fileIndex === 0 ? session?.backgroundResult : null) ?? null);
  const [backgroundColor, setLocalBackgroundColor] = useState(session?.backgroundColors?.[fileIndex] ?? "transparent");
  const historyRef = useRef(history);
  const historyIndexRef = useRef(historyIndex);
  const currentRef = useRef<PhotoEditSnapshot | null>(null);
  const initialSnapshotRef = useRef<PhotoEditSnapshot | null>(null);
  const initializedFileRef = useRef<File | null>(null);
  const filterHistoryRef = useRef<FilterSettings[]>([DEFAULT_FILTER_SETTINGS]);
  const filterHistoryIndexRef = useRef(0);
  const currentFilter = filterHistory[filterHistoryIndex] ?? DEFAULT_FILTER_SETTINGS;
  const filterCanUndo = filterHistoryIndex > 0;
  const filterCanRedo = filterHistoryIndex < filterHistory.length - 1;

  const current = history[historyIndex] ?? null;
  currentRef.current = current;
  historyRef.current = history;
  historyIndexRef.current = historyIndex;
  const visible = current && draftCrop ? { ...current, crop: draftCrop } : current;
  const previewSnapshot = visible && straightenDraft !== null ? { ...visible, straighten: straightenDraft } : visible;
  const orientedSize = useMemo(() => image ? getOrientedSize(image.naturalWidth, image.naturalHeight, visible?.rotation ?? 0) : null, [image, visible?.rotation]);
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex >= 0 && historyIndex < history.length - 1;

  const returnPath = returnToJoint ? `/app/${toolId}/sheet?joint=1` : returnToSheet ? `/app/${toolId}/sheet` : `/app/${toolId}`;
  const goBack = useCallback(() => router.push(returnPath), [router, returnPath]);

  useEffect(() => {
    if (!file) {
      setImage(null);
      return;
    }
    const url = URL.createObjectURL(file);
    const loaded = new window.Image();
    loaded.onload = () => {
      setImageError(false);
      setImage(loaded);
    };
    loaded.onerror = () => setImageError(true);
    loaded.src = url;
    return () => {
      loaded.onload = null;
      loaded.onerror = null;
      URL.revokeObjectURL(url);
    };
  }, [file]);

  useEffect(() => {
    if (!image || !file || initializedFileRef.current === file) return;
    initializedFileRef.current = file;
    const loadedSnapshot = buildSavedSnapshot(image.naturalWidth, image.naturalHeight, savedOperations);
    const baseline = buildSavedSnapshot(image.naturalWidth, image.naturalHeight, []);
    initialSnapshotRef.current = baseline;
    const customMatch = loadedSnapshot.aspectKey.match(/^custom:(\d+):(\d+)$/);
    if (customMatch) {
      setCustomWidth(customMatch[1]);
      setCustomHeight(customMatch[2]);
    }
    historyRef.current = [loadedSnapshot];
    historyIndexRef.current = 0;
    setHistory([loadedSnapshot]);
    setHistoryIndex(0);
    setDraftCrop(null);
    setStraightenDraft(null);
    setShowGrid(true);
    setZoom(1);
    const savedFilters = [...savedOperations].reverse().find((operation) => operation.type === "filters");
    const initialFilters = savedFilters?.type === "filters" ? savedFilters.settings : DEFAULT_FILTER_SETTINGS;
    filterHistoryRef.current = [initialFilters];
    filterHistoryIndexRef.current = 0;
    setFilterHistory([initialFilters]);
    setFilterHistoryIndex(0);
    setLocalBackgroundResult(session?.backgroundResults?.[fileIndex] ?? (fileIndex === 0 ? session?.backgroundResult : null) ?? null);
    setLocalBackgroundColor(session?.backgroundColors?.[fileIndex] ?? "transparent");
  }, [file, image, savedOperations]);

  useEffect(() => {
    if (!current) return;
    setCropWidthInput(String(Math.round(current.crop.width)));
    setCropHeightInput(String(Math.round(current.crop.height)));
  }, [current?.crop.width, current?.crop.height]);

  useEffect(() => {
    const customMatch = current?.aspectKey.match(/^custom:(\d+):(\d+)$/);
    if (customMatch) {
      setCustomWidth(customMatch[1]);
      setCustomHeight(customMatch[2]);
    }
  }, [current?.aspectKey]);

  const commitSnapshot = useCallback((next: PhotoEditSnapshot) => {
    const nextHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
    nextHistory.push(next);
    historyRef.current = nextHistory;
    historyIndexRef.current = nextHistory.length - 1;
    currentRef.current = next;
    setHistory(nextHistory);
    setHistoryIndex(nextHistory.length - 1);
  }, []);

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    const nextIndex = historyIndexRef.current - 1;
    historyIndexRef.current = nextIndex;
    currentRef.current = historyRef.current[nextIndex] ?? null;
    setHistoryIndex(nextIndex);
    setDraftCrop(null);
    setStraightenDraft(null);
  }, []);

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    const nextIndex = historyIndexRef.current + 1;
    historyIndexRef.current = nextIndex;
    currentRef.current = historyRef.current[nextIndex] ?? null;
    setHistoryIndex(nextIndex);
    setDraftCrop(null);
    setStraightenDraft(null);
  }, []);

  const changeFilterSettings = useCallback((settings: FilterSettings) => {
    const nextHistory = filterHistoryRef.current.slice(0, filterHistoryIndexRef.current + 1);
    nextHistory.push(settings);
    filterHistoryRef.current = nextHistory;
    filterHistoryIndexRef.current = nextHistory.length - 1;
    setFilterHistory(nextHistory);
    setFilterHistoryIndex(nextHistory.length - 1);
  }, []);

  const undoFilters = useCallback(() => {
    if (filterHistoryIndexRef.current <= 0) return;
    filterHistoryIndexRef.current -= 1;
    setFilterHistoryIndex(filterHistoryIndexRef.current);
  }, []);

  const redoFilters = useCallback(() => {
    if (filterHistoryIndexRef.current >= filterHistoryRef.current.length - 1) return;
    filterHistoryIndexRef.current += 1;
    setFilterHistoryIndex(filterHistoryIndexRef.current);
  }, []);

  const updateCrop = useCallback((crop: CropRect) => {
    setDraftCrop(null);
    setStraightenDraft(null);
    const snapshot = currentRef.current;
    if (snapshot) commitSnapshot({ ...snapshot, crop });
  }, [commitSnapshot]);

  const rotate = (direction: 1 | -1) => {
    const snapshot = currentRef.current;
    const source = image;
    if (!snapshot || !source) return;
    const oldSize = getOrientedSize(source.naturalWidth, source.naturalHeight, snapshot.rotation);
    const oldCrop = snapshot.crop;
    const crop = direction === 1
      ? { x: oldSize.height - oldCrop.y - oldCrop.height, y: oldCrop.x, width: oldCrop.height, height: oldCrop.width }
      : { x: oldCrop.y, y: oldSize.width - oldCrop.x - oldCrop.width, width: oldCrop.height, height: oldCrop.width };
    const aspectRatio = snapshot.aspectRatio === null ? null : 1 / snapshot.aspectRatio;
    const inverse: Record<string, string> = { "4:3": "3:4", "3:4": "4:3", "3:2": "2:3", "2:3": "3:2", "16:9": "9:16", "9:16": "16:9" };
    const customMatch = snapshot.aspectKey.match(/^custom:(\d+):(\d+)$/);
    const aspectKey = customMatch ? `custom:${customMatch[2]}:${customMatch[1]}` : inverse[snapshot.aspectKey] ?? snapshot.aspectKey;
    if (customMatch) {
      setCustomWidth(customMatch[2]);
      setCustomHeight(customMatch[1]);
    }
    commitSnapshot({ ...snapshot, crop, aspectRatio, aspectKey, rotation: normalizeTurns(snapshot.rotation + direction) });
    setDraftCrop(null);
  };

  const flip = (axis: "horizontal" | "vertical") => {
    const snapshot = currentRef.current;
    const size = orientedSize;
    if (!snapshot || !size) return;
    const crop = axis === "horizontal"
      ? { ...snapshot.crop, x: size.width - snapshot.crop.x - snapshot.crop.width }
      : { ...snapshot.crop, y: size.height - snapshot.crop.y - snapshot.crop.height };
    commitSnapshot({
      ...snapshot,
      crop,
      flipHorizontal: axis === "horizontal" ? !snapshot.flipHorizontal : snapshot.flipHorizontal,
      flipVertical: axis === "vertical" ? !snapshot.flipVertical : snapshot.flipVertical
    });
  };

  const setAspect = (key: string, ratio: number | null) => {
    const snapshot = currentRef.current;
    if (!snapshot || !orientedSize) return;
    const crop = fitRectToRatio(snapshot.crop, ratio, orientedSize);
    commitSnapshot({ ...snapshot, crop, aspectRatio: ratio, aspectKey: key });
  };

  const applyCustomAspect = () => {
    const width = Number(customWidth);
    const height = Number(customHeight);
    if (width > 0 && height > 0) setAspect(`custom:${width}:${height}`, width / height);
  };

  const swapOrientation = () => {
    const snapshot = currentRef.current;
    if (!snapshot || !snapshot.aspectRatio || !orientedSize) return;
    const ratio = 1 / snapshot.aspectRatio;
    const inverse: Record<string, string> = { "4:3": "3:4", "3:4": "4:3", "3:2": "2:3", "2:3": "3:2", "16:9": "9:16", "9:16": "16:9" };
    const customMatch = snapshot.aspectKey.match(/^custom:(\d+):(\d+)$/);
    let key = inverse[snapshot.aspectKey] ?? snapshot.aspectKey;
    if (customMatch) {
      key = `custom:${customMatch[2]}:${customMatch[1]}`;
      setCustomWidth(customMatch[2]);
      setCustomHeight(customMatch[1]);
    } else if (snapshot.aspectKey === "original" || snapshot.aspectKey === "custom") {
      const width = Math.max(1, Math.round(ratio * 100));
      key = `custom:${width}:100`;
      setCustomWidth(String(width));
      setCustomHeight("100");
    }
    commitSnapshot({ ...snapshot, crop: fitRectToRatio(snapshot.crop, ratio, orientedSize), aspectRatio: ratio, aspectKey: key });
  };

  const setCropDimension = (axis: "width" | "height", value: number) => {
    const snapshot = currentRef.current;
    if (!snapshot || !orientedSize || !Number.isFinite(value)) return;
    let crop = { ...snapshot.crop };
    const centerX = crop.x + crop.width / 2;
    const centerY = crop.y + crop.height / 2;
    if (axis === "width") {
      crop.width = clamp(value, 24, orientedSize.width);
      if (snapshot.aspectRatio) crop.height = crop.width / snapshot.aspectRatio;
    } else {
      crop.height = clamp(value, 24, orientedSize.height);
      if (snapshot.aspectRatio) crop.width = crop.height * snapshot.aspectRatio;
    }
    if (crop.width > orientedSize.width || crop.height > orientedSize.height) {
      const factor = Math.min(orientedSize.width / crop.width, orientedSize.height / crop.height);
      crop.width *= factor;
      crop.height *= factor;
    }
    crop.x = clamp(centerX - crop.width / 2, 0, orientedSize.width - crop.width);
    crop.y = clamp(centerY - crop.height / 2, 0, orientedSize.height - crop.height);
    commitSnapshot({ ...snapshot, crop });
  };

  const updateStraighten = (degrees: number, save = false) => {
    setStraightenDraft(degrees);
    if (save) {
      const snapshot = currentRef.current;
      if (snapshot) commitSnapshot({ ...snapshot, straighten: degrees });
      setStraightenDraft(null);
    }
  };

  const restoreOriginal = () => {
    if (!image) return;
    const size = getOrientedSize(image.naturalWidth, image.naturalHeight, 0);
    commitSnapshot({ crop: centeredCrop(size.width, size.height, null, 1), aspectRatio: null, aspectKey: "free", rotation: 0, flipHorizontal: false, flipVertical: false, straighten: 0 });
    setDraftCrop(null);
    setStraightenDraft(null);
  };

  const resetEdits = () => {
    const baseline = initialSnapshotRef.current;
    if (baseline) commitSnapshot({ ...baseline, crop: { ...baseline.crop } });
    setDraftCrop(null);
    setStraightenDraft(null);
    setZoom(1);
  };

  const saveAndReturn = (backgroundOverride?: Blob, backgroundColorOverride?: string) => {
    const snapshot = currentRef.current;
    if (!snapshot) return;
    const operations: PhotoEditOperation[] = [];
    if (snapshot.rotation !== 0) operations.push({ type: "rotate", quarterTurns: snapshot.rotation });
    if (snapshot.flipHorizontal || snapshot.flipVertical) operations.push({ type: "flip", horizontal: snapshot.flipHorizontal, vertical: snapshot.flipVertical });
    if (snapshot.straighten !== 0) operations.push({ type: "straighten", degrees: snapshot.straighten });
    operations.push({ type: "crop", rect: snapshot.crop, aspectRatio: snapshot.aspectRatio, aspectKey: snapshot.aspectKey });
    operations.push({ type: "filters", settings: currentFilter });
    const savedBackground = backgroundOverride ?? backgroundResult;
    if (savedBackground) operations.push({ type: "remove-background" });
    setPhotoOperations(toolId, fileIndex, operations);
    setBackgroundResult(toolId, savedBackground ?? undefined, fileIndex);
    setBackgroundColor(toolId, savedBackground ? backgroundColorOverride ?? backgroundColor : undefined, fileIndex);
    router.push(returnToJoint ? `/app/${toolId}/sheet?joint=1` : `/app/${toolId}/sheet`);
  };

  const downloadResult = async () => {
    if (!image || !currentRef.current) return;
    const snapshot = currentRef.current;
    const outputSize = getOrientedSize(image.naturalWidth, image.naturalHeight, snapshot.rotation);
    const transformed = document.createElement("canvas");
    transformed.width = Math.max(1, Math.round(outputSize.width));
    transformed.height = Math.max(1, Math.round(outputSize.height));
    const context = transformed.getContext("2d");
    if (!context) return;
    context.translate(transformed.width / 2, transformed.height / 2);
    context.rotate((snapshot.rotation * 90 + snapshot.straighten) * Math.PI / 180);
    context.scale(snapshot.flipHorizontal ? -1 : 1, snapshot.flipVertical ? -1 : 1);
    context.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
    const cropCanvas = document.createElement("canvas");
    cropCanvas.width = Math.max(1, Math.round(snapshot.crop.width));
    cropCanvas.height = Math.max(1, Math.round(snapshot.crop.height));
    const cropContext = cropCanvas.getContext("2d");
    if (!cropContext) return;
    cropContext.imageSmoothingQuality = "high";
    cropContext.drawImage(transformed, snapshot.crop.x, snapshot.crop.y, snapshot.crop.width, snapshot.crop.height, 0, 0, cropCanvas.width, cropCanvas.height);
    const blob = await new Promise<Blob | null>((resolve) => cropCanvas.toBlob(resolve, "image/png"));
    if (!blob) {
      setNotice("Could not export this image. Please try again.");
      return;
    }
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${file?.name.replace(/\.[^.]+$/, "") ?? "photo"}-cropped.png`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";
      if (!isTyping && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (activeTab === "filters") { if (event.shiftKey) redoFilters(); else undoFilters(); }
        else if (activeTab === "crop") { if (event.shiftKey) redo(); else undo(); }
        return;
      }
      if (!isTyping && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
        event.preventDefault();
        if (activeTab === "filters") redoFilters(); else if (activeTab === "crop") redo();
        return;
      }
      if (isTyping) return;
      if (activeTab !== "crop") return;
      const snapshot = currentRef.current;
      if (!snapshot) return;
      const nudge = event.shiftKey ? 10 : 1;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight" || event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault();
        const dx = event.key === "ArrowLeft" ? -nudge : event.key === "ArrowRight" ? nudge : 0;
        const dy = event.key === "ArrowUp" ? -nudge : event.key === "ArrowDown" ? nudge : 0;
        const size = orientedSize;
        if (size) commitSnapshot({ ...snapshot, crop: { ...snapshot.crop, x: clamp(snapshot.crop.x + dx, 0, size.width - snapshot.crop.width), y: clamp(snapshot.crop.y + dy, 0, size.height - snapshot.crop.height) } });
      } else if (event.key.toLowerCase() === "r") rotate(1);
      else if (event.key.toLowerCase() === "h") flip("horizontal");
      else if (event.key.toLowerCase() === "v") flip("vertical");
      else if (event.key === "Escape") goBack();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeTab, commitSnapshot, goBack, orientedSize, redo, redoFilters, undo, undoFilters]);

  const outputDimensions = visible?.crop;
  const closeLabel = "Close editor";

  return <div className="fixed inset-0 z-[100] flex h-dvh flex-col overflow-hidden bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100" role="dialog" aria-modal="true" aria-label="Photo editor">
    <header className="relative flex h-12 shrink-0 items-center justify-center border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div role="tablist" aria-label="Editing tools" className="flex h-full w-[calc(100%-3.5rem)] max-w-[690px]">
        <button type="button" role="tab" aria-selected={activeTab === "crop"} onClick={() => setActiveTab("crop")} className={`flex flex-1 items-center justify-center gap-2 px-4 text-sm font-semibold ${activeTab === "crop" ? "bg-violet-700 text-white" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900"}`}><Crop className="h-4 w-4" />Crop</button>
        <button type="button" role="tab" aria-selected={activeTab === "filters"} onClick={() => setActiveTab("filters")} className={`flex flex-1 items-center justify-center gap-2 border-x border-slate-200 px-4 text-sm font-semibold dark:border-slate-800 ${activeTab === "filters" ? "bg-violet-700 text-white" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900"}`}><SlidersHorizontal className="h-4 w-4" />Filters</button>
        <button type="button" role="tab" aria-selected={activeTab === "remove-bg"} onClick={() => setActiveTab("remove-bg")} className={`flex flex-1 items-center justify-center gap-2 px-4 text-sm font-semibold ${activeTab === "remove-bg" ? "bg-violet-700 text-white" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900"}`}><Sparkles className="h-4 w-4" />Remove BG</button>
      </div>
      <button type="button" onClick={goBack} aria-label={closeLabel} title={closeLabel} className="absolute right-3 flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
    </header>

    {activeTab === "crop" && <>
    <div className="flex min-h-11 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-2 py-1 dark:border-slate-800 sm:h-11 sm:flex-nowrap sm:px-5">
      <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-900">
        <button className="flex h-7 items-center gap-1.5 rounded-md bg-white px-3 text-xs font-semibold text-slate-800 shadow-sm dark:bg-slate-700 dark:text-white"><Crop className="h-3.5 w-3.5" />Standard Crop</button>
        <button disabled title="Perspective warp is not available yet" className="flex h-7 cursor-not-allowed items-center gap-1.5 rounded-md px-3 text-xs text-slate-400"><MoveDiagonal className="h-3.5 w-3.5" />Perspective Warp</button>
      </div>
      <div className="flex items-center gap-1">
        <IconButton label="Undo" disabled={!canUndo} onClick={undo}><Undo2 /></IconButton>
        <IconButton label="Redo" disabled={!canRedo} onClick={redo}><Redo2 /></IconButton>
        <span className="mx-1 h-5 border-l border-slate-200 dark:border-slate-800" />
        <IconButton label="Zoom out" onClick={() => setZoom((value) => clamp(value - 0.15, 0.25, 3))}><Minus /></IconButton>
        <IconButton label="Fit image" onClick={() => setZoom(1)}><Maximize /></IconButton>
        <IconButton label="Zoom in" onClick={() => setZoom((value) => clamp(value + 0.15, 0.25, 3))}><Plus /></IconButton>
      </div>
    </div>

    <div className="flex min-h-0 flex-1 flex-col gap-2 p-2 sm:flex-row sm:gap-3 sm:p-3">
      <main className="relative flex min-h-[220px] min-w-0 flex-1 flex-col overflow-hidden rounded-lg bg-[#090b10]">
        {image && previewSnapshot ? <CropStage image={image} snapshot={previewSnapshot} showGrid={showGrid} zoom={zoom} onZoomChange={setZoom} onCropPreview={setDraftCrop} onCropCommit={updateCrop} /> : <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-slate-300">{imageError ? "This image could not be opened." : "No photo is loaded. Return to the upload screen and choose an image."}</div>}
        {outputDimensions && <span className="pointer-events-none absolute bottom-3 left-3 rounded bg-black/60 px-2 py-1 text-[11px] font-medium text-white">{Math.round(outputDimensions.width)} × {Math.round(outputDimensions.height)} px</span>}
      </main>

      <aside className="flex h-[38vh] max-h-[280px] w-full shrink-0 flex-col overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-900 sm:h-auto sm:max-h-none sm:w-[300px]">
        <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-2.5 sm:p-3">
          <section className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
            <div className="mb-3 flex items-center justify-between"><h2 className="text-[11px] font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200">Aspect Ratio</h2><button type="button" title="Swap orientation" onClick={swapOrientation} disabled={!current?.aspectRatio} className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-35 dark:hover:bg-slate-800"><ArrowLeftRight className="h-3.5 w-3.5" /></button></div>
            <div className="grid grid-cols-3 gap-1.5">
              {[{ label: "Free", ratio: null }, { label: "Original", ratio: image && orientedSize ? orientedSize.width / orientedSize.height : null }, ...aspectOptions].map((option) => <button key={option.label} type="button" onClick={() => setAspect(option.label.toLowerCase(), option.ratio)} className={`h-7 rounded-md border text-[11px] font-medium transition ${current?.aspectKey === option.label.toLowerCase() ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-950" : "border-slate-200 bg-white text-slate-700 hover:border-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"}`}>{option.label}</button>)}
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <span className="text-[10px] text-slate-500">Custom</span>
              <input aria-label="Custom aspect width" inputMode="numeric" value={customWidth} onChange={(event) => setCustomWidth(event.target.value)} className="h-7 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 text-center text-xs dark:border-slate-800 dark:bg-slate-900" />
              <span className="text-xs text-slate-400">:</span>
              <input aria-label="Custom aspect height" inputMode="numeric" value={customHeight} onChange={(event) => setCustomHeight(event.target.value)} className="h-7 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 text-center text-xs dark:border-slate-800 dark:bg-slate-900" />
              <button type="button" onClick={applyCustomAspect} className={`h-7 rounded-md border px-2 text-[10px] font-semibold ${current?.aspectKey.startsWith("custom") ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-950" : "border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"}`}>Apply</button>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
            <h2 className="mb-3 text-[11px] font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200">Rotate &amp; Flip</h2>
            <div className="flex gap-1.5">
              <IconButton label="Rotate left 90 degrees" onClick={() => rotate(-1)}><RotateCcw /></IconButton>
              <IconButton label="Rotate right 90 degrees" onClick={() => rotate(1)}><RotateCw /></IconButton>
              <IconButton label="Flip horizontally" onClick={() => flip("horizontal")}><FlipHorizontal2 /></IconButton>
              <IconButton label="Flip vertically" onClick={() => flip("vertical")}><FlipVertical2 /></IconButton>
            </div>
            <div className="mb-1 mt-3 flex items-center justify-between text-[11px] text-slate-700 dark:text-slate-300"><span>Straighten</span><span className="text-slate-500">{(straightenDraft ?? current?.straighten ?? 0).toFixed(1)}°</span></div>
            <input type="range" aria-label="Straighten image" min={-45} max={45} step={0.1} value={straightenDraft ?? current?.straighten ?? 0} onChange={(event) => updateStraighten(Number(event.target.value))} onPointerUp={() => straightenDraft !== null && updateStraighten(straightenDraft, true)} onKeyUp={() => straightenDraft !== null && updateStraighten(straightenDraft, true)} onBlur={() => straightenDraft !== null && updateStraighten(straightenDraft, true)} className="h-2 w-full cursor-pointer accent-slate-700" />
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
            <h2 className="mb-3 text-[11px] font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200">Crop Size</h2>
            <div className="flex items-center gap-1.5">
              <input type="number" min={24} max={orientedSize?.width ?? undefined} aria-label="Crop width in pixels" value={cropWidthInput} disabled={!current} onChange={(event) => setCropWidthInput(event.target.value)} onBlur={() => setCropDimension("width", Number(cropWidthInput))} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} className="h-8 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 text-center text-xs disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900" />
              <span className="text-xs text-slate-400">×</span>
              <input type="number" min={24} max={orientedSize?.height ?? undefined} aria-label="Crop height in pixels" value={cropHeightInput} disabled={!current} onChange={(event) => setCropHeightInput(event.target.value)} onBlur={() => setCropDimension("height", Number(cropHeightInput))} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} className="h-8 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 text-center text-xs disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900" />
              <span className="text-[10px] text-slate-500">px</span>
            </div>
            <button type="button" role="switch" aria-checked={showGrid} onClick={() => setShowGrid((value) => !value)} className="mt-3 flex items-center gap-2 text-[11px] text-slate-700 dark:text-slate-300">
              <span className={`relative h-[18px] w-8 rounded-full transition ${showGrid ? "bg-slate-900 dark:bg-cyan-500" : "bg-slate-300 dark:bg-slate-700"}`}><span className={`absolute top-[3px] h-3 w-3 rounded-full bg-white transition ${showGrid ? "left-[17px]" : "left-[3px]"}`} /></span>
              <Grid3X3 className="h-3.5 w-3.5" />Rule-of-thirds grid
            </button>
          </section>

          <p className="px-1 text-[10px] leading-4 text-slate-500 dark:text-slate-400">Arrow keys move the crop · Shift = 10 px · R rotates · H/V flips</p>
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-1.5 border-t border-slate-200 p-2.5 dark:border-slate-800 sm:p-3">
          <PanelButton onClick={restoreOriginal} title="Restore (original)"><RotateCcw className="h-3.5 w-3.5" />Restore</PanelButton>
          <PanelButton onClick={resetEdits}><Undo2 className="h-3.5 w-3.5" />Reset</PanelButton>
          <PanelButton primary onClick={saveAndReturn} disabled={!image} title="Save, apply changes, and return"><Save className="h-3.5 w-3.5" />Save</PanelButton>
          <PanelButton primary onClick={downloadResult} disabled={!image}><Download className="h-3.5 w-3.5" />Download</PanelButton>
        </div>
      </aside>
    </div>
    </>}

    {activeTab === "filters" && image && current && <FiltersWorkspace image={image} snapshot={previewSnapshot ?? current} settings={currentFilter} onSettingsChange={changeFilterSettings} onUndo={undoFilters} onRedo={redoFilters} canUndo={filterCanUndo} canRedo={filterCanRedo} onSave={saveAndReturn} />}
    {activeTab === "remove-bg" && <RemoveBgWorkspace image={image} snapshot={previewSnapshot ?? current} initialResult={backgroundResult} initialColor={backgroundColor} onResultChange={setLocalBackgroundResult} onColorChange={setLocalBackgroundColor} onSave={saveAndReturn} />}
    {(activeTab === "filters" || activeTab === "remove-bg") && !image && <div className="flex flex-1 items-center justify-center text-sm text-slate-500">{imageError ? "This image could not be opened." : "No photo is loaded. Return to the upload screen and choose an image."}</div>}

    {notice && <div role="alert" className="fixed bottom-4 left-1/2 z-[110] -translate-x-1/2 rounded-lg bg-rose-700 px-4 py-2.5 text-xs text-white shadow-lg">{notice}<button onClick={() => setNotice("")} className="ml-3"><X className="inline h-3.5 w-3.5" /></button></div>}
  </div>;
}

function IconButton({ children, label, onClick, disabled = false }: { children: React.ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return <button type="button" title={label} aria-label={label} disabled={disabled} onClick={onClick} className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 [&>svg]:h-4 [&>svg]:w-4">{children}</button>;
}

function PanelButton({ children, onClick, primary = false, disabled = false, title }: { children: React.ReactNode; onClick: () => void; primary?: boolean; disabled?: boolean; title?: string }) {
  return <button type="button" title={title} disabled={disabled} onClick={onClick} className={`flex h-10 items-center justify-center gap-2 rounded-md border text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${primary ? "border-slate-900 bg-slate-900 text-white hover:bg-slate-800 dark:border-white dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"}`}>{children}</button>;
}
