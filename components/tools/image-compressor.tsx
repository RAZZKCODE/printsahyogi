"use client";

import { useMemo, useState } from "react";
import JSZip from "jszip";
import { Download, FileArchive, LoaderCircle, Minimize2 } from "lucide-react";
import { useUploadStore } from "@/tools/upload/store";

type Result = { name: string; original: number; blob: Blob };
type OutputFormat = "image/jpeg" | "image/webp" | "image/png";
const formats: Record<OutputFormat, string> = { "image/jpeg": "jpg", "image/webp": "webp", "image/png": "png" };

export function ImageCompressor() {
  const files = useUploadStore((s) => s.sessions["compress-image"]?.files ?? []);
  const [mode, setMode] = useState<"target" | "quality">("target");
  const [preset, setPreset] = useState("50");
  const [customKb, setCustomKb] = useState(75);
  const [quality, setQuality] = useState(78);
  const [format, setFormat] = useState<OutputFormat>("image/jpeg");
  const [results, setResults] = useState<Result[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const targetBytes = (preset === "custom" ? customKb : Number(preset)) * 1024;
  const totalBefore = useMemo(() => files.reduce((sum, file) => sum + file.size, 0), [files]);
  const totalAfter = useMemo(() => results.reduce((sum, item) => sum + item.blob.size, 0), [results]);
  const compress = async () => {
    setBusy(true); setMessage("");
    try {
      const next: Result[] = [];
      for (const file of files) {
        const image = await loadImage(file);
        const canvas = document.createElement("canvas"); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
        const ctx = canvas.getContext("2d"); if (!ctx) continue;
        ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(image, 0, 0);
        let blob: Blob;
        if (format === "image/png") blob = await toBlob(canvas, format);
        else if (mode === "quality") blob = await toBlob(canvas, format, quality / 100);
        else {
          let low = 0.05, high = 0.98, best: Blob | null = null;
          for (let i = 0; i < 8; i++) {
            const mid = (low + high) / 2; const candidate = await toBlob(canvas, format, mid);
            if (candidate.size <= targetBytes) { best = candidate; low = mid; } else high = mid;
          }
          blob = best ?? await toBlob(canvas, format, low);
        }
        const baseName = file.name.replace(/\.[^.]+$/, "");
        next.push({ name: `${baseName}-compressed.${formats[format]}`, original: file.size, blob });
      }
      setResults(next);
      if (mode === "target" && format !== "image/png") {
        const missed = next.filter((item) => item.blob.size > targetBytes).length;
        setMessage(missed ? `${missed} image${missed === 1 ? "" : "s"} could not reach the selected size at readable quality.` : "Compression complete.");
      } else setMessage("Compression complete.");
    } catch (error) { setMessage(`Could not compress image: ${(error as Error).message}`); }
    finally { setBusy(false); }
  };
  const downloadOne = (result: Result) => saveBlob(result.blob, result.name);
  const downloadZip = async () => { const zip = new JSZip(); results.forEach((item) => zip.file(item.name, item.blob)); saveBlob(await zip.generateAsync({ type: "blob" }), "compressed-images.zip"); };
  if (!files.length) return <div className="grid min-h-[70vh] place-items-center text-sm text-slate-500">No images selected. Return to Image Compressor and add files.</div>;
  return <main className="mx-auto min-h-full max-w-5xl px-4 py-8"><header className="mb-6 text-center"><div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-cyan-100 text-cyan-700"><Minimize2/></div><h1 className="font-serif text-3xl font-semibold">Image Compressor</h1><p className="mt-2 text-sm text-slate-500">Reduce file size or convert your images locally</p></header>
    <section className="rounded-2xl border bg-white p-5 shadow-sm dark:bg-slate-900"><div className="flex flex-wrap gap-2"><button className={`rounded-lg px-4 py-2 text-sm ${mode === "target" ? "bg-slate-900 text-white" : "border"}`} onClick={() => setMode("target")}>Target size</button><button className={`rounded-lg px-4 py-2 text-sm ${mode === "quality" ? "bg-slate-900 text-white" : "border"}`} onClick={() => setMode("quality")}>Quality</button><label className="ml-auto text-sm">Output format <select className="ml-2 rounded-lg border bg-transparent px-3 py-2" value={format} onChange={(e) => setFormat(e.target.value as OutputFormat)}><option value="image/jpeg">JPG</option><option value="image/webp">WebP</option><option value="image/png">PNG</option></select></label></div>
      {mode === "target" ? <div className="mt-5 flex flex-wrap items-center gap-3"><span className="text-sm font-medium">Target size</span>{[20, 50, 100, 200].map((value) => <button key={value} onClick={() => setPreset(String(value))} className={`rounded-full border px-4 py-2 text-sm ${preset === String(value) ? "border-cyan-600 bg-cyan-50 text-cyan-800" : ""}`}>{value} KB</button>)}<label className="text-sm"><input type="radio" checked={preset === "custom"} onChange={() => setPreset("custom" as const)} className="mr-2"/>Custom</label>{preset === "custom" && <input type="number" min="5" value={customKb} onChange={(e) => setCustomKb(Math.max(5, Number(e.target.value)))} className="w-24 rounded border px-2 py-2"/>}</div> : <label className="mt-5 block text-sm">Quality: {quality}%<input type="range" min="10" max="100" value={quality} onChange={(e) => setQuality(Number(e.target.value))} className="mt-2 w-full"/></label>}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4"><p className="text-sm text-slate-500">{files.length} images · Before <b className="text-slate-800 dark:text-slate-100">{formatSize(totalBefore)}</b>{results.length > 0 && <> · After <b className="text-emerald-700">{formatSize(totalAfter)}</b></>}</p><div className="flex gap-2"><button disabled={!results.length} onClick={() => void downloadZip()} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40"><FileArchive className="mr-1 inline" size={15}/>Download ZIP</button><button disabled={busy} onClick={() => void compress()} className="rounded-lg bg-cyan-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{busy ? <><LoaderCircle className="mr-2 inline animate-spin" size={15}/>Compressing</> : "Compress images"}</button></div></div>
    </section>
    {message && <p role="status" className="mt-4 rounded-lg bg-cyan-50 px-4 py-3 text-sm text-cyan-900">{message}</p>}
    <div className="mt-5 grid gap-3">{files.map((file, i) => { const result = results[i]; return <article key={`${file.name}-${i}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4 dark:bg-slate-900"><div className="min-w-0"><p className="truncate text-sm font-medium">{file.name}</p><p className="text-xs text-slate-500">{formatSize(file.size)}{result && <> → <span className="font-semibold text-emerald-700">{formatSize(result.blob.size)}</span> ({Math.max(0, Math.round((1 - result.blob.size / file.size) * 100))}% smaller)</>}</p></div>{result && <button onClick={() => downloadOne(result)} className="rounded-lg border px-3 py-2 text-sm"><Download className="mr-1 inline" size={15}/>Download</button>}</article>; })}</div>
  </main>;
}

function formatSize(size: number) { return size < 1024 * 1024 ? `${(size / 1024).toFixed(1)} KB` : `${(size / 1024 / 1024).toFixed(2)} MB`; }
function loadImage(file: File) { return new Promise<HTMLImageElement>((resolve, reject) => { const url = URL.createObjectURL(file); const image = new Image(); image.onload = () => { URL.revokeObjectURL(url); resolve(image); }; image.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`Unable to read ${file.name}`)); }; image.src = url; }); }
function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number) { return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Image conversion failed")), type, quality)); }
function saveBlob(blob: Blob, name: string) { const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 30_000); }
