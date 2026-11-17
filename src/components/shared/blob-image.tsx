"use client";

import { useEffect, useState, type CSSProperties } from "react";

export function BlobImage({ blob, className, style, alt }: { blob: Blob; className?: string; style?: CSSProperties; alt: string }) {
  const [url, setUrl] = useState("");
  useEffect(() => { const next = URL.createObjectURL(blob); setUrl(next); return () => URL.revokeObjectURL(next); }, [blob]);
  return url ? <img src={url} className={className} style={style} alt={alt}/> : <span className={className} style={style} aria-label={alt}/>;
}
