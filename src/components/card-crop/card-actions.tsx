"use client";

import { useEffect, useRef } from "react";
import { Check, Crop, Download, FlipHorizontal2, FlipVertical2, MoreHorizontal, SquarePen, X } from "lucide-react";
import type { CardAppearance, CardCropSettings, ProcessedCard } from "@/tools/card-crop/types";

type AppearanceProps = {
  card: ProcessedCard;
  settings: CardCropSettings;
  busy: boolean;
  onChange: (patch: Partial<CardAppearance>) => void;
  menu?: boolean;
};

export function CardAppearanceControls({ card, settings, busy, onChange, menu = false }: AppearanceProps) {
  const appearance = card.appearance ?? {};
  const background = appearance.background ?? settings.background ?? "normal";
  const item = "flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs text-slate-800 hover:bg-slate-100 disabled:opacity-40 dark:text-slate-200 dark:hover:bg-slate-800";
  return <>
    <button type="button" role={menu ? "menuitemcheckbox" : undefined} aria-checked={menu ? Boolean(appearance.flipHorizontal) : undefined} aria-pressed={menu ? undefined : Boolean(appearance.flipHorizontal)} disabled={busy} onClick={() => onChange({ flipHorizontal: !appearance.flipHorizontal })} className={item}><span className="flex items-center gap-2"><FlipHorizontal2 size={14}/>Flip Horizontal</span>{appearance.flipHorizontal && <Check size={13}/>}</button>
    <button type="button" role={menu ? "menuitemcheckbox" : undefined} aria-checked={menu ? Boolean(appearance.flipVertical) : undefined} aria-pressed={menu ? undefined : Boolean(appearance.flipVertical)} disabled={busy} onClick={() => onChange({ flipVertical: !appearance.flipVertical })} className={item}><span className="flex items-center gap-2"><FlipVertical2 size={14}/>Flip Vertical</span>{appearance.flipVertical && <Check size={13}/>}</button>
    <p className="border-t border-slate-100 px-3 pb-1 pt-2 text-xs font-semibold dark:border-slate-800">Card Background</p>
    {(["colored", "normal"] as const).map((value) => <button key={value} type="button" role={menu ? "menuitemradio" : undefined} aria-checked={menu ? background === value : undefined} aria-pressed={menu ? undefined : background === value} disabled={busy} onClick={() => onChange({ background: value })} className={item}>{value === "colored" ? "Colored" : "Normal"} Background{background === value && <Check size={13}/>}</button>)}
  </>;
}

type Props = AppearanceProps & {
  active: boolean;
  open: boolean;
  canCrop: boolean;
  onOpenChange: (open: boolean) => void;
  onRemove: () => void;
  onCrop: () => void;
  onDownload: () => void;
  onEdit: () => void;
};

export function CardActions({ card, settings, busy, active, open, canCrop, onOpenChange, onRemove, onCrop, onDownload, onEdit, onChange }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (open) rootRef.current?.querySelector<HTMLButtonElement>("[role='menuitemcheckbox']")?.focus(); }, [open]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) onOpenChange(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { onOpenChange(false); rootRef.current?.querySelector<HTMLButtonElement>("[aria-haspopup='menu']")?.focus(); } };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open, onOpenChange]);
  const actions = [
    { label: "Remove card", icon: X, action: onRemove, disabled: false },
    { label: "Crop card", icon: Crop, action: onCrop, disabled: !canCrop },
    { label: "Download card PNG", icon: Download, action: onDownload, disabled: false },
    { label: "Edit card", icon: SquarePen, action: onEdit, disabled: false }
  ];
  return <div ref={rootRef} data-card-actions className={`absolute -top-3 left-1/2 z-20 -translate-x-1/2 ${active || open ? "opacity-100" : "pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"}`} onClick={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()} onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); }}>
    <div role="toolbar" aria-label={`${card.side} card actions`} className="flex items-center gap-2">
      {actions.map(({ label, icon: Icon, action, disabled }) => <button key={label} type="button" aria-label={label} title={label} disabled={busy || disabled} onClick={() => { onOpenChange(false); action(); }} className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-neutral-900 text-white shadow-sm hover:bg-neutral-700 disabled:opacity-40"><Icon size={15}/></button>)}
      <button type="button" aria-label="More card actions" title="More card actions" aria-haspopup="menu" aria-expanded={open} onClick={() => onOpenChange(!open)} className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-neutral-900 text-white shadow-sm hover:bg-neutral-700"><MoreHorizontal size={17}/></button>
    </div>
    {open && <div role="menu" aria-label="Card actions" onKeyDown={(event) => {
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
      const current = items.indexOf(document.activeElement as HTMLButtonElement);
      const index = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      items[index]?.focus();
    }} className="absolute right-0 top-full mt-1 w-48 overflow-hidden rounded-md border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-950"><CardAppearanceControls card={card} settings={settings} busy={busy} menu onChange={(patch) => { onOpenChange(false); onChange(patch); }}/></div>}
  </div>;
}
