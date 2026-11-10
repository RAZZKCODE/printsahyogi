"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Crop, Plus, Upload, X } from "lucide-react";
import { canvasToBlob } from "@/tools/editor/image-export";

type Person = { id: number; fileIndex: number | null; zoom: number; offsetX: number; offsetY: number };
type Divider = "none" | "white" | "black";
type Props = {
  files: File[];
  previews: string[];
  draftStorageKey: string;
  widthCm: number;
  heightCm: number;
  turnToFit: boolean;
  onSizeChange: (width: number, height: number) => void;
  onTurnToFit: (enabled: boolean) => void;
  onUpload: (files: File[]) => void;
  onEdit: (fileIndex: number) => void;
  onAdd: (image: Blob) => void;
  onClose: () => void;
  onToast: (message: string) => void;
};

const palette = ["#ffffff", "#050505", "#ef3340", "#3b82f6", "#22c55e", "#facc15", "#a855f7", "#ec4899", "#f97316", "#14b8a6", "#64748b"];
const imageFormats = ".jpg,.jpeg,.png,.webp,.gif,.bmp";

export function JointPhotoDialog({ files, previews, draftStorageKey, widthCm, heightCm, turnToFit, onSizeChange, onTurnToFit, onUpload, onEdit, onAdd, onClose, onToast }: Props) {
  const [people, setPeople] = useState<Person[]>([
    { id: 1, fileIndex: files.length ? 0 : null, zoom: 1, offsetX: 0, offsetY: 0 },
    { id: 2, fileIndex: files.length > 1 ? 1 : null, zoom: 1, offsetX: 0, offsetY: 0 }
  ]);
  const [background, setBackground] = useState("original");
  const [divider, setDivider] = useState<Divider>("none");
  const [dragging, setDragging] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = window.sessionStorage.getItem(draftStorageKey);
    if (!saved) return;
    try {
      const draft = JSON.parse(saved) as { people?: Person[]; background?: string; divider?: Divider };
      if (draft.people?.length) setPeople(draft.people.slice(0, 3));
      if (draft.background) setBackground(draft.background);
      if (draft.divider) setDivider(draft.divider);
    } catch { window.sessionStorage.removeItem(draftStorageKey); }
  }, [draftStorageKey]);

  useEffect(() => {
    let alive = true;
    void renderJointCanvas(files, previews, people, background, divider, widthCm, heightCm).then((canvas) => {
      if (!alive || !canvasRef.current) return;
      canvasRef.current.width = canvas.width;
      canvasRef.current.height = canvas.height;
      canvasRef.current.getContext("2d")?.drawImage(canvas, 0, 0);
    });
    return () => { alive = false; };
  }, [files, previews, people, background, divider, widthCm, heightCm]);

  const updatePerson = (id: number, patch: Partial<Person>) => setPeople((current) => current.map((person) => person.id === id ? { ...person, ...patch } : person));
  const movePerson = (index: number, direction: -1 | 1) => setPeople((current) => {
    const next = [...current];
    const target = index + direction;
    if (target < 0 || target >= next.length) return current;
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  });

  const upload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const added = Array.from(event.currentTarget.files ?? []).filter((file) => /^image\/(jpeg|png|webp|gif|bmp)$/.test(file.type) || /\.(jpe?g|png|webp|gif|bmp)$/i.test(file.name));
    event.currentTarget.value = "";
    if (!added.length) return onToast("Choose JPG, PNG, WebP, GIF, or BMP photos.");
    const firstIndex = files.length;
    onUpload(added);
    let nextIndex = firstIndex;
    setPeople((current) => current.map((person) => {
      if (person.fileIndex !== null || nextIndex >= firstIndex + added.length) return person;
      return { ...person, fileIndex: nextIndex++ };
    }));
  };

  const add = async () => {
    if (people.some((person) => person.fileIndex === null || !files[person.fileIndex])) {
      onToast("Choose a photo for every person.");
      return;
    }
    const composite = await renderJointCanvas(files, previews, people, background, divider, widthCm, heightCm);
    onAdd(await canvasToBlob(composite, "image/png"));
    close();
  };

  const close = () => { window.sessionStorage.removeItem(draftStorageKey); onClose(); };
  const openEditor = (fileIndex: number) => {
    window.sessionStorage.setItem(draftStorageKey, JSON.stringify({ people, background, divider }));
    onEdit(fileIndex);
  };

  const onPreviewPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPreviewPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const relative = (event.clientX - rect.left) / rect.width;
    const index = Math.min(people.length - 1, Math.floor(relative * people.length));
    const person = people[index];
    if (person?.fileIndex !== null) updatePerson(person.id, { offsetX: Math.max(-40, Math.min(40, person.offsetX + event.movementX / rect.width * 100)), offsetY: Math.max(-40, Math.min(40, person.offsetY + event.movementY / rect.height * 100)) });
  };

  return <div className="fixed inset-0 z-[130] grid place-items-center bg-slate-950/75 p-3 sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="joint-title" className="relative flex max-h-[92dvh] w-full max-w-[865px] flex-col overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-slate-900">
      <header className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-3 dark:border-slate-800"><h2 id="joint-title" className="font-serif text-lg font-semibold">Create joint photo</h2><button type="button" aria-label="Close" onClick={close} className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button></header>
      <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto p-4 sm:grid-cols-[minmax(240px,0.9fr)_minmax(360px,1.2fr)] sm:p-5">
        <div className="flex flex-col items-center">
          <div className="relative w-full max-w-[360px] overflow-hidden rounded border border-dashed border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950" style={{ aspectRatio: `${widthCm}/${heightCm}`, background: background === "original" ? undefined : background }} onPointerDown={onPreviewPointerDown} onPointerMove={onPreviewPointerMove} onPointerUp={() => setDragging(false)} onPointerCancel={() => setDragging(false)}>
            <canvas ref={canvasRef} className="h-full w-full object-cover" />
            {[{ name: "Head", y: "20%" }, { name: "Eyes", y: "50%" }, { name: "Chin", y: "80%" }].map((guide) => <div key={guide.name} className="pointer-events-none absolute left-0 right-0 border-t border-dashed border-cyan-300/80" style={{ top: guide.y }}><span className="absolute right-0 -top-2.5 rounded bg-cyan-500 px-1 text-[9px] font-semibold text-white">{guide.name}</span></div>)}
          </div>
          <p className="mt-3 text-center text-[10px] leading-4 text-slate-500">Drag inside the frame to position each person. Line everyone up on the guides so heads look the same size.</p>
          <span className="mt-2 text-xs font-medium">{widthCm.toFixed(1)} × {heightCm.toFixed(1)} cm</span>
        </div>

        <div className="space-y-4">
          <section>
            <h3 className="mb-2 text-xs font-semibold">Frame size</h3>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => onSizeChange(4.5, 3.5)} className={`rounded-md border px-3 py-1.5 text-[11px] ${widthCm === 4.5 && heightCm === 3.5 ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-950" : "border-slate-200 dark:border-slate-700"}`}>4.5 × 3.5 cm</button>
              <label className="flex items-center gap-1 text-[10px] text-slate-500">W (cm)<input type="number" min="1" max="15" step="0.1" value={widthCm} onChange={(event) => onSizeChange(Math.max(1, Number(event.target.value)), heightCm)} className="w-16 rounded border border-slate-200 bg-white px-2 py-1 text-center text-xs dark:border-slate-700 dark:bg-slate-950" /></label>
              <label className="flex items-center gap-1 text-[10px] text-slate-500">H (cm)<input type="number" min="1" max="15" step="0.1" value={heightCm} onChange={(event) => onSizeChange(widthCm, Math.max(1, Number(event.target.value)))} className="w-16 rounded border border-slate-200 bg-white px-2 py-1 text-center text-xs dark:border-slate-700 dark:bg-slate-950" /></label>
            </div>
            <p className="mt-1.5 text-[10px] text-slate-400">All joint photos use this size. Changing it updates the photos already on the sheet.</p>
            <label className="mt-3 flex items-start gap-2 text-[11px]"><input type="checkbox" checked={turnToFit} onChange={(event) => onTurnToFit(event.target.checked)} className="mt-0.5 accent-cyan-600" /><span>Turn joint photos to fit more<small className="mt-0.5 block text-[10px] text-slate-400">A4 capacity: {turnToFit ? "30 turned" : "28 upright"} · toggle to compare 28 / 30</small></span></label>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between"><h3 className="text-xs font-semibold">People</h3><label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-slate-200 px-2 py-1.5 text-[10px] dark:border-slate-700"><Upload className="h-3.5 w-3.5" />Upload photos<input ref={fileInputRef} type="file" multiple accept={imageFormats} onChange={upload} className="hidden" /></label></div>
            <div className="space-y-2">
              {people.map((person, index) => <article key={person.id} className="rounded-lg border border-slate-200 p-2.5 dark:border-slate-700">
                <div className="mb-2 flex items-center justify-between text-[10px] font-medium"><span>Person {index + 1}</span><div className="flex gap-1"><SmallAction title="Move up" disabled={index === 0} onClick={() => movePerson(index, -1)}><ArrowUp /></SmallAction><SmallAction title="Move down" disabled={index === people.length - 1} onClick={() => movePerson(index, 1)}><ArrowDown /></SmallAction>{people.length > 1 && <SmallAction title="Remove person" onClick={() => setPeople((current) => current.filter(({ id }) => id !== person.id))}><X /></SmallAction>}</div></div>
                <select aria-label={`Photo for person ${index + 1}`} value={person.fileIndex ?? ""} onChange={(event) => updatePerson(person.id, { fileIndex: event.target.value === "" ? null : Number(event.target.value) })} className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-[11px] dark:border-slate-700 dark:bg-slate-950"><option value="">Choose a photo</option>{files.map((file, fileIndex) => <option key={`${file.name}-${fileIndex}`} value={fileIndex}>{file.name}</option>)}</select>
                <div className="mt-2 flex items-center gap-2"><label className="flex flex-1 items-center gap-2 text-[10px] text-slate-500">Zoom<input type="range" min="0.7" max="2.5" step="0.01" value={person.zoom} onChange={(event) => updatePerson(person.id, { zoom: Number(event.target.value) })} className="w-full accent-slate-700" /></label><button type="button" disabled={person.fileIndex === null} onClick={() => person.fileIndex !== null && openEditor(person.fileIndex)} className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 px-2 text-[10px] disabled:opacity-40 dark:border-slate-700"><Crop className="h-3.5 w-3.5" />Crop / remove background</button></div>
              </article>)}
            </div>
            {people.length < 3 && <button type="button" onClick={() => setPeople((current) => [...current, { id: Date.now(), fileIndex: null, zoom: 1, offsetX: 0, offsetY: 0 }])} className="mt-2 inline-flex items-center gap-1 text-[10px] font-medium text-cyan-700 dark:text-cyan-300"><Plus className="h-3.5 w-3.5" />Add person</button>}
          </section>

          <section><h3 className="mb-2 text-xs font-semibold">Background</h3><div className="flex flex-wrap items-center gap-1.5"><button type="button" onClick={() => setBackground("original")} className={`h-7 rounded-md border px-2 text-[10px] ${background === "original" ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950" : "border-slate-200 dark:border-slate-700"}`}>Original</button>{palette.map((color) => <button key={color} type="button" aria-label={`Background ${color}`} aria-pressed={background === color} onClick={() => setBackground(color)} className={`h-6 w-6 rounded-md border ${background === color ? "ring-2 ring-cyan-500" : "border-slate-200"}`} style={{ backgroundColor: color }} />)}</div><p className="mt-1 text-[10px] text-slate-400">A shared colour is applied behind each photo. Transparent cutouts look best.</p></section>
          <section><h3 className="mb-2 text-xs font-semibold">Divider</h3><div className="flex gap-1.5">{(["none", "white", "black"] as Divider[]).map((option) => <button key={option} type="button" onClick={() => setDivider(option)} className={`rounded-md border px-3 py-1.5 text-[10px] capitalize ${divider === option ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-950" : "border-slate-200 dark:border-slate-700"}`}>{option === "white" ? "White line" : option === "black" ? "Black line" : "None"}</button>)}</div></section>
        </div>
      </div>
      <footer className="flex shrink-0 justify-end gap-2 border-t border-slate-200 px-5 py-3 dark:border-slate-800"><button type="button" onClick={close} className="rounded-lg border border-slate-200 px-4 py-2 text-xs dark:border-slate-700">Cancel</button><button type="button" onClick={() => void add()} className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white dark:bg-white dark:text-slate-950">Add to sheet</button></footer>
    </section>
  </div>;
}

function SmallAction({ children, title, onClick, disabled = false }: { children: React.ReactNode; title: string; onClick: () => void; disabled?: boolean }) {
  return <button type="button" title={title} aria-label={title} disabled={disabled} onClick={onClick} className="grid h-6 w-6 place-items-center rounded hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800 [&>svg]:h-3.5 [&>svg]:w-3.5">{children}</button>;
}

async function renderJointCanvas(files: File[], previews: string[], people: Person[], background: string, divider: Divider, widthCm: number, heightCm: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(widthCm / 2.54 * 300));
  canvas.height = Math.max(1, Math.round(heightCm / 2.54 * 300));
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const fill = background === "original" ? "#f7f7f7" : background;
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const slotWidth = canvas.width / people.length;
  for (let index = 0; index < people.length; index++) {
    const person = people[index];
    const file = person.fileIndex === null ? null : files[person.fileIndex];
    if (!file) continue;
    const image = await readImage(file, previews[person.fileIndex ?? -1]);
    const scale = Math.max(slotWidth / image.naturalWidth, canvas.height / image.naturalHeight) * person.zoom;
    const drawWidth = image.naturalWidth * scale;
    const drawHeight = image.naturalHeight * scale;
    const x = index * slotWidth + (slotWidth - drawWidth) / 2 + person.offsetX / 100 * slotWidth;
    const y = (canvas.height - drawHeight) / 2 + person.offsetY / 100 * canvas.height;
    ctx.save();
    ctx.beginPath(); ctx.rect(index * slotWidth, 0, slotWidth, canvas.height); ctx.clip();
    ctx.drawImage(image, x, y, drawWidth, drawHeight);
    ctx.restore();
  }
  if (divider !== "none") {
    ctx.strokeStyle = divider === "white" ? "#fff" : "#000";
    ctx.lineWidth = Math.max(2, canvas.width * 0.006);
    for (let index = 1; index < people.length; index++) {
      ctx.beginPath(); ctx.moveTo(index * slotWidth, 0); ctx.lineTo(index * slotWidth, canvas.height); ctx.stroke();
    }
  }
  return canvas;
}

function readImage(file: Blob, previewUrl?: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const url = previewUrl ? null : URL.createObjectURL(file);
    image.onload = () => { if (url) URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { if (url) URL.revokeObjectURL(url); reject(new Error("Could not read image")); };
    image.src = previewUrl ?? url!;
  });
}
