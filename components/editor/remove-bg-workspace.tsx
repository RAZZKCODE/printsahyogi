"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Download, Eraser, LoaderCircle, Pipette, RotateCcw, Sparkles } from "lucide-react";
import { canvasToBlob, renderCropCanvas } from "@/tools/editor/image-export";
import type { PhotoEditSnapshot } from "@/tools/editor/types";

type Props = {
  image: HTMLImageElement | null;
  snapshot: PhotoEditSnapshot | null;
  initialResult: Blob | null;
  initialColor?: string;
  onResultChange: (result: Blob | null) => void;
  onColorChange: (color: string) => void;
  onSave: (result?: Blob, backgroundColor?: string) => void;
};

const CREDIT_STORAGE_KEY = "papermitra-free-bg-credits";
const palette = [
  { name: "Transparent", value: "transparent" },
  { name: "White", value: "#FFFFFF" },
  { name: "Black", value: "#000000" },
  { name: "Red", value: "#EF4444" },
  { name: "Blue", value: "#3B82F6" },
  { name: "Green", value: "#22C55E" },
  { name: "Yellow", value: "#EAB308" },
  { name: "Purple", value: "#A855F7" },
  { name: "Pink", value: "#EC4899" },
  { name: "Orange", value: "#F97316" },
  { name: "Teal", value: "#14B8A6" },
  { name: "Gray", value: "#6B7280" }
];

export function RemoveBgWorkspace({ image, snapshot, initialResult, initialColor = "transparent", onResultChange, onColorChange, onSave }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const baseResultRef = useRef<Blob | null>(null);
  const undoStackRef = useRef<ImageData[]>([]);
  const drawingRef = useRef(false);
  const [credits, setCredits] = useState(1);
  const [creditReady, setCreditReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selectedColor, setSelectedColor] = useState(initialColor);
  const [customColor, setCustomColor] = useState("#FFFFFF");
  const [brushSize, setBrushSize] = useState(20);
  const [smoothness, setSmoothness] = useState(60);
  const [erasing, setErasing] = useState(true);
  const [canUndo, setCanUndo] = useState(false);
  const [brushCursor, setBrushCursor] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    setSelectedColor(initialColor);
    if (initialColor !== "transparent") setCustomColor(initialColor);
  }, [initialColor]);

  const chooseColor = (color: string) => {
    setSelectedColor(color);
    onColorChange(color);
  };

  useEffect(() => {
    const stored = window.localStorage.getItem(CREDIT_STORAGE_KEY);
    if (stored === null) {
      window.localStorage.setItem(CREDIT_STORAGE_KEY, "20");
      setCredits(20);
    } else {
      setCredits(Math.max(0, Number.parseInt(stored, 10) || 0));
    }
    setCreditReady(true);
  }, []);

  useEffect(() => {
    if (!initialResult) {
      baseResultRef.current = null;
      undoStackRef.current = [];
      setCanUndo(false);
      return;
    }
    if (!baseResultRef.current) baseResultRef.current = initialResult;
    let cancelled = false;
    const url = URL.createObjectURL(initialResult);
    const foreground = new Image();
    foreground.onload = () => {
      if (cancelled) return;
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d");
      if (!canvas || !context) return;
      canvas.width = foreground.naturalWidth;
      canvas.height = foreground.naturalHeight;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(foreground, 0, 0);
    };
    foreground.src = url;
    return () => {
      cancelled = true;
      URL.revokeObjectURL(url);
    };
  }, [initialResult]);

  const removeBackground = async () => {
    if (!image || !snapshot || running || credits <= 0) return;
    setRunning(true);
    setProgress(1);
    setError("");
    setProgressLabel("Preparing image…");
    try {
      const cropped = renderCropCanvas(image, snapshot);
      const input = await canvasToBlob(cropped, "image/png");
      const remove = await import("@imgly/background-removal");
      const result = await remove.removeBackground(input, {
        model: "isnet_quint8",
        output: { format: "image/png" },
        progress: (stage, current, total) => {
          setProgress(total > 0 ? Math.max(1, Math.round(current / total * 100)) : 0);
          setProgressLabel(stage.split(":").at(-1)?.replace(/-/g, " ") ?? "Processing");
        }
      });
      undoStackRef.current = [];
      baseResultRef.current = result;
      setCanUndo(false);
      setSelectedColor("transparent");
      setProgress(100);
      setProgressLabel("Background removed");
      onResultChange(result);
      const nextCredits = Math.max(0, credits - 1);
      setCredits(nextCredits);
      window.localStorage.setItem(CREDIT_STORAGE_KEY, String(nextCredits));
    } catch (cause) {
      console.error("Background removal failed", cause);
      setError("Background removal could not finish. Check your connection and try again.");
      setProgress(0);
      setProgressLabel("");
    } finally {
      setRunning(false);
    }
  };

  const getCanvasBlob = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return Promise.reject(new Error("Preview is not ready"));
    return canvasToBlob(canvas, "image/png");
  }, []);

  const pointFromEvent = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * canvas.width / rect.width,
      y: (event.clientY - rect.top) * canvas.height / rect.height
    };
  };

  const moveBrushCursor = (event: React.PointerEvent<HTMLCanvasElement>) => {
    setBrushCursor({ x: event.clientX, y: event.clientY });
  };

  const startErase = (event: React.PointerEvent<HTMLCanvasElement>) => {
    moveBrushCursor(event);
    if (!erasing || !initialResult) return;
    const canvas = event.currentTarget;
    const context = canvas.getContext("2d");
    if (!context || canvas.width === 0) return;
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    undoStackRef.current.push(context.getImageData(0, 0, canvas.width, canvas.height));
    setCanUndo(true);
    drawingRef.current = true;
    const point = pointFromEvent(event);
    context.beginPath();
    context.moveTo(point.x, point.y);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.globalCompositeOperation = "destination-out";
    context.globalAlpha = 0.25 + smoothness / 100 * 0.75;
    context.lineWidth = brushSize * canvas.width / Math.max(1, canvas.clientWidth);
    context.shadowBlur = (100 - smoothness) / 100 * context.lineWidth * 0.45;
    context.shadowColor = "rgba(0,0,0,1)";
    context.lineTo(point.x + 0.01, point.y + 0.01);
    context.stroke();
  };

  const eraseMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    moveBrushCursor(event);
    if (!drawingRef.current) return;
    const context = event.currentTarget.getContext("2d");
    if (!context) return;
    const point = pointFromEvent(event);
    context.lineTo(point.x, point.y);
    context.stroke();
  };

  const endErase = async (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const context = event.currentTarget.getContext("2d");
    context?.closePath();
    if (context) {
      context.globalCompositeOperation = "source-over";
      context.globalAlpha = 1;
      context.shadowBlur = 0;
    }
    try { onResultChange(await getCanvasBlob()); } catch { setError("Could not save the erased area."); }
  };

  const undo = async () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    const previous = undoStackRef.current.pop();
    if (!canvas || !context || !previous) return;
    context.putImageData(previous, 0, 0);
    setCanUndo(undoStackRef.current.length > 0);
    onResultChange(await getCanvasBlob());
  };

  const reset = async () => {
    const source = baseResultRef.current;
    const canvas = canvasRef.current;
    if (!source || !canvas) return;
    const url = URL.createObjectURL(source);
    try {
      const foreground = await loadImage(url);
      canvas.width = foreground.naturalWidth;
      canvas.height = foreground.naturalHeight;
      canvas.getContext("2d")?.drawImage(foreground, 0, 0);
      undoStackRef.current = [];
      setCanUndo(false);
      setSelectedColor("transparent");
      setErasing(true);
      onResultChange(await getCanvasBlob());
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const compose = async () => {
    const foreground = await getCanvasBlob();
    if (selectedColor === "transparent") return foreground;
    const sourceUrl = URL.createObjectURL(foreground);
    try {
      const source = await loadImage(sourceUrl);
      const output = document.createElement("canvas");
      output.width = source.naturalWidth;
      output.height = source.naturalHeight;
      const context = output.getContext("2d");
      if (!context) throw new Error("Canvas is unavailable");
      context.fillStyle = selectedColor;
      context.fillRect(0, 0, output.width, output.height);
      context.drawImage(source, 0, 0);
      return await canvasToBlob(output, "image/png");
    } finally {
      URL.revokeObjectURL(sourceUrl);
    }
  };

  const download = async () => {
    try {
      const blob = await compose();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "papermitra-background-removed.png";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError("Could not download the image. Please try again.");
    }
  };

  const apply = async () => {
    if (saving || !initialResult) return;
    setSaving(true);
    setError("");
    try {
      const result = await getCanvasBlob();
      onResultChange(result);
      onSave(result, selectedColor);
    } catch (cause) {
      console.error("Could not apply background", cause);
      setError("Could not apply these changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-[#f6f6f7] text-slate-900 dark:bg-slate-950 dark:text-slate-100">
    {!initialResult ? <div className="flex flex-1 flex-col items-center justify-center gap-4 p-5 text-center">
      <div className="w-full max-w-[960px] overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {image && snapshot ? <img src={image.src} alt="Photo before background removal" className="mx-auto max-h-[65vh] max-w-full object-contain" /> : <p className="p-12 text-sm text-slate-500">Choose a photo to get started.</p>}
      </div>
      <p className="text-xs text-slate-500">{creditReady ? `${credits} ${credits === 1 ? "credit" : "credits"} left` : "Checking credits…"}</p>
      <button type="button" disabled={!image || !snapshot || !creditReady || credits <= 0 || running} onClick={removeBackground} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-violet-700 px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50">
        {running ? <><LoaderCircle className="h-4 w-4 animate-spin" />{progress}%</> : <><Sparkles className="h-4 w-4" />Remove Background</>}
      </button>
      {running && <div className="w-full max-w-sm">
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-violet-600 transition-all" style={{ width: `${progress}%` }} /></div>
        <p className="mt-1 text-center text-[10px] capitalize text-slate-500">{progressLabel || "Running locally in your browser"}</p>
        <p className="mt-2 text-[10px] text-slate-400">Your photo stays on this device.</p>
      </div>}
      {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
    </div> : <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 lg:flex-row lg:p-6">
      <main className="flex min-h-[320px] flex-1 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:min-h-0">
        <div className={`flex h-full max-h-[calc(100vh-170px)] w-full items-center justify-center overflow-hidden rounded-md ${selectedColor === "transparent" ? "[background-image:conic-gradient(#e5e7eb_25%,white_0_50%,#e5e7eb_0_75%,white_0)] [background-size:18px_18px]" : ""}`} style={selectedColor === "transparent" ? undefined : { backgroundColor: selectedColor }}>
          <div className="inline-flex max-h-full max-w-full items-center justify-center">
            <canvas ref={canvasRef} aria-label="Background removed image preview" onPointerEnter={moveBrushCursor} onPointerLeave={() => { if (!drawingRef.current) setBrushCursor(null); }} onPointerDown={startErase} onPointerMove={eraseMove} onPointerUp={(event) => void endErase(event)} onPointerCancel={(event) => void endErase(event)} className={`max-h-full max-w-full object-contain ${erasing ? "cursor-none touch-none" : "cursor-default"}`} />
          </div>
        </div>
        {erasing && brushCursor && <span aria-hidden="true" className="pointer-events-none fixed z-[120] rounded-full border-2 border-black bg-white/10 shadow-[0_0_0_1px_white,0_1px_5px_rgba(0,0,0,0.9)]" style={{ left: brushCursor.x, top: brushCursor.y, width: brushSize, height: brushSize, transform: "translate(-50%, -50%)" }} />}
      </main>

      <aside className="flex w-full shrink-0 flex-col rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:w-[320px]">
        <div className="space-y-5 p-4 sm:p-5">
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Pipette className="h-4 w-4 text-violet-600" />Select Background Color</h2>
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <span className="flex min-w-0 items-center gap-3"><span className="h-9 w-9 shrink-0 rounded-lg border border-slate-200" style={{ backgroundColor: customColor }} /><span className="min-w-0"><span className="block text-sm font-medium">Custom Color</span><span className="block text-xs uppercase text-slate-500">{customColor}</span></span></span>
              <input type="color" aria-label="Choose custom background color" value={customColor} onChange={(event) => { setCustomColor(event.target.value); chooseColor(event.target.value); }} className="h-9 w-10 cursor-pointer rounded-md border border-violet-200 bg-white p-1" />
            </label>
            <div className="mt-3 grid grid-cols-6 gap-2" role="group" aria-label="Background colors">
              {palette.map((color) => <button key={color.value} type="button" title={color.name} aria-label={`Set background to ${color.name}`} aria-pressed={selectedColor.toLowerCase() === color.value.toLowerCase()} onClick={() => chooseColor(color.value)} className={`relative aspect-square w-full rounded-xl border border-slate-200 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700 ${selectedColor.toLowerCase() === color.value.toLowerCase() ? "ring-2 ring-violet-500 ring-offset-2 dark:ring-offset-slate-900" : ""}`} style={color.value === "transparent" ? { backgroundImage: "conic-gradient(#d1d5db 25%, white 0 50%, #d1d5db 0 75%, white 0)", backgroundSize: "12px 12px" } : { backgroundColor: color.value }}>
                {selectedColor.toLowerCase() === color.value.toLowerCase() && <span className="absolute inset-0 flex items-center justify-center"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-white"><Check className="h-3 w-3" /></span></span>}
              </button>)}
            </div>
            <button type="button" onClick={() => chooseColor("transparent")} aria-pressed={selectedColor === "transparent"} className={`mt-4 flex w-full items-center gap-3 rounded-lg border p-3 text-left transition ${selectedColor === "transparent" ? "border-violet-200 bg-violet-50 dark:border-violet-900 dark:bg-violet-950/30" : "border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"}`}>
              <span className="h-8 w-8 rounded-md border border-slate-200 [background-image:conic-gradient(#d1d5db_25%,white_0_50%,#d1d5db_0_75%,white_0)] [background-size:10px_10px]" />
              <span><span className="block text-sm font-medium">Transparent</span><span className="block text-xs text-slate-500">No background color</span></span>
            </button>
          </section>

          <section className="border-t border-slate-200 pt-4 dark:border-slate-700">
            <div className="mb-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => setErasing((value) => !value)} className={`inline-flex h-9 items-center gap-2 rounded-md px-3 text-xs font-semibold transition ${erasing ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950" : "border border-slate-300 text-slate-700 dark:border-slate-600 dark:text-slate-200"}`}><Eraser className="h-4 w-4" />{erasing ? "Stop Erasing" : "Erase Background"}</button>
              <button type="button" onClick={() => void undo()} disabled={!canUndo} className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"><RotateCcw className="h-4 w-4" />Undo</button>
              <button type="button" onClick={() => void reset()} className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 px-3 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:border-slate-700 dark:hover:bg-slate-800"><RotateCcw className="h-4 w-4" />Reset</button>
            </div>
            <label className="mb-4 block text-xs text-slate-600 dark:text-slate-300">Brush Size <span className="float-right text-slate-500">{brushSize}px</span><input type="range" min={5} max={80} value={brushSize} onChange={(event) => setBrushSize(Number(event.target.value))} className="mt-2 w-full accent-violet-600" /></label>
            <label className="block text-xs text-slate-600 dark:text-slate-300">Smoothness <span className="float-right text-slate-500">{smoothness}%</span><input type="range" min={0} max={100} value={smoothness} onChange={(event) => setSmoothness(Number(event.target.value))} className="mt-2 w-full accent-violet-600" /></label>
          </section>
        </div>

        <div className="mt-auto grid grid-cols-2 gap-2 border-t border-slate-200 p-4 dark:border-slate-700">
          <button type="button" onClick={() => void download()} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"><Download className="h-4 w-4" />Download</button>
          <button type="button" disabled={saving} onClick={() => void apply()} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-slate-900 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-950"><Check className="h-4 w-4" />{saving ? "Applying…" : "Apply"}</button>
          {error && <p role="alert" className="col-span-2 text-xs text-rose-700 dark:text-rose-300">{error}</p>}
        </div>
      </aside>
    </div>}
  </div>;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load the image"));
    image.src = src;
  });
}
