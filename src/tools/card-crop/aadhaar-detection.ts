import type { NormalizedCrop } from "@/tools/card-crop/types";

// e-Aadhaar letters have two small cards below a horizontal perforation.
// Detect the page frame and that perforation instead of treating letter text as cards.
export function detectAadhaarCardStrip(data: Uint8ClampedArray, width: number, height: number, aspectRatio: number) {
  const ink = new Uint8Array(width * height);
  const columns = new Uint32Array(width);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const offset = (y * width + x) * 4;
    const maximum = Math.max(data[offset], data[offset + 1], data[offset + 2]);
    const minimum = Math.min(data[offset], data[offset + 1], data[offset + 2]);
    if (maximum < 170 && maximum - minimum < 60) {
      ink[y * width + x] = 1;
      columns[x]++;
    }
  }
  const lines: Array<{ start: number; end: number }> = [];
  for (let x = 0; x < width; x++) {
    if (columns[x] < height * .4) continue;
    const previous = lines[lines.length - 1];
    if (previous && x <= previous.end + 2) previous.end = x;
    else lines.push({ start: x, end: x });
  }
  if (lines.length < 3) return null;
  const left = lines[0].start, right = lines[lines.length - 1].end + 1;
  const span = right - left;
  if (span < width * .65) return null;
  const middle = (left + right) / 2;
  const centers = lines.filter((line) => Math.abs((line.start + line.end) / 2 - middle) < span * .04);
  if (!centers.length) return null;
  let bottom = -1;
  for (let y = Math.floor(height * .55); y < height; y++) {
    let count = 0;
    for (let x = left; x < right; x++) count += ink[y * width + x];
    if (count > span * .8) bottom = y + 1;
  }
  if (bottom < 0) return null;
  const expectedHeight = span / 2 / aspectRatio;
  let cut = -1, bestScore = 0;
  const startY = Math.max(Math.floor(height * .45), Math.floor(bottom - expectedHeight * 1.25));
  const endY = Math.min(Math.floor(height * .9), Math.ceil(bottom - expectedHeight * .75));
  for (let y = startY; y < endY; y++) {
    const halves = [[left, Math.floor(middle)], [Math.ceil(middle), right]];
    let score = 0;
    for (const [start, end] of halves) {
      let shortRuns = 0, coverage = 0, run = 0;
      for (let x = start; x <= end; x++) {
        if (x < end && ink[y * width + x]) { run++; continue; }
        if (run >= 2 && run <= span * .018) { shortRuns++; coverage += run; }
        run = 0;
      }
      if (shortRuns < 12 || coverage < (end - start) * .2) { score = 0; break; }
      score += coverage;
    }
    if (score > bestScore) { bestScore = score; cut = y; }
  }
  if (cut < 0) return null;
  const frontEnd = centers[0].end + 1;
  const backStart = centers[centers.length - 1].start;
  const crop = (x: number, end: number): NormalizedCrop => ({ x: x / width, y: cut / height, width: (end - x) / width, height: (bottom - cut) / height });
  return { front: crop(left, frontEnd), back: crop(backStart, right), strip: crop(left, right), confidence: .98 };
}
