"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CropRect, PhotoEditSnapshot } from "@/tools/editor/types";

type StageProps = {
  image: HTMLImageElement;
  snapshot: PhotoEditSnapshot;
  showGrid: boolean;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onCropPreview: (crop: CropRect) => void;
  onCropCommit: (crop: CropRect) => void;
};

type Size = { width: number; height: number };
type DragState = { pointerX: number; pointerY: number; start: CropRect; handle: string; current: CropRect };

const EMPTY_SIZE: Size = { width: 0, height: 0 };

export function getOrientedSize(width: number, height: number, quarterTurns: number): Size {
  return Math.abs(quarterTurns % 2) === 1 ? { width: height, height: width } : { width, height };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function resizeCrop(start: CropRect, dx: number, dy: number, handle: string, bounds: Size, ratio: number | null): CropRect {
  if (handle === "move") {
    return {
      ...start,
      x: clamp(start.x + dx, 0, Math.max(0, bounds.width - start.width)),
      y: clamp(start.y + dy, 0, Math.max(0, bounds.height - start.height))
    };
  }

  const dirX = handle.includes("e") ? 1 : handle.includes("w") ? -1 : 0;
  const dirY = handle.includes("s") ? 1 : handle.includes("n") ? -1 : 0;
  const minimum = Math.min(24, bounds.width, bounds.height);
  let width = start.width;
  let height = start.height;

  if (ratio) {
    const byWidth = start.width + dirX * dx;
    const byHeight = (start.height + dirY * dy) * ratio;
    if (dirX && dirY) width = Math.abs(dx) >= Math.abs(dy * ratio) ? byWidth : byHeight;
    else if (dirX) width = byWidth;
    else width = byHeight;
    const maxWidth = Math.min(bounds.width, bounds.height * ratio);
    width = clamp(width, Math.min(minimum, maxWidth), maxWidth);
    height = width / ratio;
  } else {
    if (dirX) width = clamp(start.width + dirX * dx, minimum, bounds.width);
    if (dirY) height = clamp(start.height + dirY * dy, minimum, bounds.height);
  }

  const x = dirX === 1 ? start.x : dirX === -1 ? start.x + start.width - width : start.x + (start.width - width) / 2;
  const y = dirY === 1 ? start.y : dirY === -1 ? start.y + start.height - height : start.y + (start.height - height) / 2;
  const safeX = clamp(x, 0, Math.max(0, bounds.width - width));
  const safeY = clamp(y, 0, Math.max(0, bounds.height - height));
  return { x: safeX, y: safeY, width: Math.min(width, bounds.width - safeX), height: Math.min(height, bounds.height - safeY) };
}

export function CropStage({ image, snapshot, showGrid, zoom, onZoomChange, onCropPreview, onCropCommit }: StageProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [viewport, setViewport] = useState<Size>(EMPTY_SIZE);
  const size = useMemo(() => getOrientedSize(image.naturalWidth, image.naturalHeight, snapshot.rotation), [image, snapshot.rotation]);
  const scale = viewport.width && viewport.height
    ? Math.min(viewport.width / size.width, viewport.height / size.height) * zoom
    : 0;
  const displayWidth = size.width * scale;
  const displayHeight = size.height * scale;
  const left = (viewport.width - displayWidth) / 2;
  const top = (viewport.height - displayHeight) / 2;
  const cropStyle = {
    left: left + snapshot.crop.x * scale,
    top: top + snapshot.crop.y * scale,
    width: snapshot.crop.width * scale,
    height: snapshot.crop.height * scale
  };

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setViewport({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !viewport.width || !viewport.height || !scale) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(viewport.width * dpr);
    canvas.height = Math.round(viewport.height * dpr);
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, viewport.width, viewport.height);
    context.fillStyle = "#090b10";
    context.fillRect(0, 0, viewport.width, viewport.height);
    context.save();
    context.translate(viewport.width / 2, viewport.height / 2);
    context.rotate((snapshot.rotation * 90 + snapshot.straighten) * Math.PI / 180);
    context.scale((snapshot.flipHorizontal ? -1 : 1) * scale, (snapshot.flipVertical ? -1 : 1) * scale);
    context.imageSmoothingQuality = "high";
    context.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
    context.restore();
  }, [image, scale, snapshot.flipHorizontal, snapshot.flipVertical, snapshot.rotation, snapshot.straighten, viewport.height, viewport.width]);

  const pointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const handle = target.closest<HTMLElement>("[data-crop-handle]")?.dataset.cropHandle ?? "move";
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerX: event.clientX, pointerY: event.clientY, start: snapshot.crop, handle, current: snapshot.crop };
  };

  const pointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || !scale) return;
    const dx = (event.clientX - drag.pointerX) / scale;
    const dy = (event.clientY - drag.pointerY) / scale;
    const next = resizeCrop(drag.start, dx, dy, drag.handle, size, snapshot.aspectRatio);
    drag.current = next;
    onCropPreview(next);
  };

  const pointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
    onCropCommit(drag.current);
  };

  const handlePositions = [
    ["nw", "left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize"],
    ["n", "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize"],
    ["ne", "right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize"],
    ["e", "right-0 top-1/2 translate-x-1/2 -translate-y-1/2 cursor-ew-resize"],
    ["se", "right-0 bottom-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize"],
    ["s", "left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-ns-resize"],
    ["sw", "left-0 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize"],
    ["w", "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize"]
  ];

  return <div ref={viewportRef} className="relative min-h-0 flex-1 overflow-hidden bg-[#090b10]" onWheel={(event) => { event.preventDefault(); onZoomChange(clamp(zoom + (event.deltaY < 0 ? 0.1 : -0.1), 0.25, 3)); }}>
    <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    {scale > 0 && <div onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} style={cropStyle} className="absolute touch-none cursor-move border border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.52)]">
      {showGrid && <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute bottom-0 left-1/3 top-0 border-l border-white/55" /><div className="absolute bottom-0 left-2/3 top-0 border-l border-white/55" />
        <div className="absolute left-0 right-0 top-1/3 border-t border-white/55" /><div className="absolute left-0 right-0 top-2/3 border-t border-white/55" />
      </div>}
      {handlePositions.map(([handle, position]) => <span key={handle} data-crop-handle={handle} className={`absolute z-10 h-2.5 w-2.5 rounded-[2px] border border-slate-500 bg-white shadow-sm ${position}`} />)}
    </div>}
  </div>;
}
