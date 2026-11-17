import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

const hook = registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(specifier === "@/tools/sheet/layout" ? new URL("../sheet/layout.ts", import.meta.url).href : specifier, context);
} });
const { arrangeCardSheets, CARD_PAPER_SIZES } = await import("./layout.ts");
hook.deregister();

const settings = { paper: "A4", heightMm: 83.3, gapX: 8, gapY: 10, margin: 8, sides: "Both Sides", inlineSides: true, cropMode: "card" };
const cards = [
  { id: "a-front", documentId: "a", sourceName: "sample.pdf", pageNumber: 1, side: "front", pairIndex: 0 },
  { id: "a-back", documentId: "a", sourceName: "sample.pdf", pageNumber: 1, side: "back", pairIndex: 0 },
  { id: "b-front", documentId: "b", sourceName: "sample.pdf", pageNumber: 1, side: "front", pairIndex: 1 },
  { id: "b-back", documentId: "b", sourceName: "sample.pdf", pageNumber: 1, side: "back", pairIndex: 1 }
];
const ratio = 85.6 / 54;

test("Aadhaar sizes stay within A4, 4x6 and PVC paper", () => {
  for (const paper of ["A4", "4x6", "4x6-glossy", "PVC"]) {
    const margin = paper === "PVC" ? 0 : 5.5;
    const pages = arrangeCardSheets(cards, { ...settings, paper, margin }, ratio, paper === "4x6-glossy");
    assert.equal(pages.flatMap((page) => page.placements).length, 4);
    for (const page of pages) for (const item of page.placements) {
      assert.ok(item.x >= margin && item.y >= margin);
      assert.ok(item.x + item.width <= CARD_PAPER_SIZES[paper].width - margin + 1e-9);
      assert.ok(item.y + item.height <= CARD_PAPER_SIZES[paper].height - margin + 1e-9);
    }
  }
});

test("Full Aadhaar prints each source page once, including same-named documents", () => {
  const pages = arrangeCardSheets(cards, { ...settings, cropMode: "full", heightMm: 260 }, 210 / 297);
  assert.equal(pages.length, 2);
  assert.deepEqual(pages.flatMap((page) => page.placements.map((item) => item.card.documentId)), ["a", "b"]);
});

test("glossy uses separate upright front and back pages for each pair", () => {
  const pages = arrangeCardSheets(cards, { ...settings, paper: "4x6-glossy", margin: 3 }, ratio, true);
  assert.equal(pages.length, 4);
  assert.deepEqual(pages.map((page) => page.side), ["front", "back", "front", "back"]);
  for (let index = 0; index < 4; index += 2) {
    const front = pages[index].placements[0], back = pages[index + 1].placements[0];
    assert.equal(front.card.pairIndex, back.card.pairIndex);
    assert.equal(front.x, back.x);
    assert.equal(front.y, back.y);
    assert.equal(front.rotation, 0);
    assert.equal(back.rotation, 0);
  }
});

test("removing a side keeps remaining duplex pairs in their original slots", () => {
  const pages = arrangeCardSheets(cards.slice(1), { ...settings, inlineSides: false, heightMm: 54 }, ratio, true);
  const front = pages[0].placements[0], back = pages[1].placements[1];
  assert.equal(front.card.pairIndex, back.card.pairIndex);
  assert.equal(front.slot, back.slot);
  assert.ok(Math.abs(front.x + front.width + back.x - 210) < 1e-9);
});

test("side filters and oversized settings do not produce extra or clipped cards", () => {
  const front = arrangeCardSheets(cards, { ...settings, sides: "Front" }, ratio);
  assert.equal(front.flatMap((page) => page.placements).length, 2);
  assert.ok(front.every((page) => page.placements.every((item) => item.card.side === "front")));
  assert.deepEqual(arrangeCardSheets(cards, { ...settings, heightMm: 500 }, ratio), []);
});


test("A4 places upright front/back side by side and later pairs on the next row", () => {
  const pages = arrangeCardSheets(cards, settings, ratio);
  assert.equal(pages.length, 1);
  const [front, back, nextFront] = pages[0].placements;
  assert.equal(front.width, 83.3);
  assert.ok(Math.abs(front.height - 83.3 / ratio) < 1e-9);
  assert.equal(front.y, back.y);
  assert.ok(back.x > front.x + front.width);
  assert.ok(nextFront.y > front.y + front.height);
  assert.ok(pages[0].placements.every((item) => item.rotation === 0));
});

test("4x6 puts the reversed back beneath the front on portrait paper", () => {
  const pages = arrangeCardSheets(cards.slice(0, 2), { ...settings, paper: "4x6" }, ratio);
  assert.equal(pages.length, 1);
  const [front, back] = pages[0].placements;
  assert.equal(front.x, back.x);
  assert.equal(front.rotation, 0);
  assert.equal(back.rotation, 180);
  assert.ok(back.y > front.y + front.height);
  assert.deepEqual(CARD_PAPER_SIZES["4x6"], { width: 101.6, height: 152.4 });
});

test("PVC gives each side its own landscape card at fixed physical size", () => {
  const pages = arrangeCardSheets(cards.slice(0, 2), { ...settings, paper: "PVC", heightMm: 500 }, ratio);
  assert.equal(pages.length, 2);
  for (const page of pages) {
    assert.equal(page.placements.length, 1);
    assert.deepEqual([page.placements[0].x, page.placements[0].y, page.placements[0].width, page.placements[0].height], [0, 0, 85.6, 54]);
  }
});

test("height and gap controls change the printed size and spacing", () => {
  const pages = arrangeCardSheets(cards, { ...settings, heightMm: 80, gapX: 12, gapY: 16 }, ratio);
  const [front, back, next] = pages[0].placements;
  assert.equal(front.width, 80);
  assert.ok(Math.abs(back.x - front.x - front.width - 12 * 25.4 / 96) < 1e-9);
  assert.ok(Math.abs(next.y - front.y - front.height - 16 * 25.4 / 96) < 1e-9);
});
