"use client";

import { useEffect, useState } from "react";
import { Download, ImagePlus, RotateCcw, ShieldCheck } from "lucide-react";

type Kind = "photo" | "signature";
type Size = { width: number; height: number };
type Output = { blob: Blob; width: number; height: number };

const initialSizes: Record<Kind, Size> = {
  photo: { width: 2.5, height: 3.5 },
  signature: { width: 4.5, height: 2 }
};

export function PanCardResizer() {
  const [files, setFiles] = useState<Partial<Record<Kind, File>>>({});
  const [sizes, setSizes] = useState(initialSizes);
  const [outputs, setOutputs] = useState<Partial<Record<Kind, Output>>>({});
  const [previews, setPreviews] = useState<Partial<Record<Kind, string>>>({});
  const [fit, setFit] = useState<"contain" | "cover">("contain");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const next: Partial<Record<Kind, string>> = {};
    for (const kind of ["photo", "signature"] as const) {
      if (files[kind]) next[kind] = URL.createObjectURL(files[kind]!);
    }
    setPreviews(next);
    setOutputs({});
    return () => Object.values(next).forEach(URL.revokeObjectURL);
  }, [files]);

  const setFile = (kind: Kind, file?: File) => {
    setFiles((current) => ({ ...current, [kind]: file }));
    setMessage("");
  };

  const resize = async () => {
    if (!files.photo && !files.signature) {
      setMessage("Choose a PAN profile photo or signature first.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const result: Partial<Record<Kind, Output>> = {};
      for (const kind of ["photo", "signature"] as const) {
        const file = files[kind];
        if (!file) continue;
        const size = sizes[kind];
        const width = Math.max(1, Math.round((size.width / 2.54) * 300));
        const height = Math.max(1, Math.round((size.height / 2.54) * 300));
        const image = await readImage(file);
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Image canvas is unavailable.");
        context.fillStyle = "#fff";
        context.fillRect(0, 0, width, height);
        drawFit(context, image, width, height, fit);
        result[kind] = { blob: await toBlob(canvas), width, height };
      }
      setOutputs(result);
      setMessage("Resize complete. Output is prepared at 300 DPI.");
    } catch (error) {
      setMessage((error as Error).message || "Could not resize the selected image.");
    } finally {
      setBusy(false);
    }
  };

  const download = (kind: Kind) => {
    const output = outputs[kind];
    if (!output) return;
    const link = document.createElement("a");
    const url = URL.createObjectURL(output.blob);
    link.href = url;
    link.download = `pan-${kind}-300dpi.png`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const reset = () => {
    setFiles({});
    setOutputs({});
    setSizes(initialSizes);
    setFit("contain");
    setMessage("");
  };

  return <main className="mx-auto min-h-full max-w-5xl px-4 py-8 sm:px-7">
    <header className="mb-7 text-center"><h1 className="font-serif text-3xl font-semibold">PAN Card Photo &amp; Signature Resizer</h1><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Resize a PAN profile photo or signature to print-ready dimensions in your browser.</p></header>
    <section className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4 dark:bg-slate-900">
      <label className="flex items-center gap-2 text-sm">Image fit <select value={fit} onChange={(event) => setFit(event.target.value as typeof fit)} className="rounded-md border bg-transparent px-3 py-2"><option value="contain">Fit inside, keep full image</option><option value="cover">Fill frame, crop edges</option></select></label>
      <div className="flex gap-2"><button type="button" onClick={reset} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"><RotateCcw size={15}/>Reset</button><button type="button" disabled={busy || (!files.photo && !files.signature)} onClick={() => void resize()} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-slate-900">{busy ? "Resizing…" : "Resize images"}</button></div>
    </section>
    <div className="grid gap-5 md:grid-cols-2">{(["photo", "signature"] as const).map((kind) => {
      const file = files[kind];
      const size = sizes[kind];
      const output = outputs[kind];
      const label = kind === "photo" ? "PAN profile photo" : "PAN signature";
      return <section key={kind} className="rounded-2xl border bg-white p-5 shadow-sm dark:bg-slate-900">
        <div className="mb-4 flex items-start justify-between gap-3"><div><h2 className="font-serif text-xl font-semibold">{label}</h2><p className="mt-1 text-xs text-slate-500">Output dimensions in centimetres</p></div><label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium"><ImagePlus size={15}/>{file ? "Change image" : "Choose image"}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => setFile(kind, event.currentTarget.files?.[0])}/></label></div>
        <div className="grid grid-cols-2 gap-3"><label className="text-xs text-slate-500">Width (cm)<input type="number" min="0.5" max="15" step="0.1" value={size.width} onChange={(event) => setSizes((current) => ({ ...current, [kind]: { ...current[kind], width: Math.max(0.5, Number(event.target.value)) } }))} className="mt-1 h-9 w-full rounded-md border bg-transparent px-2 text-sm text-slate-800 dark:text-slate-100"/></label><label className="text-xs text-slate-500">Height (cm)<input type="number" min="0.5" max="15" step="0.1" value={size.height} onChange={(event) => setSizes((current) => ({ ...current, [kind]: { ...current[kind], height: Math.max(0.5, Number(event.target.value)) } }))} className="mt-1 h-9 w-full rounded-md border bg-transparent px-2 text-sm text-slate-800 dark:text-slate-100"/></label></div>
        <div className="mt-4 grid min-h-52 place-items-center overflow-hidden rounded-xl border border-dashed bg-slate-50 p-4 dark:bg-slate-950">{previews[kind] ? <img src={previews[kind]} alt={`${label} preview`} className="max-h-48 max-w-full object-contain"/> : <button type="button" onClick={() => document.getElementById(`pan-${kind}-file`)?.click()} className="text-center text-sm text-slate-500">Select a {kind} image to preview<input id={`pan-${kind}-file`} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => setFile(kind, event.currentTarget.files?.[0])}/></button>}</div>
        {output && <div className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"><span>{output.width} × {output.height} px · 300 DPI</span><button type="button" onClick={() => download(kind)} className="inline-flex items-center gap-1.5 font-semibold"><Download size={14}/>Download PNG</button></div>}
      </section>;
    })}</div>
    {message && <p role="status" className="mt-5 rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-900 dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-100">{message}</p>}
    <p className="mt-7 text-center text-xs text-emerald-700 dark:text-emerald-300"><ShieldCheck className="mr-1 inline" size={14}/>Images are resized locally in this browser and are not uploaded.</p>
  </main>;
}

function readImage(file: File) { return new Promise<HTMLImageElement>((resolve, reject) => { const url = URL.createObjectURL(file); const image = new Image(); image.onload = () => { URL.revokeObjectURL(url); resolve(image); }; image.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`Could not read ${file.name}.`)); }; image.src = url; }); }
function toBlob(canvas: HTMLCanvasElement) { return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Image export failed.")), "image/png")); }
function drawFit(context: CanvasRenderingContext2D, image: HTMLImageElement, width: number, height: number, fit: "contain" | "cover") { const scale = fit === "cover" ? Math.max(width / image.naturalWidth, height / image.naturalHeight) : Math.min(width / image.naturalWidth, height / image.naturalHeight); const drawWidth = image.naturalWidth * scale; const drawHeight = image.naturalHeight * scale; context.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight); }
