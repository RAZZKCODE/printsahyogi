import test from "node:test";
import assert from "node:assert/strict";
import { detectAadhaarCardStrip } from "./aadhaar-detection.ts";

function letter({ width = 1000, height = 1300, perforation = true, halfOnly = false } = {}) {
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  const left = Math.round(width * .08), right = Math.round(width * .92), center = Math.round(width / 2);
  const top = Math.round(height * .14), bottom = Math.round(height * .93);
  const cut = bottom - Math.round((right - left) / 2 / (85.6 / 54));
  const black = (x, y) => { const i = (y * width + x) * 4; data[i] = data[i + 1] = data[i + 2] = 0; };
  for (let y = top; y <= bottom; y++) for (const x of [left, center - 6, center + 6, right]) black(x, y);
  for (let x = left; x <= right; x++) { black(x, top); black(x, bottom); }
  if (perforation) for (let x = left; x <= (halfOnly ? center : right); x++) if (x % 9 < 4) black(x, cut);
  return { data, width, height, cut, bottom, left, right };
}

test("full Aadhaar letter yields only the two cards below the perforation", () => {
  const input = letter();
  const result = detectAadhaarCardStrip(input.data, input.width, input.height, 85.6 / 54);
  assert.ok(result);
  assert.equal(result.front.y, input.cut / input.height);
  assert.equal(result.back.y, result.front.y);
  assert.ok(result.front.x + result.front.width < result.back.x);
  assert.equal(result.strip.x, input.left / input.width);
  assert.equal(result.strip.width, (input.right + 1 - input.left) / input.width);
  assert.equal(result.strip.height, (input.bottom + 1 - input.cut) / input.height);
});

test("detection adapts to page resolution instead of fixed crop coordinates", () => {
  const input = letter({ width: 800, height: 1100 });
  const result = detectAadhaarCardStrip(input.data, input.width, input.height, 85.6 / 54);
  assert.ok(result);
  assert.equal(result.strip.y, input.cut / input.height);
});

test("a letter frame or a one-sided text/QR pattern is not a card perforation", () => {
  for (const options of [{ perforation: false }, { halfOnly: true }]) {
    const input = letter(options);
    assert.equal(detectAadhaarCardStrip(input.data, input.width, input.height, 85.6 / 54), null);
  }
});

test("blank pages do not invent an Aadhaar crop", () => {
  assert.equal(detectAadhaarCardStrip(new Uint8ClampedArray(100 * 140 * 4).fill(255), 100, 140, 85.6 / 54), null);
});
