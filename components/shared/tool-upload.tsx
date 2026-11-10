"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import JSZip from "jszip";
import { AlertTriangle, ChevronDown, CloudUpload, Edit3, FileArchive, FolderOpen, ShieldCheck, X } from "lucide-react";
import { useUploadStore } from "@/tools/upload/store";

export type ToolUploadProps = {
  title: string;
  subtitle: string;
  acceptedFormats: string[];
  multiple: boolean;
  toolId: string;
  uploadHeading: string;
};

type ToastMessage = { id: number; text: string };

const imageMimeByExtension: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
  gif: "image/gif", bmp: "image/bmp"
};

export function ToolUpload({ title, subtitle, acceptedFormats, multiple, toolId, uploadHeading }: ToolUploadProps) {
  const router = useRouter();
  const setFiles = useUploadStore((state) => state.setFiles);
  const session = useUploadStore((state) => state.sessions[toolId]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dragging, setDragging] = useState(false);
  const [folderMenuOpen, setFolderMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const extensionList = useMemo(() => acceptedFormats.map((format) => format.replace(/^\./, "").toLowerCase()), [acceptedFormats]);
  const acceptAttribute = useMemo(() => acceptedFormats.map((format) => format.startsWith(".") ? format : `.${format.toLowerCase()}`).join(","), [acceptedFormats]);
  const supportedFormatsText = acceptedFormats.map((format) => format.replace(/^\./, "")).join(", ");

  const showToast = useCallback((text: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ id: Date.now(), text });
    toastTimeoutRef.current = setTimeout(() => setToast(null), 4200);
  }, []);

  useEffect(() => {
    folderInputRef.current?.setAttribute("webkitdirectory", "");
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  const getExtension = (name: string) => name.split(".").pop()?.toLowerCase() ?? "";
  const isSupported = useCallback((file: File) => {
    const extension = getExtension(file.name);
    if (extensionList.includes(extension)) return true;
    const mimeExtension = Object.entries(imageMimeByExtension).find(([, mime]) => mime === file.type.toLowerCase())?.[0];
    return Boolean(mimeExtension && extensionList.includes(mimeExtension));
  }, [extensionList]);

  const finishSelection = useCallback((inputFiles: File[]) => {
    const accepted = inputFiles.filter(isSupported);
    const rejectedCount = inputFiles.length - accepted.length;
    if (rejectedCount > 0) showToast(`${rejectedCount} unsupported file${rejectedCount === 1 ? "" : "s"}. Supported formats: ${supportedFormatsText}.`);
    if (accepted.length === 0) return;

    const selected = multiple ? accepted : accepted.slice(0, 1);
    setFiles(toolId, selected);
    const destination = `/app/${toolId}/editor`;
    if (rejectedCount > 0) window.setTimeout(() => router.push(destination), 900);
    else router.push(destination);
  }, [isSupported, multiple, router, setFiles, showToast, supportedFormatsText, toolId]);

  const onInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    finishSelection(files);
  };

  const extractImagesFromZip = useCallback(async (zipFile: File) => {
    setBusy(true);
    try {
      const archive = await JSZip.loadAsync(zipFile);
      const entries = Object.values(archive.files).filter((entry) => !entry.dir);
      const supportedEntries = entries.filter((entry) => isSupported({ name: entry.name, type: "" } as File));
      const rejectedImages = entries.filter((entry) => {
        const extension = getExtension(entry.name);
        return ["jpg", "jpeg", "png", "webp", "gif", "bmp"].includes(extension) && !extensionList.includes(extension);
      }).length;
      const extracted = await Promise.all(supportedEntries.map(async (entry) => {
        const blob = await entry.async("blob");
        const extension = getExtension(entry.name);
        const name = entry.name.split("/").pop() || `image.${extension}`;
        return new File([blob], name, { type: imageMimeByExtension[extension] ?? blob.type, lastModified: Date.now() });
      }));
      if (rejectedImages > 0) showToast(`${rejectedImages} unsupported image${rejectedImages === 1 ? "" : "s"} in ZIP. Supported formats: ${supportedFormatsText}.`);
      if (extracted.length === 0) {
        showToast("No supported images were found in that ZIP archive.");
        return;
      }
      finishSelection(extracted);
    } catch {
      showToast("Could not open that ZIP archive. Please choose a valid ZIP file.");
    } finally {
      setBusy(false);
    }
  }, [extensionList, finishSelection, isSupported, showToast, supportedFormatsText]);

  const handleFolderFiles = (files: File[]) => {
    const zipFiles = files.filter((file) => file.name.toLowerCase().endsWith(".zip"));
    const imageFiles = files.filter((file) => !file.name.toLowerCase().endsWith(".zip"));
    if (zipFiles.length > 0) {
      void extractImagesFromZip(zipFiles[0]);
      return;
    }
    finishSelection(imageFiles);
  };

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const clipboard = event.clipboardData;
      const itemFiles = Array.from(clipboard?.items ?? [])
        .filter((item) => item.kind === "file")
        .map((item) => item.getAsFile())
        .filter((file): file is File => file !== null);
      const clipboardFiles = Array.from(clipboard?.files ?? []);
      if (clipboardFiles.length === 0) clipboardFiles.push(...itemFiles);
      if (clipboardFiles.length === 0) return;
      event.preventDefault();
      finishSelection(clipboardFiles);
    };
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [finishSelection]);

  const onDrop = (event: React.DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setDragging(false);
    finishSelection(Array.from(event.dataTransfer.files));
  };

  return (
    <section className="mx-auto flex min-h-full w-full max-w-4xl flex-col items-center justify-center px-4 py-12 text-center sm:px-7">
      <div className="mb-8">
        <h1 className="font-serif text-2xl font-semibold tracking-tight text-slate-800 dark:text-slate-100 sm:text-3xl">{title}</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
      </div>

      <input ref={fileInputRef} type="file" accept={acceptAttribute} multiple={multiple} className="sr-only" onChange={onInputChange} aria-label={uploadHeading} />
      <input ref={folderInputRef} type="file" accept={acceptAttribute} multiple className="sr-only" onChange={(event) => { const files = Array.from(event.currentTarget.files ?? []); event.currentTarget.value = ""; handleFolderFiles(files); }} aria-label="Choose a folder" />
      <input ref={zipInputRef} type="file" accept=".zip,application/zip" className="sr-only" onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) void extractImagesFromZip(file); }} aria-label="Choose a ZIP archive" />

      <button type="button" onClick={() => fileInputRef.current?.click()} onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { if (event.currentTarget === event.target) setDragging(false); }} onDrop={onDrop}
        className={`flex min-h-[270px] w-full max-w-[580px] flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 shadow-[0_18px_35px_-28px_rgba(15,23,42,0.45)] transition-colors ${dragging ? "border-cyan-500 bg-cyan-50 dark:bg-cyan-950/30" : "border-slate-200 bg-slate-50/80 hover:border-sky-300 hover:bg-sky-50/60 dark:border-slate-700 dark:bg-slate-900/70 dark:hover:border-sky-800"}`}>
        {busy ? <div className="flex flex-col items-center"><span className="h-11 w-11 animate-spin rounded-full border-4 border-cyan-100 border-t-cyan-600" /><span className="mt-5 text-sm font-medium text-slate-600 dark:text-slate-300">Extracting images…</span></div> : <>
          <CloudUpload className="h-14 w-14 text-slate-950 dark:text-slate-100" strokeWidth={1.8} />
          <span className="mt-5 font-serif text-xl font-semibold text-slate-950 dark:text-white sm:text-2xl">{uploadHeading}</span>
          <span className="mt-4 text-xs text-slate-500 dark:text-slate-400">Supported formats: {supportedFormatsText}</span>
          <span className="mt-4 inline-flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400"><span aria-hidden="true">▣</span> Press <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] dark:border-slate-700 dark:bg-slate-800">Ctrl</kbd> + <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] dark:border-slate-700 dark:bg-slate-800">V</kbd> to paste a file</span>
        </>}
      </button>

      <div className="relative mt-6">
        <button type="button" disabled={busy} onClick={() => setFolderMenuOpen((open) => !open)} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800">
          <FolderOpen className="h-4 w-4" />Upload Folder or ZIP<ChevronDown className="h-3.5 w-3.5" />
        </button>
        {folderMenuOpen && <div className="absolute left-1/2 top-full z-20 mt-2 w-52 -translate-x-1/2 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 text-left shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <button type="button" onClick={() => { setFolderMenuOpen(false); folderInputRef.current?.click(); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-xs text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"><FolderOpen className="h-4 w-4" />Choose a folder</button>
          <button type="button" onClick={() => { setFolderMenuOpen(false); zipInputRef.current?.click(); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-xs text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"><FileArchive className="h-4 w-4" />Choose a ZIP archive</button>
        </div>}
      </div>

      {session?.files.length ? <button type="button" onClick={() => router.push(`/app/${toolId}/editor`)} className="mt-3 inline-flex h-9 items-center gap-2 rounded-full border border-cyan-200 bg-white px-4 text-xs font-semibold text-cyan-800 shadow-sm hover:bg-cyan-50 dark:border-cyan-900 dark:bg-slate-900 dark:text-cyan-200 dark:hover:bg-slate-800"><Edit3 className="h-3.5 w-3.5" />Edit selected {session.files.length === 1 ? "photo" : `${session.files.length} photos`}{session.operations.length ? " · changes saved" : ""}</button> : null}

      <p className="mt-8 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-[11px] font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300 sm:text-xs">
        <ShieldCheck className="h-4 w-4 shrink-0" />100% Client-Side Processing <span aria-hidden="true">•</span> Your files never leave your device
      </p>

      {toast && <div key={toast.id} role="alert" aria-live="assertive" className="fixed bottom-6 left-1/2 z-[70] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-3 text-left text-xs font-medium text-slate-800 shadow-xl dark:border-rose-900 dark:bg-slate-900 dark:text-slate-100">
        <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" /><span>{toast.text}</span><button type="button" onClick={() => setToast(null)} aria-label="Dismiss notification" className="ml-1 rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-3.5 w-3.5" /></button>
      </div>}
    </section>
  );
}
