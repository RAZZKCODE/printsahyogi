"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ChevronDown, CircleAlert, CircleCheck, ClipboardPaste, CloudUpload, Crop, Download, FileImage,
  IdCard, Images, LayoutPanelLeft, LoaderCircle, RefreshCw, Signature, Trash2, UserRound
} from "lucide-react";
import { ACCEPTED_TYPES, MAX_UPLOAD_MB, PAN_PORTALS, PAN_SPECS, type PanKind, type PanPortal } from "@/tools/pan-resizer/config";
import { loadBlobImage, processPanImage, type PanEditState, type PanOutput } from "@/tools/pan-resizer/process";
import { PanEditorModal } from "@/components/pan-resizer/pan-editor-modal";

type Slot = { file: File; image: HTMLImageElement; previewUrl: string; state: PanEditState | null; output: PanOutput | null; busy: boolean };
const KINDS: PanKind[] = ["photo", "signature"];
const PORTAL_KEY = "printsahyogi-pan-portal";

export function PanCardResizer() {
  const [portal, setPortal] = useState<PanPortal>("NSDL");
  const [slots, setSlots] = useState<Partial<Record<PanKind, Slot>>>({});
  const [editing, setEditing] = useState<PanKind | null>(null);
  const [hovered, setHovered] = useState<PanKind | null>(null);
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);
  const slotsRef = useRef(slots);
  slotsRef.current = slots;
  const inputs = { photo: useRef<HTMLInputElement>(null), signature: useRef<HTMLInputElement>(null) };
  const specs = PAN_SPECS[portal];

  useEffect(() => {
    try { const saved = window.localStorage.getItem(PORTAL_KEY); if (saved === "NSDL" || saved === "UTIITSL") setPortal(saved); } catch { /* ignore */ }
  }, []);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(null), 3200); return () => window.clearTimeout(timer); }, [toast]);
  useEffect(() => () => { Object.values(slotsRef.current).forEach((slot) => { if (slot) { URL.revokeObjectURL(slot.previewUrl); if (slot.output) URL.revokeObjectURL(slot.output.url); } }); }, []);

  const patchSlot = (kind: PanKind, patch: Partial<Slot> | null) => setSlots((current) => {
    const existing = current[kind];
    if (patch === null) return { ...current, [kind]: undefined };
    return existing ? { ...current, [kind]: { ...existing, ...patch } } : current;
  });

  const loadFile = useCallback(async (kind: PanKind, file: File | undefined) => {
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type) && !/\.(jpe?g|png|webp)$/i.test(file.name)) { setToast({ text: "Please choose a JPG, PNG or WebP image.", ok: false }); return; }
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) { setToast({ text: `File is larger than ${MAX_UPLOAD_MB} MB.`, ok: false }); return; }
    try {
      const image = await loadBlobImage(file);
      const previewUrl = URL.createObjectURL(file);
      setSlots((current) => {
        const old = current[kind];
        if (old) { URL.revokeObjectURL(old.previewUrl); if (old.output) URL.revokeObjectURL(old.output.url); }
        return { ...current, [kind]: { file, image, previewUrl, state: null, output: null, busy: false } };
      });
      // Open the crop editor straight away after upload / replace / paste
      setEditing(kind);
    } catch {
      setToast({ text: "This image could not be opened.", ok: false });
    }
  }, []);

  // Ctrl+V paste → the hovered box, else the first empty box
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const file = Array.from(event.clipboardData?.files ?? []).find((item) => item.type.startsWith("image/"));
      if (!file || editing) return;
      event.preventDefault();
      const target = hovered ?? KINDS.find((kind) => !slotsRef.current[kind]) ?? "photo";
      void loadFile(target, file);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [editing, hovered, loadFile]);

  const runProcess = useCallback(async (kind: PanKind, state: PanEditState, targetPortal: PanPortal) => {
    const slot = slotsRef.current[kind];
    if (!slot) return;
    patchSlot(kind, { state, busy: true });
    try {
      const output = await processPanImage(slot.image, state, PAN_SPECS[targetPortal][kind]);
      setSlots((current) => {
        const existing = current[kind];
        if (!existing) { URL.revokeObjectURL(output.url); return current; }
        if (existing.output) URL.revokeObjectURL(existing.output.url);
        return { ...current, [kind]: { ...existing, state, output, busy: false } };
      });
      setToast(output.withinLimit ? { text: "Saved. Your portal-ready file is below.", ok: true } : { text: `Could not get under ${PAN_SPECS[targetPortal][kind].maxKb} KB. Try cropping tighter or a plainer background.`, ok: false });
    } catch (error) {
      console.error("PAN resize failed", error);
      patchSlot(kind, { busy: false });
      setToast({ text: "Could not process this image. Please try again.", ok: false });
    }
  }, []);

  const changePortal = (next: PanPortal) => {
    setPortal(next);
    try { window.localStorage.setItem(PORTAL_KEY, next); } catch { /* ignore */ }
    for (const kind of KINDS) {
      const slot = slotsRef.current[kind];
      if (!slot?.state) continue;
      const oldSpec = PAN_SPECS[portal][kind];
      const newSpec = PAN_SPECS[next][kind];
      const sameRatio = Math.abs(oldSpec.width / oldSpec.height - newSpec.width / newSpec.height) < 0.001;
      if (sameRatio) void runProcess(kind, slot.state, next);
      else {
        if (slot.output) URL.revokeObjectURL(slot.output.url);
        patchSlot(kind, { output: null, state: null });
      }
    }
  };

  const download = (kind: PanKind) => {
    const output = slots[kind]?.output;
    if (!output) return;
    const link = document.createElement("a");
    link.href = output.url;
    link.download = `pan-${kind}-${portal.toLowerCase()}-${output.width}x${output.height}.jpg`;
    link.click();
  };

  const editingSlot = editing ? slots[editing] : undefined;

  return <div className="min-h-full bg-slate-50 dark:bg-slate-950">
    <div className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        <h1 className="font-serif text-xl font-semibold">PAN Card Photo &amp; Signature Resizer</h1>
        <p className="mt-1 text-sm text-slate-500">Resize photo and signature for UTI and NSDL PAN card applications</p>
        <div className="mt-4 border-t border-dashed border-slate-300 dark:border-slate-700" />

        <div className="mt-5 flex flex-col items-center gap-3">
          <label className="flex items-center gap-3 font-serif text-sm">PAN Card Company
            <span className="relative">
              <select value={portal} onChange={(event) => changePortal(event.target.value as PanPortal)} className="h-9 w-44 appearance-none rounded-md border border-slate-200 bg-white pl-3 pr-8 text-sm dark:border-slate-700 dark:bg-slate-900">
                {PAN_PORTALS.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 text-slate-400" />
            </span>
          </label>
          <div className="text-center text-xs leading-5 text-slate-500">
            <p>{portal} Profile Photo: {specs.photo.width}×{specs.photo.height} px, JPEG, up to {specs.photo.maxKb} KB</p>
            <p>{portal} Signature: {specs.signature.width}×{specs.signature.height} px, JPEG, up to {specs.signature.maxKb} KB</p>
          </div>
        </div>
        <div className="mt-5 border-t border-slate-200 dark:border-slate-800" />

        <div className="mt-6 grid gap-8 md:grid-cols-2">
          {KINDS.map((kind) => {
            const slot = slots[kind];
            const spec = specs[kind];
            return <div key={kind} className="flex flex-col items-center">
              <h2 className="font-serif text-lg font-semibold">{spec.label}</h2>
              {kind === "photo" ? <UserRound className="mt-1 h-6 w-6 fill-current" /> : <Signature className="mt-1 h-6 w-6" />}
              <input ref={inputs[kind]} type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => { void loadFile(kind, event.target.files?.[0]); event.target.value = ""; }} />
              <div className="mt-4 w-full max-w-xs" onMouseEnter={() => setHovered(kind)} onMouseLeave={() => setHovered((value) => value === kind ? null : value)}>
                {!slot ? <button type="button" onClick={() => inputs[kind].current?.click()} onFocus={() => setHovered(kind)}
                  onDragOver={(event) => { event.preventDefault(); setHovered(kind); }} onDrop={(event) => { event.preventDefault(); void loadFile(kind, event.dataTransfer.files[0]); }}
                  className={`group flex aspect-[1.55] w-full flex-col items-center justify-center rounded-md border-2 border-dashed bg-slate-50 px-4 text-center shadow-md transition dark:bg-slate-900 ${hovered === kind ? "border-slate-700 dark:border-slate-300" : "border-slate-200 dark:border-slate-700"}`}>
                  <CloudUpload className="h-10 w-10" strokeWidth={1.5} />
                  <span className="mt-2 font-serif text-lg font-semibold">Upload {kind === "photo" ? "Photo" : "Signature"}</span>
                  <span className="mt-2 text-xs text-slate-500">JPG, PNG or WebP, up to {MAX_UPLOAD_MB} MB</span>
                  <span className={`mt-2 hidden items-center gap-1 text-[10px] text-slate-500 sm:flex ${hovered === kind ? "visible" : "invisible"}`}><ClipboardPaste className="h-3 w-3" />Press <kbd className="rounded border px-1">Ctrl</kbd> + <kbd className="rounded border px-1">V</kbd> to paste a file</span>
                </button>
                  : <div className="rounded-md border border-slate-200 bg-slate-50 p-3 shadow-md dark:border-slate-700 dark:bg-slate-900">
                    <div className="relative grid min-h-40 place-items-center rounded bg-white p-2 dark:bg-slate-950">
                      <img src={slot.output?.url ?? slot.previewUrl} alt={`${spec.label} preview`} className="max-h-48 max-w-full object-contain" />
                      {slot.busy && <span className="absolute inset-0 grid place-items-center bg-white/70 dark:bg-slate-950/70"><LoaderCircle className="h-6 w-6 animate-spin text-violet-600" /></span>}
                    </div>
                    <div className="mt-3 min-h-20 text-sm">
                      {slot.output ? <>
                        <p className={`font-serif font-semibold ${slot.output.withinLimit ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700"}`}>{slot.output.withinLimit ? `Ready to upload on ${portal}` : "Almost ready — file is above the limit"}</p>
                        <Check ok text={`${slot.output.width}×${slot.output.height} px`} />
                        <Check ok={slot.output.withinLimit} text={`${slot.output.sizeKb.toFixed(2)} KB (limit ${spec.maxKb} KB)`} />
                        <Check ok text="JPEG" />
                      </> : <p className="text-slate-600 dark:text-slate-300">Not resized yet. Click Resize, adjust the crop and click Save to make a portal-ready file.</p>}
                      <p className="mt-1 truncate text-[11px] text-slate-500" title={slot.file.name}>{slot.file.name}</p>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button type="button" disabled={slot.busy} onClick={() => setEditing(kind)} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-slate-900 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-900"><Crop className="h-4 w-4" />{slot.output ? "Edit" : "Resize"}</button>
                      <button type="button" disabled={!slot.output} onClick={() => download(kind)} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white text-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900"><Download className="h-4 w-4" />Download</button>
                      <button type="button" onClick={() => inputs[kind].current?.click()} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white text-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900"><RefreshCw className="h-4 w-4" />Replace</button>
                      <button type="button" onClick={() => { URL.revokeObjectURL(slot.previewUrl); if (slot.output) URL.revokeObjectURL(slot.output.url); patchSlot(kind, null); }} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white text-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900"><Trash2 className="h-4 w-4" />Remove</button>
                    </div>
                  </div>}
              </div>
            </div>;
          })}
        </div>
      </section>
    </div>

    <InfoSections />

    {editing && editingSlot && <PanEditorModal key={`${editing}-${portal}`} image={editingSlot.image} spec={specs[editing]} savedState={editingSlot.state} onClose={() => setEditing(null)} onSave={(state) => { const kind = editing; setEditing(null); void runProcess(kind, state, portal); }} />}

    {toast && <div role="status" className="fixed left-1/2 top-4 z-[100] flex -translate-x-1/2 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-900">
      {toast.ok ? <CircleCheck className="h-5 w-5 fill-emerald-500 text-white" /> : <CircleAlert className="h-5 w-5 text-rose-600" />}{toast.text}
    </div>}
  </div>;
}

function Check({ ok, text }: { ok: boolean; text: string }) {
  return <p className={`mt-1 flex items-center gap-2 text-sm ${ok ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700"}`}>{ok ? <CircleCheck className="h-4 w-4" /> : <CircleAlert className="h-4 w-4" />}{text}</p>;
}

/* ───────── Below-the-fold content (how-to, article, related tools, FAQs) ───────── */

const services = [
  { title: "Ayushman Card Print Service", text: "Get your Ayushman Bharat card printed on premium material for physical use.", href: "/app/ayushman-crop", icon: IdCard },
  { title: "E Shram Card Crop & Print", text: "Crop your E Shram (UAN) card PDF automatically and print it instantly.", href: "/app/e-shram-card-crop", icon: IdCard },
  { title: "PDF Crop & Image Extractor", text: "Crop any PDF page and extract high-quality images instantly for reuse or printing.", href: "/app/crop-pdf-to-image", icon: FileImage },
  { title: "Passport Photo Maker", text: "Create and print passport size photos in standard layouts.", href: "/app/passport-photo", icon: Images },
  { title: "Photo Collage Maker", text: "Easily create custom photo collages for events, albums, and personalized gifts.", href: "/app/collage", icon: LayoutPanelLeft }
];

const faqs = [
  { q: "What is the Pan Card Resizer Tool?", a: "It is a free online tool that resizes, crops and compresses your PAN card profile photo and signature to the exact size required by the NSDL (Protean) and UTIITSL portals." },
  { q: "What are the required dimensions for Pan card photo and signature?", a: `NSDL: photo ${PAN_SPECS.NSDL.photo.width}×${PAN_SPECS.NSDL.photo.height} px up to ${PAN_SPECS.NSDL.photo.maxKb} KB, signature ${PAN_SPECS.NSDL.signature.width}×${PAN_SPECS.NSDL.signature.height} px up to ${PAN_SPECS.NSDL.signature.maxKb} KB. UTIITSL: photo ${PAN_SPECS.UTIITSL.photo.width}×${PAN_SPECS.UTIITSL.photo.height} px, signature ${PAN_SPECS.UTIITSL.signature.width}×${PAN_SPECS.UTIITSL.signature.height} px, up to ${PAN_SPECS.UTIITSL.photo.maxKb} KB each. All files are JPEG.` },
  { q: "Will my photo or signature be uploaded to a server?", a: "No. Cropping, resizing and compression run entirely in your browser. The background-removal model is downloaded to your browser and also runs on your device." },
  { q: "Can I use the same tool for both NSDL and UTIITSL portals?", a: "Yes. Pick the portal from the PAN Card Company dropdown and the tool switches to that portal's size and file-size limits automatically." },
  { q: "What image formats are supported?", a: `You can upload JPG, PNG or WebP images up to ${MAX_UPLOAD_MB} MB. The downloaded file is always a JPEG, as required by the portals.` },
  { q: "Does it work on mobile or tablet devices?", a: "Yes. The tool works in modern mobile browsers — tap the upload box to pick a photo from your gallery or camera." }
];

function InfoSections() {
  return <div className="mx-auto max-w-6xl space-y-12 px-4 pb-16">
    <section className="grid items-center gap-8 rounded-xl bg-slate-100/70 p-6 dark:bg-slate-900/60 md:grid-cols-[1fr_1.4fr] md:p-10">
      <div>
        <h2 className="text-center font-serif text-xl font-semibold md:text-left">How to Pan Card Photo Resize?</h2>
        <ol className="mt-4 list-decimal space-y-1.5 pl-5 text-sm text-slate-700 dark:text-slate-300">
          <li>Drag and drop or upload the pan card photo</li>
          <li>Click on the Resize button to open the crop editor</li>
          <li>Adjust the crop size and position</li>
          <li>Click Save, then Download the portal-ready JPEG</li>
        </ol>
      </div>
      <div aria-hidden="true" className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-4 shadow-2xl">
        <div className="mb-3 flex gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-rose-500" /><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /></div>
        <p className="font-serif text-sm font-semibold text-white">PAN Card Photo &amp; Signature Resizer</p>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="rounded-md border border-slate-700 p-3 text-center"><UserRound className="mx-auto h-16 w-16 fill-slate-600 text-slate-600" /><p className="mt-2 text-[10px] text-emerald-400">✓ 197×276 px · 12.16 KB</p></div>
          <div className="grid place-items-center rounded-md border-2 border-dashed border-slate-600 p-3 text-center"><div><CloudUpload className="mx-auto h-8 w-8 text-white" /><p className="mt-1 font-serif text-xs text-white">Upload or Drop your Sign here</p></div></div>
        </div>
      </div>
    </section>

    <section className="rounded-xl bg-slate-100/70 p-6 text-sm text-slate-600 dark:bg-slate-900/60 dark:text-slate-300 md:p-8">
      <h2 className="font-serif text-xl font-semibold text-slate-900 dark:text-white">Pan Card Photo Resize</h2>
      <p className="mt-3">Applying for a Pan card online through NSDL or UTIITSL requires profile photo and signature images in specific dimensions and file sizes. PrintSathi makes it easy to resize, crop, and edit them accurately without losing quality.</p>
      <h3 className="mt-6 font-serif text-base font-semibold text-slate-900 dark:text-white">Why use the Pan Card Photo Resize Tool?</h3>
      <ul className="mt-2 space-y-1"><li>✓ Resize profile photo and signature to NSDL/UTIITSL dimensions easily.</li><li>✓ Maintain perfect clarity and proportion for official uploads.</li><li>✓ Resizing runs in your browser. Your photo never leaves your device.</li></ul>
      <h3 className="mt-6 font-serif text-base font-semibold text-slate-900 dark:text-white">How to use the Pan Card Photo Resize Tool</h3>
      <ol className="mt-2 list-decimal space-y-1 pl-5"><li>Choose the portal: NSDL (Protean) or UTIITSL.</li><li>Upload your photo and your signature in their own boxes.</li><li>Click Resize, adjust the crop, and click Save. The tool sets the exact size and keeps the file under the limit.</li><li>Check the green ticks and click Download to get a ready-to-upload JPEG.</li></ol>
      <h3 className="mt-6 font-serif text-base font-semibold text-slate-900 dark:text-white">Use cases for Pan Card Photo Resize Tool</h3>
      <ul className="mt-2 list-disc space-y-1 pl-5"><li>Preparing profile photos and signatures for PAN card application forms.</li><li>Resizing and cropping images to meet NSDL or UTIITSL requirements.</li><li>Quick editing for CSC operators, agents, or individuals applying online.</li></ul>
    </section>

    <section className="rounded-xl bg-slate-100/70 p-6 dark:bg-slate-900/60 md:p-8">
      <h2 className="text-center font-serif text-2xl font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200">Explore other services</h2>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {services.map((service) => <Link key={service.href} href={service.href} className="rounded-lg bg-white p-5 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:bg-slate-900">
          <service.icon className="mx-auto h-9 w-9 text-sky-500" strokeWidth={1.5} />
          <h3 className="mt-3 font-serif text-sm font-semibold">{service.title}</h3>
          <p className="mt-2 text-xs text-slate-500">{service.text}</p>
        </Link>)}
      </div>
    </section>

    <section className="mx-auto max-w-xl">
      <h2 className="text-center font-serif text-3xl font-semibold">FAQs</h2>
      <div className="mt-6 divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-800 dark:border-slate-800">
        {faqs.map((faq) => <details key={faq.q} className="group py-3">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium [&::-webkit-details-marker]:hidden">{faq.q}<ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition group-open:rotate-180" /></summary>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{faq.a}</p>
        </details>)}
      </div>
    </section>
  </div>;
}
