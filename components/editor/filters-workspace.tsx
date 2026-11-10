"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Download, Eraser, Eye, Paintbrush, Redo2, RotateCcw, Sparkles, Undo2 } from "lucide-react";
import { applyFilterSettings, DEFAULT_FILTER_SETTINGS, FILTER_ADJUSTMENTS, getFilterHistogram } from "@/tools/editor/filter-engine";
import { canvasToBlob, renderCropCanvas } from "@/tools/editor/image-export";
import type { BrushStroke, FilterAdjustment, FilterSettings, PhotoEditSnapshot } from "@/tools/editor/types";

type Props = {
  image: HTMLImageElement;
  snapshot: PhotoEditSnapshot;
  settings: FilterSettings;
  onSettingsChange: (settings: FilterSettings) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onSave: () => void;
};

const adjustmentLabels: Record<FilterAdjustment, string> = {
  exposure: "Exposure", brighten: "Brighten", darken: "Darken", deepen: "Deepen", contrast: "Contrast",
  lightenShadows: "Lighten Shadows", darkenHighlights: "Darken Highlights", saturation: "Saturation", vibrance: "Vibrance",
  temperature: "Temperature", tint: "Tint", sharpen: "Sharpen", clarity: "Clarity", noiseReduction: "Noise reduction",
  vignette: "Vignette", grain: "Grain", blur: "Blur"
};

const sections: Array<{ title: string; keys: FilterAdjustment[] }> = [
  { title: "Light", keys: ["exposure", "brighten", "darken", "deepen", "contrast"] },
  { title: "Shadows & Highlights", keys: ["lightenShadows", "darkenHighlights"] },
  { title: "Color", keys: ["saturation", "vibrance", "temperature", "tint"] },
  { title: "Detail", keys: ["sharpen", "clarity", "noiseReduction"] },
  { title: "Effects", keys: ["vignette", "grain", "blur"] }
];

const autoLabels = ["Off", "Low", "Med", "High"];

export function FiltersWorkspace({ image, snapshot, settings, onSettingsChange, onUndo, onRedo, canUndo, canRedo, onSave }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const displayRef = useRef({ left: 0, top: 0, width: 0, height: 0 });
  const activeStrokeRef = useRef<BrushStroke | null>(null);
  const [sourceCanvas, setSourceCanvas] = useState<HTMLCanvasElement | null>(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [mode, setMode] = useState<"adjust" | "mask">("adjust");
  const [compare, setCompare] = useState(false);
  const [activeStroke, setActiveStroke] = useState<BrushStroke | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSourceCanvas(renderCropCanvas(image, snapshot, 1400));
  }, [image, snapshot]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(([entry]) => setStageSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  const visibleSettings = useMemo(() => activeStroke
    ? { ...settings, maskStrokes: [...settings.maskStrokes, activeStroke] }
    : settings, [activeStroke, settings]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !sourceCanvas || !stageSize.width || !stageSize.height) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(stageSize.width * dpr);
    canvas.height = Math.round(stageSize.height * dpr);
    const context = canvas.getContext("2d");
    const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
    if (!context || !sourceContext) return;
    const fit = Math.min(stageSize.width / sourceCanvas.width, stageSize.height / sourceCanvas.height);
    const drawWidth = sourceCanvas.width * fit;
    const drawHeight = sourceCanvas.height * fit;
    const left = (stageSize.width - drawWidth) / 2;
    const top = (stageSize.height - drawHeight) / 2;
    displayRef.current = { left, top, width: drawWidth, height: drawHeight };
    const original = sourceContext.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
    const maskCanvas = document.createElement("canvas");
    maskCanvas.width = sourceCanvas.width;
    maskCanvas.height = sourceCanvas.height;
    const maskContext = maskCanvas.getContext("2d");
    if (!maskContext) return;
    for (const stroke of visibleSettings.maskStrokes) {
      if (stroke.points.length === 0) continue;
      maskContext.save();
      maskContext.globalCompositeOperation = stroke.erase ? "destination-out" : "source-over";
      const lineWidth = Math.max(1, stroke.radius * sourceCanvas.width * 2);
      maskContext.lineWidth = lineWidth;
      maskContext.lineCap = "round";
      maskContext.lineJoin = "round";
      maskContext.strokeStyle = "white";
      maskContext.fillStyle = "white";
      maskContext.shadowColor = "white";
      maskContext.shadowBlur = stroke.feather * sourceCanvas.width;
      if (stroke.points.length === 1) {
        const point = stroke.points[0];
        maskContext.beginPath();
        maskContext.arc(point.x * sourceCanvas.width, point.y * sourceCanvas.height, lineWidth / 2, 0, Math.PI * 2);
        maskContext.fill();
      } else {
        maskContext.beginPath();
        maskContext.moveTo(stroke.points[0].x * sourceCanvas.width, stroke.points[0].y * sourceCanvas.height);
        for (const point of stroke.points.slice(1)) maskContext.lineTo(point.x * sourceCanvas.width, point.y * sourceCanvas.height);
        maskContext.stroke();
      }
      maskContext.restore();
    }
    const maskData = settings.maskStrokes.length || activeStroke ? maskContext.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height).data : undefined;
    const filtered = compare ? original : applyFilterSettings(original, visibleSettings, maskData);
    const resultCanvas = document.createElement("canvas");
    resultCanvas.width = sourceCanvas.width;
    resultCanvas.height = sourceCanvas.height;
    resultCanvas.getContext("2d")?.putImageData(filtered, 0, 0);

    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, stageSize.width, stageSize.height);
    context.fillStyle = "#f1f5f9";
    context.fillRect(0, 0, stageSize.width, stageSize.height);
    context.drawImage(resultCanvas, left, top, drawWidth, drawHeight);
    if (mode === "mask" && maskData && !compare) {
      const tintCanvas = document.createElement("canvas");
      tintCanvas.width = sourceCanvas.width;
      tintCanvas.height = sourceCanvas.height;
      const tintContext = tintCanvas.getContext("2d");
      if (tintContext) {
        tintContext.fillStyle = "#22d3ee";
        tintContext.fillRect(0, 0, tintCanvas.width, tintCanvas.height);
        tintContext.globalCompositeOperation = "destination-in";
        tintContext.putImageData(new ImageData(new Uint8ClampedArray(maskData), sourceCanvas.width, sourceCanvas.height), 0, 0);
        context.globalAlpha = 0.3;
        context.drawImage(tintCanvas, left, top, drawWidth, drawHeight);
        context.globalAlpha = 1;
      }
    }
  }, [activeStroke, compare, mode, settings, sourceCanvas, stageSize, visibleSettings]);

  const update = (patch: Partial<FilterSettings>) => onSettingsChange({ ...settings, ...patch });
  const updateAdjustment = (key: FilterAdjustment, value: number) => onSettingsChange({ ...settings, adjustments: { ...settings.adjustments, [key]: value } });

  const pointFromEvent = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const bounds = displayRef.current;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left - bounds.left;
    const y = event.clientY - rect.top - bounds.top;
    if (x < 0 || y < 0 || x > bounds.width || y > bounds.height || bounds.width === 0) return null;
    return { x: x / bounds.width, y: y / bounds.height };
  };

  const pointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (mode !== "mask") return;
    const point = pointFromEvent(event);
    if (!point) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const stroke = { points: [point], radius: settings.brushSize / displayRef.current.width / 2, feather: settings.brushFeather / 100 * settings.brushSize / displayRef.current.width / 2, erase: settings.eraseMode };
    activeStrokeRef.current = stroke;
    setActiveStroke(stroke);
  };

  const pointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!activeStrokeRef.current) return;
    const point = pointFromEvent(event);
    if (!point) return;
    const next = { ...activeStrokeRef.current, points: [...activeStrokeRef.current.points, point] };
    activeStrokeRef.current = next;
    setActiveStroke(next);
  };

  const pointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const stroke = activeStrokeRef.current;
    if (!stroke) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    activeStrokeRef.current = null;
    setActiveStroke(null);
    onSettingsChange({ ...settings, maskStrokes: [...settings.maskStrokes, stroke] });
  };

  const changeAuto = (key: "autoColor" | "autoLevels" | "autoContrast", value: number) => update({ [key]: value });

  const reset = () => onSettingsChange(DEFAULT_FILTER_SETTINGS);
  const sharpen = () => updateAdjustment("sharpen", Math.max(35, settings.adjustments.sharpen));

  const download = async () => {
    setBusy(true);
    try {
      const full = renderCropCanvas(image, snapshot);
      const ctx = full.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      const sourceData = ctx.getImageData(0, 0, full.width, full.height);
      const maskCanvas = document.createElement("canvas");
      maskCanvas.width = full.width; maskCanvas.height = full.height;
      const maskContext = maskCanvas.getContext("2d");
      let maskData: Uint8ClampedArray | undefined;
      if (maskContext && settings.maskStrokes.length) {
        for (const stroke of settings.maskStrokes) {
          if (!stroke.points.length) continue;
          maskContext.save();
          maskContext.globalCompositeOperation = stroke.erase ? "destination-out" : "source-over";
          maskContext.lineWidth = Math.max(1, stroke.radius * full.width * 2);
          maskContext.lineCap = "round"; maskContext.lineJoin = "round";
          maskContext.strokeStyle = "white"; maskContext.fillStyle = "white"; maskContext.shadowColor = "white";
          maskContext.shadowBlur = stroke.feather * full.width;
          if (stroke.points.length === 1) {
            const point = stroke.points[0];
            maskContext.beginPath(); maskContext.arc(point.x * full.width, point.y * full.height, maskContext.lineWidth / 2, 0, Math.PI * 2); maskContext.fill();
          } else {
            maskContext.beginPath(); maskContext.moveTo(stroke.points[0].x * full.width, stroke.points[0].y * full.height);
            for (const point of stroke.points.slice(1)) maskContext.lineTo(point.x * full.width, point.y * full.height);
            maskContext.stroke();
          }
          maskContext.restore();
        }
        maskData = maskContext.getImageData(0, 0, full.width, full.height).data;
      }
      ctx.putImageData(applyFilterSettings(sourceData, settings, maskData), 0, 0);
      const blob = await canvasToBlob(full);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = "papermitra-filtered.png"; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
      setBusy(false);
    }
  };

  return <div className="flex min-h-0 flex-1 flex-col gap-2 p-2 sm:flex-row sm:gap-3 sm:p-3">
    <main className="relative flex min-h-[30vh] min-w-0 flex-1 items-center justify-center overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-900 sm:min-h-0">
      {!sourceCanvas && <span className="text-xs text-slate-500">Preparing preview…</span>}
      <canvas ref={canvasRef} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} className={`absolute inset-0 h-full w-full ${mode === "mask" ? "cursor-crosshair touch-none" : ""}`} />
      <span className="pointer-events-none absolute bottom-3 left-3 rounded bg-white/80 px-2 py-1 text-[10px] text-slate-600 dark:bg-slate-950/75 dark:text-slate-300">{compare ? "Before" : "After"}</span>
    </main>

    <aside className="flex h-[48vh] max-h-[520px] w-full shrink-0 flex-col overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-900 sm:h-auto sm:max-h-none sm:w-[320px]">
      <div className="flex shrink-0 items-center justify-end gap-1 border-b border-slate-200 p-2 dark:border-slate-800">
        <IconButton label="Undo" disabled={!canUndo} onClick={onUndo}><Undo2 /></IconButton>
        <IconButton label="Redo" disabled={!canRedo} onClick={onRedo}><Redo2 /></IconButton>
        <button type="button" onClick={() => setCompare((value) => !value)} className={`h-8 rounded-md border px-2.5 text-[11px] font-medium ${compare ? "border-cyan-600 bg-cyan-600 text-white" : "border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"}`}><Eye className="mr-1 inline h-3.5 w-3.5" />Compare</button>
        <button type="button" onClick={reset} className="h-8 rounded-md border border-slate-200 bg-white px-2.5 text-[11px] text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"><RotateCcw className="mr-1 inline h-3.5 w-3.5" />Reset</button>
      </div>
      <Histogram sourceCanvas={sourceCanvas} />
      <div className="grid shrink-0 grid-cols-2 gap-1 border-b border-slate-200 px-2 pb-2 dark:border-slate-800">
        <button type="button" onClick={() => setMode("adjust")} className={`h-8 rounded-md text-[11px] font-semibold ${mode === "adjust" ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950" : "bg-white text-slate-600 dark:bg-slate-950 dark:text-slate-300"}`}>Adjust</button>
        <button type="button" onClick={() => setMode("mask")} className={`h-8 rounded-md text-[11px] font-semibold ${mode === "mask" ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950" : "bg-white text-slate-600 dark:bg-slate-950 dark:text-slate-300"}`}><Paintbrush className="mr-1 inline h-3.5 w-3.5" />Brush Mask</button>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2.5">
        {mode === "adjust" ? <>
          <div className="flex items-center gap-2 rounded-md bg-white px-2.5 py-2 dark:bg-slate-950">
            <select aria-label="Color preset" value={settings.preset} onChange={(event) => update({ preset: event.target.value })} className="h-8 min-w-0 flex-1 bg-transparent text-xs text-slate-700 outline-none dark:text-slate-200">
              <option value="original">Original Color</option><option value="bw">B&amp;W</option><option value="sepia">Sepia</option><option value="warm">Warm</option><option value="cool">Cool</option>
            </select>
            <button type="button" role="switch" aria-checked={settings.negative} onClick={() => update({ negative: !settings.negative })} className="flex items-center gap-1.5 text-[10px] text-slate-600 dark:text-slate-300"><Toggle checked={settings.negative} />Negative</button>
          </div>
          <div className="space-y-2 rounded-md bg-white p-2.5 dark:bg-slate-950">
            <AutoLevels label="Auto Color" value={settings.autoColor} onChange={(value) => changeAuto("autoColor", value)} />
            <AutoLevels label="Auto Levels" value={settings.autoLevels} onChange={(value) => changeAuto("autoLevels", value)} />
            <AutoLevels label="Auto Contrast" value={settings.autoContrast} onChange={(value) => changeAuto("autoContrast", value)} />
            <div className="flex gap-5 pt-1"><ToggleWithLabel label="HDR" checked={settings.hdr} onChange={(checked) => update({ hdr: checked })} /><ToggleWithLabel label="Magic Color" checked={settings.magicColor} onChange={(checked) => update({ magicColor: checked })} /></div>
          </div>
          {sections.map((section) => <details key={section.title} open className="rounded-md bg-white px-2.5 py-2 dark:bg-slate-950">
            <summary className="cursor-pointer list-none py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200">{section.title}<span className="float-right text-slate-400">⌄</span></summary>
            <div className="space-y-2.5 pt-2">
              {section.keys.map((key) => <RangeSetting key={key} label={adjustmentLabels[key]} value={settings.adjustments[key]} onChange={(value) => updateAdjustment(key, value)} gradient={key === "temperature" ? "from-blue-500 via-slate-100 to-orange-400" : key === "tint" ? "from-emerald-400 via-slate-100 to-fuchsia-500" : undefined} pro={key === "sharpen"} />)}
            </div>
          </details>)}
        </> : <div className="space-y-3 rounded-md bg-white p-3 dark:bg-slate-950">
          <div><h3 className="text-xs font-semibold text-slate-800 dark:text-slate-100">Paint adjustment mask</h3><p className="mt-1 text-[10px] leading-4 text-slate-500">Paint over areas that should receive adjustments. The rest of the image stays untouched.</p></div>
          <RangeSetting label="Brush size" value={settings.brushSize} min={4} max={180} onChange={(value) => update({ brushSize: value })} displayValue={`${Math.round(settings.brushSize)} px`} />
          <RangeSetting label="Feather" value={settings.brushFeather} min={0} max={100} onChange={(value) => update({ brushFeather: value })} displayValue={`${Math.round(settings.brushFeather)}%`} />
          <ToggleWithLabel label="Erase mask" checked={settings.eraseMode} onChange={(checked) => update({ eraseMode: checked })} icon={<Eraser className="h-3.5 w-3.5" />} />
          <button type="button" onClick={() => update({ maskStrokes: [] })} className="w-full rounded-md border border-slate-200 px-3 py-2 text-[11px] text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900">Clear mask</button>
        </div>}
      </div>
      <div className="grid shrink-0 grid-cols-2 gap-1.5 border-t border-slate-200 p-2.5 dark:border-slate-800">
        <button type="button" onClick={sharpen} className="rounded-md border border-slate-200 bg-white px-2 py-2 text-[11px] font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"><Sparkles className="mr-1 inline h-3.5 w-3.5" />Sharpen</button>
        <button type="button" onClick={reset} className="rounded-md border border-slate-200 bg-white px-2 py-2 text-[11px] font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"><RotateCcw className="mr-1 inline h-3.5 w-3.5" />Reset</button>
        <button type="button" onClick={onSave} className="rounded-md bg-slate-900 px-2 py-2 text-[11px] font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950"><Check className="mr-1 inline h-3.5 w-3.5" />Save</button>
        <button type="button" disabled={busy} onClick={download} className="rounded-md bg-violet-700 px-2 py-2 text-[11px] font-semibold text-white hover:bg-violet-800 disabled:opacity-50"><Download className="mr-1 inline h-3.5 w-3.5" />{busy ? "Exporting…" : "Download"}</button>
      </div>
    </aside>
  </div>;
}

function Histogram({ sourceCanvas }: { sourceCanvas: HTMLCanvasElement | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const source = sourceCanvas?.getContext("2d", { willReadFrequently: true });
    const context = canvas?.getContext("2d");
    if (!canvas || !context || !sourceCanvas || !source) return;
    const data = source.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
    const channels = getFilterHistogram(data);
    const max = Math.max(...channels.flat(), 1);
    const colors = ["rgba(248,113,113,.75)", "rgba(74,222,128,.65)", "rgba(96,165,250,.7)"];
    context.clearRect(0, 0, canvas.width, canvas.height);
    channels.forEach((channel, channelIndex) => {
      context.beginPath();
      context.strokeStyle = colors[channelIndex];
      context.lineWidth = 1.3;
      channel.forEach((count, index) => {
        const x = index / (channel.length - 1) * canvas.width;
        const y = canvas.height - count / max * canvas.height * 0.9;
        if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
      });
      context.stroke();
    });
  }, [sourceCanvas]);
  return <canvas ref={ref} width={600} height={68} aria-label="RGB histogram" role="img" className="h-14 w-full shrink-0 bg-slate-950" />;
}

function AutoLevels({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <div className="flex items-center justify-between gap-2"><span className="text-[10px] text-slate-700 dark:text-slate-300">{label}</span><div className="flex gap-0.5">{autoLabels.map((name, index) => <button key={name} type="button" onClick={() => onChange(index)} className={`rounded px-1.5 py-1 text-[9px] ${value === index ? "bg-slate-900 font-semibold text-white dark:bg-white dark:text-slate-950" : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"}`}>{name}</button>)}</div></div>;
}

function RangeSetting({ label, value, min = -100, max = 100, onChange, gradient, pro, displayValue }: { label: string; value: number; min?: number; max?: number; onChange: (value: number) => void; gradient?: string; pro?: boolean; displayValue?: string }) {
  return <label className="block" onDoubleClick={() => onChange(0)} title="Double-click to reset">
    <span className="mb-1 flex items-center justify-between gap-2 text-[10px] text-slate-700 dark:text-slate-300"><span>{label}{pro && <span className="ml-1 rounded bg-amber-100 px-1 py-0.5 text-[8px] font-bold text-amber-800">PRO</span>}</span><span className="text-slate-400">{displayValue ?? `${value > 0 ? "+" : ""}${Math.round(value)}`}</span></span>
    <input type="range" min={min} max={max} step={1} value={value} onChange={(event) => onChange(Number(event.target.value))} className={`h-1.5 w-full cursor-pointer appearance-none rounded-full accent-slate-600 ${gradient ? `bg-gradient-to-r ${gradient}` : "bg-slate-300 dark:bg-slate-700"}`} />
  </label>;
}

function Toggle({ checked }: { checked: boolean }) {
  return <span className={`relative inline-flex h-4 w-7 shrink-0 rounded-full transition ${checked ? "bg-cyan-600" : "bg-slate-300 dark:bg-slate-700"}`}><span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition ${checked ? "left-3.5" : "left-0.5"}`} /></span>;
}

function ToggleWithLabel({ label, checked, onChange, icon }: { label: string; checked: boolean; onChange: (checked: boolean) => void; icon?: React.ReactNode }) {
  return <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="inline-flex items-center gap-1.5 text-[10px] text-slate-700 dark:text-slate-300">{icon}<Toggle checked={checked} />{label}</button>;
}

function IconButton({ children, label, disabled, onClick }: { children: React.ReactNode; label: string; disabled?: boolean; onClick: () => void }) {
  return <button type="button" title={label} aria-label={label} disabled={disabled} onClick={onClick} className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-35 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 [&>svg]:h-4 [&>svg]:w-4">{children}</button>;
}
