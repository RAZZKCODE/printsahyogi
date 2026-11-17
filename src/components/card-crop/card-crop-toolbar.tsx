"use client";

import { Download, Printer, RotateCcw, Trash2, Upload, RefreshCw } from "lucide-react";
import type { CardCropSettings } from "@/tools/card-crop/types";

type Props = {
  settings: CardCropSettings;
  aadhaar: boolean;
  hasCards: boolean;
  busy: boolean;
  onChange: (patch: Partial<CardCropSettings>) => void;
  onUpload: () => void;
  onClear: () => void;
  onReset: () => void;
  onRefresh: () => void;
  onExport: (print: boolean) => void;
};

const control = "h-8 shrink-0 rounded-md border border-slate-200 bg-transparent px-2 text-xs text-slate-700 dark:border-slate-700 dark:text-slate-200";

export function CardCropToolbar({ settings, aadhaar, hasCards, busy, onChange, onUpload, onClear, onReset, onRefresh, onExport }: Props) {
  return <fieldset disabled={busy} aria-label="Card print settings" className="sticky top-0 z-20 flex min-w-0 flex-wrap items-center gap-1.5 border-b border-slate-200 bg-slate-50/95 px-3 py-2 backdrop-blur disabled:opacity-60 dark:border-slate-800 dark:bg-slate-950/95">
    <div className="flex shrink-0 overflow-hidden rounded-md border border-slate-200 dark:border-slate-700">
      <ToolButton label="Remove all cards" disabled={!hasCards} onClick={onClear}><Trash2 size={15}/></ToolButton>
      <ToolButton label="Refresh crops" disabled={!hasCards} onClick={onRefresh}><RefreshCw size={15}/></ToolButton>
      <ToolButton label="Print cards" disabled={!hasCards} onClick={() => onExport(true)}><Printer size={15}/></ToolButton>
      <ToolButton label="Upload PDF" onClick={onUpload}><Upload size={15}/></ToolButton>
      {hasCards && <ToolButton label="Download PDF" onClick={() => onExport(false)}><Download size={15}/></ToolButton>}
    </div>
    {aadhaar && <span className={`${control} inline-flex items-center gap-2`}><span title="This local build processes PDFs on your device without an account credit service">Credits: Local</span><a href="/app/plans" className="rounded-full bg-violet-500 px-2 py-0.5 text-[10px] font-semibold text-white">+ Buy credits</a></span>}
    <select aria-label="Paper size" className={`${control} ${settings.paper === "4x6-glossy" ? "w-44" : "w-20"}`} value={settings.paper} onChange={(event) => {
      const paper = event.target.value as CardCropSettings["paper"];
      onChange({ paper, margin: paper === "PVC" ? 0 : paper.startsWith("4x6") ? 3 : 8, ...(aadhaar && paper !== "A4" ? { cropMode: "card", heightMm: 83.3 } : {}) });
    }}>
      <option value="A4">A4</option>
      {aadhaar ? <><option value="4x6">4x6</option><option value="4x6-glossy">4x6(Double Side Glossy)</option><option value="PVC">PVC</option></> : <><option>A5</option><option>Letter</option></>}
    </select>
    {aadhaar && <>
      {settings.paper === "A4" && <select aria-label="Aadhaar crop mode" className={control} value={settings.cropMode ?? "card"} onChange={(event) => {
        const cropMode = event.target.value as "card" | "full";
        onChange({ cropMode, heightMm: cropMode === "full" ? Math.min(260, settings.paper === "PVC" ? 83.3 : settings.paper.startsWith("4x6") ? 95 : 260) : 83.3 });
      }}><option value="card">Card Size</option><option value="full">Full Aadhaar</option></select>}
      <select aria-label="Background mode" className={`${control} border-amber-300`} value={settings.background ?? "normal"} onChange={(event) => onChange({ background: event.target.value as "normal" | "colored" })}><option value="normal">Normal Background</option><option value="colored">Colored Background</option></select>
    </>}
    <Toggle label="Enhance" checked={settings.enhance} onChange={(enhance) => onChange({ enhance })}/>
    {aadhaar && <Toggle label="Rounded" checked={settings.rounded ?? false} onChange={(rounded) => onChange({ rounded })}/>}
    {settings.paper !== "PVC" && <>
    <NumberControl label="Height" suffix="cm" value={Number((settings.heightMm / 10).toFixed(2))} min={.5} step={.01} onChange={(height) => onChange({ heightMm: height * 10 })}/>
    <NumberControl label="Gap X" value={settings.gapX} min={0} onChange={(gapX) => onChange({ gapX })}/>
    <NumberControl label="Gap Y" value={settings.gapY} min={0} onChange={(gapY) => onChange({ gapY })}/>
    {aadhaar && <NumberControl label="Border" value={settings.border ?? 1} min={0} step={.1} onChange={(border) => onChange({ border })}/>}
    </>}
    <button type="button" onClick={onReset} className={`${control} inline-flex items-center gap-2`}><RotateCcw size={14}/>Reset</button>
    {hasCards && !aadhaar && settings.cropMode !== "full" && <select aria-label="Card sides" className={control} value={settings.sides} onChange={(event) => onChange({ sides: event.target.value as CardCropSettings["sides"] })}><option>Front</option><option>Back</option><option>Both Sides</option></select>}
  </fieldset>;
}

function ToolButton({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" title={label} aria-label={label} disabled={disabled} onClick={onClick} className="grid h-8 w-8 place-items-center text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-35 dark:text-slate-300 dark:hover:bg-slate-800">{children}</button>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <button type="button" role="switch" aria-label={label} aria-checked={checked} onClick={() => onChange(!checked)} className={`${control} inline-flex items-center gap-2`}><span className={`flex h-4 w-8 items-center rounded-full px-0.5 ${checked ? "bg-blue-600" : "bg-slate-200 dark:bg-slate-700"}`}><span className={`h-3 w-3 rounded-full bg-white shadow-sm transition-transform ${checked ? "translate-x-4" : ""}`}/></span>{label}</button>;
}

function NumberControl({ label, value, suffix, min, step = 1, onChange }: { label: string; value: number; suffix?: string; min: number; step?: number; onChange: (value: number) => void }) {
  return <label className={`${control} inline-flex items-center gap-1.5`}><span>{label}</span><input aria-label={suffix ? `${label} (${suffix})` : label} type="number" min={min} step={step} value={value} onChange={(event) => { const next = Number(event.target.value); if (Number.isFinite(next)) onChange(Math.max(min, next)); }} className="w-12 bg-transparent text-center outline-none"/>{suffix && <span className="text-[10px] text-slate-400">{suffix}</span>}</label>;
}
