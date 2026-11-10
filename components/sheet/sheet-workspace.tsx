"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownToLine, Check, ChevronDown, FlipHorizontal2, FlipVertical2,
  CreditCard, FileImage, ImagePlus, LockKeyhole, Maximize2, Minus, Pencil, Plus, Printer, RotateCcw,
  RotateCw, Settings2, Trash2, Upload, X
} from "lucide-react";
import { useUploadStore } from "@/tools/upload/store";
import { readPersistedState, writePersistedState } from "@/lib/db";
import { applyFilterSettings } from "@/tools/editor/filter-engine";
import { canvasToBlob, renderCropCanvas } from "@/tools/editor/image-export";
import type { PhotoEditOperation, PhotoEditSnapshot } from "@/tools/editor/types";
import { DEFAULT_SHEET_SETTINGS, paperDimensions, type ImageFit, type SheetSettings } from "@/tools/sheet/defaults";
import { capacityForLayout, fitPhotoWidthForColumns, layoutJointRows, layoutPlacements, mmToCm, mmToPx, PHOTO_PRESETS, type PaperSize } from "@/tools/sheet/layout";
import { JointPhotoDialog } from "@/components/sheet/joint-photo-dialog";
import { createImageDownloads, createPdfBlob, createPhotosZip } from "@/tools/sheet/export";

const TOOLBAR_FIELDS = [
  ["gapX", "GapX"], ["gapY", "GapY"], ["margin", "Margin"], ["border", "Border"], ["fontSize", "Font"]
] as const;
const SHEET_SCALE = 2.45;
const imageFormats = ".jpg,.jpeg,.png,.webp,.gif,.bmp";

export function SheetWorkspace({ toolId, openJointOnStart = false }: { toolId: string; openJointOnStart?: boolean }) {
  const router = useRouter();
  const session = useUploadStore((state) => state.sessions[toolId]);
  const operations = session?.operations ?? [];
  const fileList = session?.files ?? [];
  const hydrated = useUploadStore((state) => state.hydrated);
  const appendFiles = useUploadStore((state) => state.appendFiles);
  const setPhotoOperations = useUploadStore((state) => state.setPhotoOperations);
  const setBackgroundResult = useUploadStore((state) => state.setBackgroundResult);
  const clearFiles = useUploadStore((state) => state.clearFiles);
  const reorderFiles = useUploadStore((state) => state.reorderFiles);
  const addJointPhoto = useUploadStore((state) => state.addJointPhoto);
  const removeJointPhoto = useUploadStore((state) => state.removeJointPhoto);
  const photoOperations = session?.photoOperations ?? {};
  const jointPhotos = session?.jointPhotos ?? [];
  const [settings, setSettings] = useState<SheetSettings>(DEFAULT_SHEET_SETTINGS);
  const [copies, setCopies] = useState<number[]>([]);
  const [settingsReady, setSettingsReady] = useState(false);
  const [copiesReady, setCopiesReady] = useState(false);
  const [zoom, setZoom] = useState(0.9);
  const [notice, setNotice] = useState("");
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [transformMenuOpen, setTransformMenuOpen] = useState(false);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [jointUrls, setJointUrls] = useState<string[]>([]);
  const [jointOpen, setJointOpen] = useState(openJointOnStart);
  const [contextMenu, setContextMenu] = useState<{ kind: "photo" | "joint"; index: number; x: number; y: number } | null>(null);
  const [quantityDialog, setQuantityDialog] = useState<{ kind: "photo" | "joint"; index: number; quantity: number } | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<number | null>(null);
  const [selectedJoint, setSelectedJoint] = useState<number | null>(null);
  const [photoTexts, setPhotoTexts] = useState<string[]>([]);
  const [photoTextsReady, setPhotoTextsReady] = useState(false);
  const [textDialog, setTextDialog] = useState<{ index: number; value: string } | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const fourBySixPresetApplied = useRef(false);

  useEffect(() => { if (openJointOnStart) setJointOpen(true); }, [openJointOnStart]);

  useEffect(() => {
    if (!hydrated || fileList.length > 0) return;
    window.location.replace(toolId === "passport-photo" ? "/app/passport-photo/" : `/app/${toolId}/`);
  }, [fileList.length, hydrated, toolId]);

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    void Promise.all([
      readPersistedState<SheetSettings>(`sheet-layout:${toolId}`),
      readPersistedState<number[]>(`sheet-copies:${toolId}`)
    ]).then(([savedSettings, savedCopies]) => {
      if (cancelled) return;
      if (savedSettings) setSettings({ ...DEFAULT_SHEET_SETTINGS, ...savedSettings });
      setCopies(fileList.map((_, index) => savedCopies?.[index] ?? 6));
      setCopiesReady(true);
      setSettingsReady(true);
    }).catch(() => {
      if (!cancelled) {
        setCopies(fileList.map(() => 6));
        setCopiesReady(true);
        setSettingsReady(true);
      }
    });
    return () => { cancelled = true; };
  }, [fileList.length, hydrated, toolId]);

  useEffect(() => {
    if (!settingsReady || !copiesReady) return;
    if (settings.paper !== "4x6") {
      fourBySixPresetApplied.current = false;
      return;
    }
    if (fourBySixPresetApplied.current) return;
    fourBySixPresetApplied.current = true;
    setSettings((current) => ({ ...current, paper: "4x6", photosPerRow: 4, photoWidth: 35, photoHeight: 45, gapX: 7.5, gapY: 7.5, margin: 2, border: 2.5, fontSize: 14 }));
    if (fileList.length === 1) setCopies((current) => current[0] === 6 || !current[0] ? [8] : current);
  }, [copiesReady, fileList.length, settings.paper, settingsReady]);

  useEffect(() => {
    if (!settingsReady) return;
    void writePersistedState(`sheet-layout:${toolId}`, settings).catch(() => setNotice("Could not save layout in this browser."));
  }, [settings, settingsReady, toolId]);

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    void readPersistedState<string[]>(`sheet-photo-texts:${toolId}`).then((saved) => {
      if (cancelled) return;
      setPhotoTexts(fileList.map((_, index) => saved?.[index] ?? ""));
      setPhotoTextsReady(true);
    }).catch(() => {
      if (!cancelled) { setPhotoTexts(fileList.map(() => "")); setPhotoTextsReady(true); }
    });
    return () => { cancelled = true; };
  }, [fileList.length, hydrated, toolId]);
  useEffect(() => {
    if (photoTextsReady) void writePersistedState(`sheet-photo-texts:${toolId}`, photoTexts).catch(() => undefined);
  }, [photoTexts, photoTextsReady, toolId]);

  const paper = paperDimensions(settings.paper);
  const capacity = useMemo(() => capacityForLayout({ paper, photo: { width: settings.photoWidth, height: settings.photoHeight }, photosPerRow: settings.photosPerRow, gapX: settings.gapX, gapY: settings.gapY, margin: settings.margin }), [paper, settings]);
  const flow = useMemo(() => layoutPlacements({ paper, photo: { width: settings.photoWidth, height: settings.photoHeight }, photosPerRow: settings.photosPerRow, gapX: settings.gapX, gapY: settings.gapY, margin: settings.margin }, copies), [paper, settings, copies]);
  const jointDimensions = { width: settings.jointTurnToFit ? settings.jointHeight : settings.jointWidth, height: settings.jointTurnToFit ? settings.jointWidth : settings.jointHeight };
  const jointFlow = useMemo(() => layoutJointRows({ paper, joint: jointDimensions, margin: settings.margin, gapX: settings.gapX, gapY: settings.gapY, regularCount: copies.reduce((sum, count) => sum + count, 0), regularColumns: capacity.columns, regularRowsPerPage: capacity.rows, regularPhotoHeight: capacity.photoHeight, jointCount: jointPhotos.length }), [paper, jointDimensions.width, jointDimensions.height, settings, copies, capacity.columns, capacity.rows, capacity.photoHeight, jointPhotos.length]);

  useEffect(() => {
    let disposed = false;
    const urls: string[] = [];
    async function prepare() {
      if (!fileList.length) { setPhotoUrls([]); return; }
      const result: string[] = [];
      for (let index = 0; index < fileList.length; index++) {
        const backgroundBlob = session?.backgroundResults?.[index] ?? (index === 0 ? session?.backgroundResult : undefined);
        if (backgroundBlob instanceof Blob) {
          const backgroundColor = session?.backgroundColors?.[index];
          let outputBlob = backgroundBlob;
          if (backgroundColor && backgroundColor !== "transparent") {
            const foreground = await loadImage(backgroundBlob);
            const canvas = document.createElement("canvas");
            canvas.width = foreground.naturalWidth;
            canvas.height = foreground.naturalHeight;
            const context = canvas.getContext("2d");
            if (context) {
              context.fillStyle = backgroundColor;
              context.fillRect(0, 0, canvas.width, canvas.height);
              context.drawImage(foreground, 0, 0);
              outputBlob = await canvasToBlob(canvas, "image/png");
            }
          }
          const resultUrl = URL.createObjectURL(outputBlob);
          urls.push(resultUrl);
          result.push(resultUrl);
          continue;
        }
        // Older sessions may contain a URL object from before background results were
        // stored as Blobs. Discard that invalid cache and rebuild from the original file.
        if (backgroundBlob) setBackgroundResult(toolId, undefined, index);
        const file = fileList[index];
        try {
          const image = await loadImage(file);
          const currentOperations = photoOperations[index] ?? (index === 0 ? operations : []);
          const snapshot = snapshotFromOperations(image.naturalWidth, image.naturalHeight, currentOperations);
          let canvas = renderCropCanvas(image, snapshot);
          const filterSettings = [...currentOperations].reverse().find((operation) => operation.type === "filters");
          if (filterSettings?.type === "filters") {
            const context = canvas.getContext("2d", { willReadFrequently: true });
            if (context) {
              const mask = document.createElement("canvas");
              mask.width = canvas.width;
              mask.height = canvas.height;
              const maskContext = mask.getContext("2d");
              if (maskContext && filterSettings.settings.maskStrokes.length) {
                for (const stroke of filterSettings.settings.maskStrokes) {
                  if (!stroke.points.length) continue;
                  maskContext.save();
                  maskContext.globalCompositeOperation = stroke.erase ? "destination-out" : "source-over";
                  maskContext.lineWidth = Math.max(1, stroke.radius * canvas.width * 2);
                  maskContext.lineCap = "round";
                  maskContext.lineJoin = "round";
                  maskContext.strokeStyle = "white";
                  maskContext.fillStyle = "white";
                  maskContext.shadowColor = "white";
                  maskContext.shadowBlur = stroke.feather * canvas.width;
                  if (stroke.points.length === 1) {
                    const point = stroke.points[0];
                    maskContext.beginPath();
                    maskContext.arc(point.x * canvas.width, point.y * canvas.height, maskContext.lineWidth / 2, 0, Math.PI * 2);
                    maskContext.fill();
                  } else {
                    maskContext.beginPath();
                    maskContext.moveTo(stroke.points[0].x * canvas.width, stroke.points[0].y * canvas.height);
                    for (const point of stroke.points.slice(1)) maskContext.lineTo(point.x * canvas.width, point.y * canvas.height);
                    maskContext.stroke();
                  }
                  maskContext.restore();
                }
              }
              const maskData = maskContext && filterSettings.settings.maskStrokes.length ? maskContext.getImageData(0, 0, canvas.width, canvas.height).data : undefined;
              context.putImageData(applyFilterSettings(context.getImageData(0, 0, canvas.width, canvas.height), filterSettings.settings, maskData), 0, 0);
            }
          }
          const blob = await canvasToBlob(canvas);
          const url = URL.createObjectURL(blob);
          urls.push(url);
          result.push(url);
        } catch {
          result.push(URL.createObjectURL(file));
          urls.push(result[result.length - 1]);
        }
      }
      if (!disposed) setPhotoUrls(result);
      else urls.forEach(URL.revokeObjectURL);
    }
    void prepare();
    return () => { disposed = true; urls.forEach(URL.revokeObjectURL); };
  }, [fileList, operations, photoOperations, session?.backgroundResult, session?.backgroundResults, session?.backgroundColors, setBackgroundResult, toolId]);

  useEffect(() => {
    const urls = jointPhotos.map((photo) => URL.createObjectURL(photo.image));
    setJointUrls(urls);
    return () => urls.forEach(URL.revokeObjectURL);
  }, [jointPhotos]);

  const update = useCallback(<K extends keyof SheetSettings>(key: K, value: SheetSettings[K]) => setSettings((current) => ({ ...current, [key]: value })), []);
  const transformSelectedPhoto = async (action: "rotate-left" | "rotate-right" | "flip-horizontal" | "flip-vertical") => {
    const index = selectedPhoto;
    const file = index === null ? null : fileList[index];
    if (index === null || !file) { setNotice("Select a photo on the sheet first."); setTransformMenuOpen(false); return; }
    try {
      const { width, height } = await getImageDimensions(file);
      const current = photoOperations[index] ?? (index === 0 ? operations : []);
      const snapshot = snapshotFromOperations(width, height, current);
      if (action === "rotate-left" || action === "rotate-right") {
        const direction = action === "rotate-right" ? 1 : -1;
        const oldWidth = Math.abs(snapshot.rotation % 2) ? height : width;
        const oldHeight = Math.abs(snapshot.rotation % 2) ? width : height;
        const oldCrop = snapshot.crop;
        snapshot.crop = direction === 1
          ? { x: oldHeight - oldCrop.y - oldCrop.height, y: oldCrop.x, width: oldCrop.height, height: oldCrop.width }
          : { x: oldCrop.y, y: oldWidth - oldCrop.x - oldCrop.width, width: oldCrop.height, height: oldCrop.width };
        snapshot.rotation = ((snapshot.rotation + direction) % 4 + 4) % 4;
        if (snapshot.aspectRatio !== null) snapshot.aspectRatio = 1 / snapshot.aspectRatio;
        const inverse: Record<string, string> = { "4:3": "3:4", "3:4": "4:3", "3:2": "2:3", "2:3": "3:2", "16:9": "9:16", "9:16": "16:9" };
        const custom = snapshot.aspectKey.match(/^custom:(\d+):(\d+)$/);
        snapshot.aspectKey = custom ? `custom:${custom[2]}:${custom[1]}` : inverse[snapshot.aspectKey] ?? snapshot.aspectKey;
      } else {
        const orientedWidth = Math.abs(snapshot.rotation % 2) ? height : width;
        const orientedHeight = Math.abs(snapshot.rotation % 2) ? width : height;
        if (action === "flip-horizontal") {
          snapshot.crop.x = orientedWidth - snapshot.crop.x - snapshot.crop.width;
          snapshot.flipHorizontal = !snapshot.flipHorizontal;
        } else {
          snapshot.crop.y = orientedHeight - snapshot.crop.y - snapshot.crop.height;
          snapshot.flipVertical = !snapshot.flipVertical;
        }
      }
      const transformOps: PhotoEditOperation[] = [];
      if (snapshot.rotation !== 0) transformOps.push({ type: "rotate", quarterTurns: snapshot.rotation });
      if (snapshot.flipHorizontal || snapshot.flipVertical) transformOps.push({ type: "flip", horizontal: snapshot.flipHorizontal, vertical: snapshot.flipVertical });
      if (snapshot.straighten !== 0) transformOps.push({ type: "straighten", degrees: snapshot.straighten });
      transformOps.push({ type: "crop", rect: snapshot.crop, aspectRatio: snapshot.aspectRatio, aspectKey: snapshot.aspectKey });
      const otherOps = current.filter((operation) => !["rotate", "flip", "straighten", "crop"].includes(operation.type));
      setPhotoOperations(toolId, index, [...transformOps, ...otherOps]);
    } catch { setNotice("Could not transform this photo."); }
    setTransformMenuOpen(false);
  };
  const selectPaperSize = async (paper: PaperSize) => {
    if (paper === "4x6") {
      if (settings.paper !== "4x6") {
        await writePersistedState(`sheet-layout-before-4x6:${toolId}`, { settings, copies });
      }
      setSettings((current) => ({ ...current, paper, photosPerRow: 4, photoWidth: 35, photoHeight: 45, gapX: 7.5, gapY: 7.5, margin: 2, border: 2.5, fontSize: 14 }));
      if (fileList.length === 1) setCopies([8]);
      return;
    }
    if (settings.paper === "4x6") {
      const previous = await readPersistedState<{ settings: SheetSettings; copies: number[] }>(`sheet-layout-before-4x6:${toolId}`);
      if (previous) {
        setSettings({ ...previous.settings, paper });
        setCopies(fileList.map((_, index) => previous.copies[index] ?? 6));
        await writePersistedState(`sheet-layout-before-4x6:${toolId}`, null);
      } else {
        setSettings({ ...DEFAULT_SHEET_SETTINGS, paper });
        setCopies(fileList.map(() => 6));
      }
      return;
    }
    update("paper", paper);
  };
  const resizeForColumns = (columns: number) => {
    const next = fitPhotoWidthForColumns({ paper, photosPerRow: columns, gapX: settings.gapX, gapY: settings.gapY, margin: settings.margin, aspectRatio: settings.photoWidth / settings.photoHeight });
    setSettings((current) => ({ ...current, photosPerRow: columns, photoWidth: Number(next.width.toFixed(1)), photoHeight: Number(next.height.toFixed(1)) }));
  };

  const selectPreset = (value: string) => {
    const preset = PHOTO_PRESETS.find((item) => item.name === value);
    if (preset) setSettings((current) => ({ ...current, photoWidth: preset.width, photoHeight: preset.height }));
  };

  const uploadMore = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? []).filter((file) => imageFormats.split(",").some((extension) => file.name.toLowerCase().endsWith(extension)));
    event.currentTarget.value = "";
    if (!files.length) { setNotice("Choose JPG, PNG, WebP, GIF, or BMP images."); return; }
    appendFiles(toolId, files);
  };

  const adjustCopies = (index: number, value: number) => setCopies((current) => current.map((count, photoIndex) => photoIndex === index ? Math.max(1, Math.min(500, value || 1)) : count));
  const reorderPhotos = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0) return;
    reorderFiles(toolId, from, to);
    setCopies((current) => { const next = [...current]; const [value] = next.splice(from, 1); next.splice(to, 0, value); return next; });
    setPhotoTexts((current) => { const next = [...current]; const [value] = next.splice(from, 1); next.splice(to, 0, value ?? ""); return next; });
    setSelectedPhoto(to);
  };
  const downloadPhoto = async (index: number) => {
    const src = photoUrls[index];
    if (!src) return;
    const blob = await (await fetch(src)).blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = fileList[index]?.name.replace(/\.[^.]+$/, "") + "-print.png"; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const openPhotoEditor = (index: number) => {
    if (index < 0 || index >= fileList.length) {
      setNotice("Select a photo to edit.");
      return;
    }
    setSelectedPhoto(index);
    window.location.assign(`/app/${toolId}/editor?fileIndex=${index}&returnToSheet=1`);
  };
  const addPhotoText = (index: number) => {
    if (!photoTextsReady) {
      setNotice("Loading saved photo text. Please try again in a moment.");
      return;
    }
    setTextDialog({ index, value: photoTexts[index] ?? "" });
  };
  const savePhotoText = () => {
    if (!textDialog) return;
    const { index, value } = textDialog;
    // photoIndex identifies the source photo, so every placement/copy uses this same text.
    setPhotoTexts((current) => {
      const next = [...current];
      while (next.length < fileList.length) next.push("");
      next[index] = value;
      return next;
    });
    setTextDialog(null);
  };
  const exportInputs = async () => Promise.all(fileList.map(async (file, index) => ({
    image: photoUrls[index] ? await (await fetch(photoUrls[index])).blob() : file,
    quantity: copies[index] ?? 6,
    text: photoTexts[index] ?? ""
  })));
  const exportPdf = async () => {
    const previewTab = window.open("about:blank", "_blank");
    try {
      setNotice("Building 300 DPI PDF…");
      const pdf = await createPdfBlob(settings, await exportInputs(), jointPhotos);
      const url = URL.createObjectURL(pdf);
      if (previewTab) previewTab.location.href = url;
      const link = document.createElement("a"); link.href = url; link.download = "print-sheet.pdf"; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setNotice("PDF opened in a new tab and downloaded.");
    } catch (error) {
      previewTab?.close();
      console.error("PDF export failed", error);
      setNotice("Could not export PDF. Try a smaller sheet or fewer photos.");
    }
  };
  const exportRaster = async (format: "png" | "jpg") => {
    try {
      setNotice(`Building ${format.toUpperCase()} sheet…`);
      const blob = await createImageDownloads(settings, await exportInputs(), jointPhotos, format);
      const url = URL.createObjectURL(blob);
      const multiPage = Math.max(flow.pageCount, jointFlow.pageCount) > 1;
      const link = document.createElement("a"); link.href = url; link.download = `print-sheet${multiPage ? ".zip" : format === "jpg" ? ".jpg" : ".png"}`; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setNotice(multiPage ? `${format.toUpperCase()} pages downloaded in a ZIP.` : `${format.toUpperCase()} sheet downloaded.`);
    } catch (error) { console.error("Sheet image export failed", error); setNotice("Could not export the sheet image."); }
  };
  const exportPhotosZip = async () => {
    try {
      const blob = await createPhotosZip(await exportInputs(), jointPhotos);
      const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "all-photos.zip"; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setNotice("All photos downloaded as a ZIP.");
    } catch (error) { console.error("Photo ZIP export failed", error); setNotice("Could not create the photos ZIP."); }
  };
  useEffect(() => {
    if (copiesReady) void writePersistedState(`sheet-copies:${toolId}`, copies).catch(() => undefined);
  }, [copies, copiesReady, toolId]);

  const clearWorkspace = () => {
    clearFiles(toolId);
    void writePersistedState(`sheet-copies:${toolId}`, []);
    window.location.replace(toolId === "passport-photo" ? "/app/passport-photo/" : `/app/${toolId}/`);
  };

  const totalCopies = copies.reduce((total, count) => total + count, 0);
  const pageCount = Math.max(1, flow.pageCount, jointFlow.pageCount);
  const displayedPageCount = capacity.total > 0 ? pageCount : 1;
  const sheetWidthPx = mmToPx(paper.width, SHEET_SCALE * 25.4) * zoom;
  const sheetHeightPx = mmToPx(paper.height, SHEET_SCALE * 25.4) * zoom;
  const cellWidthPx = mmToPx(capacity.photoWidth, SHEET_SCALE * 25.4) * zoom;
  const cellHeightPx = mmToPx(capacity.photoHeight, SHEET_SCALE * 25.4) * zoom;
  const gapXPx = mmToPx(settings.gapX, SHEET_SCALE * 25.4) * zoom;
  const gapYPx = mmToPx(settings.gapY, SHEET_SCALE * 25.4) * zoom;
  const marginPx = mmToPx(settings.margin, SHEET_SCALE * 25.4) * zoom;
  const borderPx = Math.max(0.5, settings.border * zoom);
  const jointWidthPx = mmToPx(jointDimensions.width, SHEET_SCALE * 25.4) * zoom;
  const jointHeightPx = mmToPx(jointDimensions.height, SHEET_SCALE * 25.4) * zoom;

  return <div data-sheet-workspace className="flex min-h-full flex-col bg-[#f5f7fa] text-slate-800 dark:bg-slate-950 dark:text-slate-100">
    <header className="relative z-20 flex min-h-11 shrink-0 items-center overflow-visible border-b border-slate-200 bg-white px-2 py-1 dark:border-slate-800 dark:bg-slate-900 print:hidden">
      <div className="flex w-full flex-wrap items-center gap-1.5">
        <ToolbarIcon label="Clear photos" onClick={clearWorkspace} danger><Trash2 /></ToolbarIcon>
        <ToolbarIcon label="Build print-accurate PDF" onClick={() => void exportPdf()}><Printer /></ToolbarIcon>
        <div className="relative"><button type="button" title="Download sheet and photos" aria-expanded={exportMenuOpen} onClick={() => setExportMenuOpen((open) => !open)} className="relative flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"><ArrowDownToLine className="h-4 w-4" /><LockKeyhole className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full bg-amber-400 p-0.5 text-white" /></button>{exportMenuOpen && <div className="absolute left-0 top-10 z-30 w-48 rounded-xl border border-slate-200 bg-white p-1 shadow-xl dark:border-slate-700 dark:bg-slate-900"><button onClick={() => { setExportMenuOpen(false); void exportPdf(); }} className="w-full rounded-lg px-3 py-2 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-800">PDF · 300 DPI</button><button onClick={() => { setExportMenuOpen(false); void exportRaster("png"); }} className="w-full rounded-lg px-3 py-2 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-800">Sheet as PNG</button><button onClick={() => { setExportMenuOpen(false); void exportRaster("jpg"); }} className="w-full rounded-lg px-3 py-2 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-800">Sheet as JPG</button><button onClick={() => { setExportMenuOpen(false); void exportPhotosZip(); }} className="w-full rounded-lg px-3 py-2 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-800">All photos as ZIP</button></div>}</div>
        <label title="Upload more photos" className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"><Upload className="h-4 w-4" /><input type="file" accept={imageFormats} multiple onChange={uploadMore} className="hidden" /></label>
        <button type="button" title="Create joint photo" onClick={() => setJointOpen(true)} className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-[11px] hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900"><ImagePlus className="h-3.5 w-3.5" />Joint photo</button>
        <div className="relative"><button type="button" title="Rotate and flip selected photo" aria-label="Rotate and flip selected photo" aria-expanded={transformMenuOpen} disabled={selectedPhoto === null} onClick={() => setTransformMenuOpen((open) => !open)} className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"><RotateCw className="h-4 w-4" /></button>
          {transformMenuOpen && <div role="menu" className="absolute right-0 top-10 z-40 w-40 rounded-lg border border-slate-200 bg-white p-1 shadow-xl dark:border-slate-700 dark:bg-slate-900 sm:left-0 sm:right-auto">
            <TransformAction icon={<RotateCcw />} onClick={() => void transformSelectedPhoto("rotate-left")}>Rotate 90° left</TransformAction>
            <TransformAction icon={<RotateCw />} onClick={() => void transformSelectedPhoto("rotate-right")}>Rotate 90° right</TransformAction>
            <TransformAction icon={<FlipHorizontal2 />} onClick={() => void transformSelectedPhoto("flip-horizontal")}>Flip horizontally</TransformAction>
            <TransformAction icon={<FlipVertical2 />} onClick={() => void transformSelectedPhoto("flip-vertical")}>Flip vertically</TransformAction>
          </div>}
        </div>
        <div className="relative">
          <ToolbarIcon label="Layout settings" onClick={() => setLayoutOpen((open) => !open)}><Settings2 /></ToolbarIcon>
          {layoutOpen && <div className="absolute left-0 top-10 z-30 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <p className="mb-2 text-xs font-semibold">Photo size presets</p>
            {PHOTO_PRESETS.map((preset) => <button key={preset.name} type="button" onClick={() => { selectPreset(preset.name); setLayoutOpen(false); }} className="block w-full rounded-md px-2 py-2 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-800">{preset.name}</button>)}
          </div>}
        </div>
        <label className="relative flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-[11px] dark:border-slate-700 dark:bg-slate-900"><span className="text-slate-400">Fit</span><select aria-label="Image fit type" value={settings.fit} onChange={(event) => update("fit", event.target.value as ImageFit)} className="max-w-20 bg-transparent outline-none"><option value="cover">cover</option><option value="contain">contain</option><option value="fill">fill</option><option value="tile">tile</option></select><ChevronDown className="h-3 w-3" /></label>
        <div className="flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-[11px] dark:border-slate-700 dark:bg-slate-900"><CreditCard className="h-3.5 w-3.5 text-cyan-600" />Credits: 1/1</div>
        <button type="button" onClick={() => setNotice("Credit plans will be available soon.")} className="h-8 rounded-md bg-gradient-to-r from-violet-600 to-purple-600 px-2.5 text-[11px] font-semibold text-white">Buy credits</button>
        <label className="flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-[11px] dark:border-slate-700 dark:bg-slate-900"><span className="sr-only">Paper size</span><select aria-label="Paper size" value={settings.paper} onChange={(event) => selectPaperSize(event.target.value as PaperSize)} className="bg-transparent outline-none">{(["A4", "4x6", "5x7", "A5", "Letter"] as PaperSize[]).map((size) => <option key={size}>{size}</option>)}</select></label>
        <span title={`${capacity.columns} columns × ${capacity.rows} rows = ${capacity.total} photos per sheet`} className="flex h-8 items-center gap-1 whitespace-nowrap rounded-md border border-emerald-200 bg-emerald-50 px-2 text-[10px] font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"><Check className="h-3.5 w-3.5" />{capacity.columns} × {capacity.rows} = {capacity.total}/sheet</span>
        <NumberField label="Photos/row" value={settings.photosPerRow} min={1} max={14} step={1} onChange={(value) => resizeForColumns(value)} />
        <NumberField label="Height (cm)" value={Number(mmToCm(settings.photoHeight).toFixed(2))} min={0.5} step={0.1} onChange={(value) => update("photoHeight", value * 10)} />
        <NumberField label="Width (cm)" value={Number(mmToCm(settings.photoWidth).toFixed(2))} min={0.5} step={0.1} onChange={(value) => update("photoWidth", value * 10)} />
        {TOOLBAR_FIELDS.map(([key, label]) => <NumberField key={key} label={label} value={settings[key]} min={0} step={key === "fontSize" ? 1 : 0.1} onChange={(value) => update(key, value)} />)}
        <ToolbarIcon label="Reset layout" onClick={() => { setSettings(DEFAULT_SHEET_SETTINGS); setCopies(fileList.map(() => 6)); }}><RotateCcw /></ToolbarIcon>
        <span className="mr-1 whitespace-nowrap text-[10px] text-slate-500">{totalCopies} photos</span>
      </div>
    </header>

    <section className="flex min-h-0 flex-1 flex-col overflow-auto px-3 py-8 sm:px-8 print:overflow-visible print:p-0">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col items-center gap-10">
        {fileList.length > 0 && <div className="sticky top-0 z-10 flex items-center gap-1 rounded-lg border border-slate-200 bg-white/95 p-1 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 print:hidden">
          <button type="button" aria-label="Zoom out" onClick={() => setZoom((value) => Math.max(0.35, Number((value - 0.1).toFixed(2))))} className="grid h-7 w-7 place-items-center rounded hover:bg-slate-100 dark:hover:bg-slate-800"><Minus className="h-3.5 w-3.5" /></button>
          <span className="w-12 text-center text-[10px] font-medium text-slate-600 dark:text-slate-300">{Math.round(zoom * 100)}%</span>
          <button type="button" aria-label="Zoom in" onClick={() => setZoom((value) => Math.min(1.5, Number((value + 0.1).toFixed(2))))} className="grid h-7 w-7 place-items-center rounded hover:bg-slate-100 dark:hover:bg-slate-800"><Plus className="h-3.5 w-3.5" /></button>
          <span className="mx-1 h-4 border-l border-slate-200 dark:border-slate-700" />
          <button type="button" onClick={() => setZoom(0.9)} className="flex h-7 items-center gap-1 rounded px-2 text-[10px] hover:bg-slate-100 dark:hover:bg-slate-800"><Maximize2 className="h-3.5 w-3.5" />Fit</button>
          <span className="mx-1 h-4 border-l border-slate-200 dark:border-slate-700" />
          <button type="button" disabled={selectedPhoto === null} onClick={() => selectedPhoto !== null && openPhotoEditor(selectedPhoto)} className="flex h-7 items-center gap-1 rounded bg-slate-900 px-2 text-[10px] font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-slate-950"><Pencil className="h-3.5 w-3.5" />Edit selected</button>
        </div>}
        {!hydrated || !settingsReady ? <div className="py-20 text-sm text-slate-500">Restoring your print session…</div> : !fileList.length ? <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900"><FileImage className="mx-auto h-9 w-9 text-slate-400" /><p className="mt-3 text-sm">No photos in this sheet.</p><button type="button" onClick={() => router.push(`/app/${toolId}`)} className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white dark:bg-white dark:text-slate-950">Choose photos</button></div> : Array.from({ length: displayedPageCount }, (_, pageIndex) => {
          const pagePlacements = flow.placements.filter((placement) => placement.page === pageIndex);
          const jointOnPage = jointFlow.placements.filter((placement) => placement.page === pageIndex);
          return <div key={pageIndex} className="flex flex-col items-center print:break-after-page">
            <div className="sheet-preview-frame relative pl-7 pt-7 print:p-0" style={{ width: sheetWidthPx + 30, maxWidth: "100%", "--paper-width-mm": `${paper.width}mm`, "--paper-height-mm": `${paper.height}mm` } as React.CSSProperties}>
              <Rulers width={paper.width} height={paper.height} zoom={zoom} />
              <div className="sheet-paper relative overflow-hidden bg-white shadow-[0_5px_24px_rgba(15,23,42,.14)] print:shadow-none" style={{ width: sheetWidthPx, height: sheetHeightPx, "--paper-width-mm": `${paper.width}mm`, "--paper-height-mm": `${paper.height}mm` } as React.CSSProperties}>
                {pagePlacements.map((placement, itemIndex) => {
                  const top = marginPx + placement.row * (cellHeightPx + gapYPx);
                  const left = marginPx + placement.column * (cellWidthPx + gapXPx);
                  const fitClass = settings.fit === "contain" ? "object-contain" : settings.fit === "fill" ? "object-fill" : "object-cover";
                  return <div key={`${placement.photoIndex}-${placement.copyIndex}`} title="Double-click to edit" onClick={() => setSelectedPhoto(placement.photoIndex)} onDoubleClick={(event) => { event.preventDefault(); event.stopPropagation(); openPhotoEditor(placement.photoIndex); }} onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); setSelectedPhoto(placement.photoIndex); setContextMenu({ kind: "photo", index: placement.photoIndex, x: event.clientX, y: event.clientY }); }} className={`sheet-photo-cell group absolute overflow-hidden bg-slate-100 ${settings.fit === "tile" ? "bg-repeat" : ""} ${selectedPhoto === placement.photoIndex ? "z-[2] ring-2 ring-cyan-500 ring-offset-1" : ""}`} style={{ left, top, width: cellWidthPx, height: cellHeightPx, border: `${borderPx}px solid #18212f`, backgroundImage: settings.fit === "tile" && photoUrls[placement.photoIndex] ? `url(${photoUrls[placement.photoIndex]})` : undefined, backgroundSize: settings.fit === "tile" ? "50% auto" : undefined, "--left-mm": `${settings.margin + placement.column * (capacity.photoWidth + settings.gapX)}mm`, "--top-mm": `${settings.margin + placement.row * (capacity.photoHeight + settings.gapY)}mm`, "--cell-width-mm": `${capacity.photoWidth}mm`, "--cell-height-mm": `${capacity.photoHeight}mm`, "--border-mm": `${settings.border}mm` } as React.CSSProperties}>
                    {settings.fit !== "tile" && photoUrls[placement.photoIndex] && <img draggable={false} src={photoUrls[placement.photoIndex]} alt={`Photo ${placement.photoIndex + 1}, copy ${placement.copyIndex + 1}`} className={`pointer-events-none h-full w-full select-none ${fitClass}`} />}
                    {photoTexts[placement.photoIndex] && <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-white px-1 text-center text-black" style={{ fontSize: `${Math.max(7, settings.fontSize * zoom)}px` }}>{photoTexts[placement.photoIndex]}</span>}
                    <button type="button" aria-label={`Remove photo ${placement.photoIndex + 1}`} onClick={(event) => { event.stopPropagation(); setCopies((current) => current.map((count, index) => index === placement.photoIndex ? Math.max(0, count - 1) : count)); }} className="absolute -right-1 -top-1 z-10 grid h-5 w-5 translate-x-1 -translate-y-1 place-items-center rounded-full bg-rose-600 text-white opacity-0 shadow transition group-hover:opacity-100 focus:opacity-100"><X className="h-3 w-3" /></button>
                    <span className="sr-only">Sheet position {itemIndex + 1}</span>
                  </div>;
                })}
                {jointOnPage.map((placement) => {
                  const leftMm = settings.margin + placement.column * (jointDimensions.width + settings.gapX);
                  const left = mmToPx(leftMm, SHEET_SCALE * 25.4) * zoom;
                  const top = mmToPx(placement.top, SHEET_SCALE * 25.4) * zoom;
                  return <div key={`joint-${placement.jointIndex}-${placement.column}`} onClick={() => setSelectedJoint(placement.jointIndex)} onContextMenu={(event) => { event.preventDefault(); setContextMenu({ kind: "joint", index: placement.jointIndex, x: event.clientX, y: event.clientY }); }} className={`sheet-photo-cell group absolute overflow-hidden bg-white ${selectedJoint === placement.jointIndex ? "z-[2] ring-2 ring-cyan-500 ring-offset-1" : ""}`} style={{ left, top, width: jointWidthPx, height: jointHeightPx, border: `${borderPx}px solid #18212f`, "--left-mm": `${leftMm}mm`, "--top-mm": `${placement.top}mm`, "--cell-width-mm": `${jointDimensions.width}mm`, "--cell-height-mm": `${jointDimensions.height}mm`, "--border-mm": `${settings.border}mm` } as React.CSSProperties}>
                    {jointUrls[placement.jointIndex] && <img src={jointUrls[placement.jointIndex]} alt="Joint photo" className="h-full w-full object-cover" style={settings.jointTurnToFit ? { width: jointHeightPx, height: jointWidthPx, position: "absolute", left: (jointWidthPx - jointHeightPx) / 2, top: (jointHeightPx - jointWidthPx) / 2, transform: "rotate(90deg)" } : undefined} />}
                    <button type="button" aria-label="Remove joint photo" onClick={(event) => { event.stopPropagation(); const joint = jointPhotos[placement.jointIndex]; if (joint) removeJointPhoto(toolId, joint.id); }} className="absolute -right-1 -top-1 z-10 grid h-5 w-5 translate-x-1 -translate-y-1 place-items-center rounded-full bg-rose-600 text-white opacity-0 shadow transition group-hover:opacity-100 focus:opacity-100"><X className="h-3 w-3" /></button>
                  </div>;
                })}
                <div className="pointer-events-none absolute bottom-2 left-2 right-2 border-t border-dashed border-cyan-500/50 print:hidden" />
              </div>
            </div>
            <div className="mt-6 flex w-[min(720px,90vw)] items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400 print:hidden"><span className="h-px flex-1 border-t border-dashed border-slate-400" /><span>End of page · {pageIndex + 1} / {displayedPageCount}</span><span className="h-px flex-1 border-t border-dashed border-slate-400" /></div>
          </div>;
        })}
      </div>

      {fileList.length > 0 && <div className="mx-auto mt-8 grid w-full max-w-4xl gap-2 pb-12 sm:grid-cols-2 print:hidden">
        {fileList.map((file, index) => <div key={`${file.name}-${index}`} draggable onDragStart={() => setDraggedIndex(index)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (draggedIndex !== null) reorderPhotos(draggedIndex, index); setDraggedIndex(null); }} onContextMenu={(event) => { event.preventDefault(); setContextMenu({ kind: "photo", index, x: event.clientX, y: event.clientY }); }} className="flex cursor-grab items-center gap-3 rounded-lg border border-slate-200 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-900">
          {photoUrls[index] ? <img src={photoUrls[index]} alt="" className="h-12 w-12 rounded-md object-cover" /> : <div className="h-12 w-12 animate-pulse rounded-md bg-slate-100 dark:bg-slate-800" />}
          <span className="min-w-0 flex-1 truncate text-xs">{file.name}</span>
          <NumberField label="Copies" value={copies[index] ?? 6} min={1} max={500} step={1} onChange={(value) => adjustCopies(index, value)} />
        </div>)}
      </div>}
    </section>

    {contextMenu && <>
      <button type="button" aria-label="Close photo menu" onClick={() => setContextMenu(null)} className="fixed inset-0 z-30 cursor-default" />
      <div role="menu" className="fixed z-40 w-48 rounded-lg border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900" style={{ left: Math.min(contextMenu.x, window.innerWidth - 200), top: Math.min(contextMenu.y, window.innerHeight - 220) }}>
        {contextMenu.kind === "photo" ? <>
          <ContextAction onClick={() => { const index = contextMenu.index; setContextMenu(null); openPhotoEditor(index); }}>Edit</ContextAction>
          <ContextAction onClick={() => { setQuantityDialog({ kind: "photo", index: contextMenu.index, quantity: copies[contextMenu.index] ?? 6 }); setContextMenu(null); }}>Add quantity</ContextAction>
          <ContextAction onClick={() => { void downloadPhoto(contextMenu.index); setContextMenu(null); }}>Download</ContextAction>
          <ContextAction onClick={() => { addPhotoText(contextMenu.index); setContextMenu(null); }}>Add In-Image Text</ContextAction>
          <ContextAction danger onClick={() => { setCopies((current) => current.map((count, index) => index === contextMenu.index ? 0 : count)); setContextMenu(null); }}>Remove photo</ContextAction>
        </> : <>
          <ContextAction onClick={() => { const joint = jointPhotos[contextMenu.index]; if (joint) { const url = URL.createObjectURL(joint.image); const link = document.createElement("a"); link.href = url; link.download = "joint-photo.png"; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); } setContextMenu(null); }}>Download</ContextAction>
          <ContextAction onClick={() => { setQuantityDialog({ kind: "joint", index: contextMenu.index, quantity: 1 }); setContextMenu(null); }}>Add quantity</ContextAction>
          <ContextAction danger onClick={() => { const joint = jointPhotos[contextMenu.index]; if (joint) removeJointPhoto(toolId, joint.id); setContextMenu(null); }}>Remove photo</ContextAction>
        </>}
      </div>
    </>}

    {quantityDialog && <div className="fixed inset-0 z-[60] grid place-items-center bg-black/75 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setQuantityDialog(null); }}>
        <form onSubmit={(event) => { event.preventDefault(); const quantity = Math.max(1, Math.min(500, Math.floor(quantityDialog.quantity) || 1)); if (quantityDialog.kind === "photo") adjustCopies(quantityDialog.index, quantity); else { const joint = jointPhotos[quantityDialog.index]; if (joint) for (let count = 1; count < quantity; count++) addJointPhoto(toolId, { ...joint, id: crypto.randomUUID(), createdAt: Date.now() }); } setQuantityDialog(null); }} className="w-full max-w-xs rounded-xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between"><h2 className="font-serif text-sm font-semibold">Enter quantity</h2><button type="button" aria-label="Close" onClick={() => setQuantityDialog(null)} className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4"/></button></div>
        <p className="mb-2 text-[10px] text-slate-500">Quick Presets</p><div className="mb-3 flex flex-wrap gap-1.5">{[1, 2, 4, 6, 8, 12, 16, 32].map((value) => <button key={value} type="button" onClick={() => setQuantityDialog({ ...quantityDialog, quantity: value })} className={`h-7 min-w-7 rounded-md border px-2 text-[10px] ${quantityDialog.quantity === value ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900" : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"}`}>{value}{value === 8 ? " (4x6)" : ""}</button>)}</div>
        <input autoFocus aria-label="Photo quantity" type="number" min={1} max={500} value={quantityDialog.quantity} onChange={(event) => setQuantityDialog({ ...quantityDialog, quantity: Number(event.target.value) })} className="mb-3 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-950"/>
        <button type="submit" className="h-9 w-full rounded-md bg-slate-900 text-xs font-semibold text-white dark:bg-white dark:text-slate-900">Submit</button>
      </form>
    </div>}

    {textDialog && <div className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setTextDialog(null); }}>
      <form onSubmit={(event) => { event.preventDefault(); savePhotoText(); }} className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between"><h2 className="font-serif text-sm font-semibold">Add text to every copy</h2><button type="button" aria-label="Close" onClick={() => setTextDialog(null)} className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button></div>
        <p className="mb-3 text-xs text-slate-500">This text will appear on all {copies[textDialog.index] ?? 6} copies of this photo. Font size uses the sheet Font setting.</p>
        <input autoFocus aria-label="Text to print on photo" value={textDialog.value} onChange={(event) => setTextDialog({ ...textDialog, value: event.target.value })} maxLength={120} className="mb-4 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-950" placeholder="Enter text" />
        <div className="flex justify-between gap-2"><button type="button" onClick={() => setTextDialog({ ...textDialog, value: "" })} className="h-9 rounded-md border border-slate-200 px-3 text-xs dark:border-slate-700">Clear text</button><button type="submit" className="h-9 flex-1 rounded-md bg-slate-900 text-xs font-semibold text-white dark:bg-white dark:text-slate-900">Apply to all copies</button></div>
      </form>
    </div>}

    {notice && <div role="status" className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-xs text-white shadow-xl">{notice}<button type="button" aria-label="Dismiss" onClick={() => setNotice("")}><X className="h-3.5 w-3.5" /></button></div>}
    {jointOpen && <JointPhotoDialog files={fileList} previews={photoUrls} draftStorageKey={`papermitra-joint-draft:${toolId}`} widthCm={settings.jointWidth / 10} heightCm={settings.jointHeight / 10} turnToFit={settings.jointTurnToFit} onSizeChange={(widthCm, heightCm) => setSettings((current) => ({ ...current, jointWidth: widthCm * 10, jointHeight: heightCm * 10 }))} onTurnToFit={(jointTurnToFit) => update("jointTurnToFit", jointTurnToFit)} onUpload={(files) => appendFiles(toolId, files)} onEdit={(fileIndex) => { router.push(`/app/${toolId}/editor?fileIndex=${fileIndex}&returnToJoint=1`); setJointOpen(false); }} onAdd={(image) => addJointPhoto(toolId, { id: crypto.randomUUID(), image, createdAt: Date.now() })} onClose={() => setJointOpen(false)} onToast={setNotice} />}
  </div>;
}

function NumberField({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max?: number; step: number; onChange: (value: number) => void }) {
  return <label className="flex h-8 shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-[9px] text-slate-500 dark:border-slate-700 dark:bg-slate-900"><span className="whitespace-nowrap">{label}</span><input aria-label={label} type="number" min={min} max={max} step={step} value={value} onChange={(event) => { const number = Number(event.target.value); onChange(Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min, Number.isFinite(number) ? number : min))); }} className="w-12 bg-transparent text-center text-[10px] text-slate-700 outline-none dark:text-slate-100" /></label>;
}

function ToolbarIcon({ children, label, onClick, danger = false }: { children: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return <button type="button" title={label} aria-label={label} onClick={onClick} className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800 [&>svg]:h-4 [&>svg]:w-4 ${danger ? "text-rose-600" : "text-slate-700 dark:text-slate-200"}`}>{children}</button>;
}

function ContextAction({ children, onClick, danger = false }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return <button type="button" role="menuitem" onClick={onClick} className={`block w-full rounded-md px-3 py-2 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-800 ${danger ? "text-rose-600" : "text-slate-700 dark:text-slate-200"}`}>{children}</button>;
}

function TransformAction({ children, icon, onClick }: { children: React.ReactNode; icon: React.ReactNode; onClick: () => void }) {
  return <button type="button" role="menuitem" onClick={onClick} className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[11px] text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"><span className="grid h-4 w-4 place-items-center [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>{children}</button>;
}

function Rulers({ width, height, zoom }: { width: number; height: number; zoom: number }) {
  const centimetersX = Math.floor(width / 10);
  const centimetersY = Math.floor(height / 10);
  return <>
    <div aria-hidden="true" className="absolute left-7 top-0 flex h-6 items-end border-b border-sky-200 bg-sky-50 text-[8px] text-slate-500 dark:bg-sky-950 print:hidden" style={{ width: mmToPx(width, SHEET_SCALE * 25.4) * zoom }}>
      {Array.from({ length: centimetersX + 1 }, (_, cm) => <span key={cm} className="relative h-3 border-l border-sky-300 pl-1" style={{ marginLeft: cm === 0 ? 0 : mmToPx(10, SHEET_SCALE * 25.4) * zoom }}>{cm || ""}</span>)}<span className="absolute bottom-0 right-1">cm</span>
    </div>
    <div aria-hidden="true" className="absolute left-0 top-7 flex flex-col border-r border-sky-200 bg-sky-50 text-[8px] text-slate-500 dark:bg-sky-950 print:hidden" style={{ height: mmToPx(height, SHEET_SCALE * 25.4) * zoom }}>
      {Array.from({ length: centimetersY + 1 }, (_, cm) => <span key={cm} className="relative w-6 border-t border-sky-300 pt-0.5 text-right pr-1" style={{ marginTop: cm === 0 ? 0 : mmToPx(10, SHEET_SCALE * 25.4) * zoom }}>{cm || ""}</span>)}
    </div>
  </>;
}

function loadImage(file: Blob) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not decode image")); };
    image.src = url;
  });
}

function getImageDimensions(file: Blob) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => { URL.revokeObjectURL(url); resolve({ width: image.naturalWidth, height: image.naturalHeight }); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not read photo dimensions")); };
    image.src = url;
  });
}

function snapshotFromOperations(width: number, height: number, operations: PhotoEditOperation[]): PhotoEditSnapshot {
  let rotation = 0, straighten = 0, flipHorizontal = false, flipVertical = false;
  let cropOperation: Extract<PhotoEditOperation, { type: "crop" }> | undefined;
  for (const operation of operations) {
    if (operation.type === "rotate") rotation = operation.quarterTurns;
    if (operation.type === "straighten") straighten = operation.degrees;
    if (operation.type === "flip") { flipHorizontal = operation.horizontal; flipVertical = operation.vertical; }
    if (operation.type === "crop") cropOperation = operation;
  }
  const orientedWidth = Math.abs(rotation % 2) ? height : width;
  const orientedHeight = Math.abs(rotation % 2) ? width : height;
  return {
    crop: cropOperation?.rect ?? { x: 0, y: 0, width: orientedWidth, height: orientedHeight },
    aspectRatio: cropOperation?.aspectRatio ?? null,
    aspectKey: cropOperation?.aspectKey ?? "free",
    rotation, straighten, flipHorizontal, flipVertical
  };
}
