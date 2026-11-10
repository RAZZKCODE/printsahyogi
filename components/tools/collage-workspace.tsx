"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Printer, Plus, RotateCcw } from "lucide-react";
import { PDFDocument } from "pdf-lib";
import { useUploadStore } from "@/tools/upload/store";

type Cell = { file: number | null; zoom: number; x: number; y: number };
const templates = [{ name: "2 × 2", columns: 2, count: 4 }, { name: "3 × 2", columns: 3, count: 6 }, { name: "2 × 3", columns: 2, count: 6 }, { name: "3 × 3", columns: 3, count: 9 }];

export function CollageWorkspace() {
  const files = useUploadStore((s) => s.sessions.collage?.files ?? []);
  const appendFiles = useUploadStore((s) => s.appendFiles);
  const clearFiles = useUploadStore((s) => s.clearFiles);
  const [template, setTemplate] = useState(templates[0]);
  const [cells, setCells] = useState<Cell[]>([]);
  const [gap, setGap] = useState(10);
  const [radius, setRadius] = useState(0);
  const [background, setBackground] = useState("#ffffff");
  const [format, setFormat] = useState<"image/png" | "image/jpeg">("image/png");
  const [urls, setUrls] = useState<string[]>([]);
  const [drag, setDrag] = useState<number | null>(null);
  const [error, setError] = useState("");
  const pan = useRef<{ index: number; x: number; y: number; startX: number; startY: number } | null>(null);
  useEffect(() => { const next = files.map((file) => URL.createObjectURL(file)); setUrls(next); return () => next.forEach(URL.revokeObjectURL); }, [files]);
  useEffect(() => { setCells(Array.from({ length: template.count }, (_, i) => ({ file: i < files.length ? i : null, zoom: 1, x: 0, y: 0 }))); }, [files.length, template]);
  const filled = useMemo(() => cells.filter((cell) => cell.file !== null).length, [cells]);
  const updateCell = (index: number, patch: Partial<Cell>) => setCells((current) => current.map((cell, i) => i === index ? { ...cell, ...patch } : cell));
  const download = async (type: string = format, shouldPrint = false) => {
    const canvas = document.createElement("canvas"); canvas.width = 1800; canvas.height = 1200;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    ctx.fillStyle = background; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const cellW = (canvas.width - gap * (template.columns + 1)) / template.columns;
    const rows = Math.ceil(template.count / template.columns); const cellH = (canvas.height - gap * (rows + 1)) / rows;
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i]; if (cell.file === null || !urls[cell.file]) continue;
      const image = new Image(); image.src = urls[cell.file]; await new Promise((resolve) => { image.onload = resolve; });
      const x = gap + (i % template.columns) * (cellW + gap), y = gap + Math.floor(i / template.columns) * (cellH + gap);
      const scale = Math.max(cellW / image.width, cellH / image.height) * cell.zoom;
      const sw = cellW / scale, sh = cellH / scale; const sx = (image.width - sw) / 2 - cell.x * image.width, sy = (image.height - sh) / 2 - cell.y * image.height;
      ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, cellW, cellH, radius); ctx.clip(); ctx.drawImage(image, sx, sy, sw, sh, x, y, cellW, cellH); ctx.restore();
    }
    if (type === "application/pdf") {
      const pdf = await PDFDocument.create(); const page = pdf.addPage([612, 408]); const bytes = await canvasToBlob(canvas, "image/png").then((b) => b.arrayBuffer()); const img = await pdf.embedPng(bytes); page.drawImage(img, { x: 0, y: 0, width: 612, height: 408 }); const blob = new Blob([new Uint8Array(await pdf.save()).buffer as ArrayBuffer], { type }); if (shouldPrint) { const url = URL.createObjectURL(blob); const opened = window.open(url, "_blank"); if (opened) window.setTimeout(() => opened.print(), 1200); } else saveBlob(blob, "photo-collage.pdf");
    } else saveBlob(await canvasToBlob(canvas, type, .92), `photo-collage.${type === "image/png" ? "png" : "jpg"}`);
  };
  if (files.length === 0) return <div className="grid min-h-[70vh] place-items-center text-sm text-slate-500">No photos selected. Return to Collage and add photos.</div>;
  return <main className="min-h-full bg-slate-50 p-4 dark:bg-slate-950 sm:p-6"><div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-3 dark:bg-slate-900"><div className="flex items-center gap-2"><label className="cursor-pointer rounded-lg border px-3 py-2 text-sm"><Plus className="mr-1 inline" size={15}/>Add photos<input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { if (e.target.files?.length) appendFiles("collage", Array.from(e.target.files)); }}/></label><select className="rounded-lg border bg-transparent px-3 py-2 text-sm" value={template.name} onChange={(e) => setTemplate(templates.find((item) => item.name === e.target.value)!)}>{templates.map((t) => <option key={t.name}>{t.name}</option>)}</select><button onClick={() => { clearFiles("collage"); }} className="rounded border p-2"><RotateCcw size={15}/></button></div><div className="flex gap-2"><button onClick={() => void download("application/pdf", true)} className="rounded-lg border px-3 py-2 text-sm"><Printer className="mr-1 inline" size={15}/>Print</button><select className="rounded-lg border bg-transparent px-2 text-sm" value={format} onChange={(e) => setFormat(e.target.value as typeof format)}><option value="image/png">PNG</option><option value="image/jpeg">JPG</option></select><button onClick={() => void download()} className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white"><Download className="mr-1 inline" size={15}/>Download</button><button onClick={() => void download("application/pdf")} className="rounded-lg border px-3 py-2 text-sm">PDF</button></div></div>
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]"><section className="mx-auto grid aspect-[3/2] w-full max-w-5xl bg-white shadow-xl" style={{ gridTemplateColumns: `repeat(${template.columns}, minmax(0,1fr))`, gap, padding: gap, background }} onDragOver={(e) => e.preventDefault()}>{cells.map((cell, index) => <div key={index} onPointerDown={(e) => { if (!(e.target instanceof HTMLImageElement)) return; e.currentTarget.setPointerCapture(e.pointerId); pan.current = { index, x: cell.x, y: cell.y, startX: e.clientX, startY: e.clientY }; }} onPointerMove={(e) => { const p = pan.current; if (!p || p.index !== index) return; updateCell(index, { x: Math.min(.5, Math.max(-.5, p.x + (e.clientX - p.startX) / e.currentTarget.clientWidth)), y: Math.min(.5, Math.max(-.5, p.y + (e.clientY - p.startY) / e.currentTarget.clientHeight)) }); }} onPointerUp={() => { pan.current = null; }} onDrop={(e) => { e.preventDefault(); const n = Number(e.dataTransfer.getData("file-index")); if (!Number.isNaN(n)) updateCell(index, { file: n }); setDrag(null); }} onDragOver={() => setDrag(index)} className={`relative overflow-hidden bg-slate-200 ${drag === index ? "ring-2 ring-cyan-500" : ""}`} style={{ borderRadius: radius }}>
      {cell.file !== null && urls[cell.file] && <img draggable onDragStart={(e) => { e.dataTransfer.setData("file-index", String(cell.file)); }} src={urls[cell.file]} alt={`Collage cell ${index + 1}`} className="h-full w-full cursor-grab object-cover" style={{ transform: `scale(${cell.zoom}) translate(${cell.x * 100}%, ${cell.y * 100}%)` }} onWheel={(e) => updateCell(index, { zoom: Math.min(3, Math.max(1, cell.zoom + (e.deltaY < 0 ? .08 : -.08))) })} onDoubleClick={() => updateCell(index, { zoom: cell.zoom >= 1.5 ? 1 : 1.5 })}/>} {!urls[cell.file ?? -1] && <button className="h-full w-full text-sm text-slate-500" onClick={() => updateCell(index, { file: index % files.length })}>Drop photo here or click to fill</button>}
      <div className="absolute bottom-2 left-2 flex items-center gap-2 rounded-md bg-white/90 p-1.5 text-xs shadow"><span>Zoom</span><input aria-label="Cell zoom" type="range" min="1" max="3" step=".05" value={cell.zoom} onChange={(e) => updateCell(index, { zoom: Number(e.target.value) })}/></div></div>)}</section>
    <aside className="h-fit rounded-xl border bg-white p-4 dark:bg-slate-900"><h2 className="font-semibold">Layout</h2><p className="mb-4 text-xs text-slate-500">{filled} of {template.count} cells filled. Drag a thumbnail into a cell to place it. Adjust each cell with its zoom control.</p><label className="mb-4 block text-xs">Spacing: {gap}px<input className="mt-2 w-full" type="range" min="0" max="40" value={gap} onChange={(e) => setGap(Number(e.target.value))}/></label><label className="mb-4 block text-xs">Corner radius: {radius}px<input className="mt-2 w-full" type="range" min="0" max="60" value={radius} onChange={(e) => setRadius(Number(e.target.value))}/></label><label className="block text-xs">Background<input className="ml-3 h-8 w-12 align-middle" type="color" value={background} onChange={(e) => setBackground(e.target.value)}/></label><h3 className="mb-2 mt-6 text-sm font-medium">Photos</h3><div className="grid grid-cols-4 gap-2">{urls.map((url, i) => <img key={`${files[i].name}-${i}`} draggable onDragStart={(e) => e.dataTransfer.setData("file-index", String(i))} src={url} alt={files[i].name} className="aspect-square w-full cursor-grab rounded border object-cover"/> )}</div>{error && <p className="mt-3 text-xs text-rose-600">{error}</p>}</aside></div></main>;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number) { return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not export collage")), type, quality)); }
function saveBlob(blob: Blob, name: string) { const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 30_000); }

