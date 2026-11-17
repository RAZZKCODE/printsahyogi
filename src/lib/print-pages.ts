/**
 * Opens the browser's print dialog directly (no new tab, no download) for a set of
 * full-page images. Each image is printed edge-to-edge on a page of the given size.
 */
export async function printImagePages(pages: Blob[], paper: { width: number; height: number }) {
  if (!pages.length) return;
  document.getElementById("printsahyogi-print-frame")?.remove();

  const urls = pages.map((page) => URL.createObjectURL(page));
  const iframe = document.createElement("iframe");
  iframe.id = "printsahyogi-print-frame";
  iframe.setAttribute("aria-hidden", "true");
  Object.assign(iframe.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0", opacity: "0", pointerEvents: "none" });
  document.body.appendChild(iframe);

  const cleanup = () => {
    urls.forEach((url) => URL.revokeObjectURL(url));
    iframe.remove();
  };

  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) { cleanup(); throw new Error("Printing is not available in this browser."); }

  const w = `${paper.width}mm`;
  const h = `${paper.height}mm`;
  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>Print</title><style>
    @page { size: ${w} ${h}; margin: 0; }
    html, body { margin: 0; padding: 0; background: #fff; }
    .page { width: ${w}; height: ${h}; overflow: hidden; break-after: page; page-break-after: always; }
    .page:last-child { break-after: auto; page-break-after: auto; }
    img { display: block; width: 100%; height: 100%; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  </style></head><body>${urls.map((url) => `<div class="page"><img src="${url}" alt=""></div>`).join("")}</body></html>`);
  doc.close();

  await Promise.all(Array.from(doc.images).map((image) => image.complete && image.naturalWidth > 0
    ? Promise.resolve()
    : new Promise<void>((resolve) => { image.onload = () => resolve(); image.onerror = () => resolve(); })));

  let cleaned = false;
  const done = () => { if (cleaned) return; cleaned = true; window.setTimeout(cleanup, 500); };
  win.addEventListener("afterprint", done, { once: true });
  // Fallback cleanup in case afterprint never fires (some mobile browsers)
  window.setTimeout(done, 5 * 60_000);

  win.focus();
  win.print();
}
