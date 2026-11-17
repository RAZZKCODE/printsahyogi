export function downloadBlob(blob: Blob, filename: string, revokeAfterMs = 60_000) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), revokeAfterMs);
  return url;
}
