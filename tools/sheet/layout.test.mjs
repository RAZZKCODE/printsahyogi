import test from "node:test";
import assert from "node:assert/strict";
import { capacityForLayout, fitPhotoWidthForColumns, layoutJointRows, layoutPlacements, mmToPx } from "./layout.ts";

test("mm converts to CSS pixels at 96 dpi", () => {
  assert.ok(Math.abs(mmToPx(25.4) - 96) < 1e-9);
});

test("capacity accounts for margins and horizontal/vertical gaps", () => {
  const result = capacityForLayout({
    paper: { width: 100, height: 100 }, photo: { width: 20, height: 20 },
    photosPerRow: 4, gapX: 2, gapY: 2, margin: 5
  });
  assert.deepEqual(result, { columns: 4, rows: 4, total: 16, photoWidth: 20, photoHeight: 20 });
});

test("column count determines a fitted photo size while keeping its ratio", () => {
  assert.deepEqual(fitPhotoWidthForColumns({
    paper: { width: 100, height: 120 }, photosPerRow: 4,
    gapX: 2, gapY: 2, margin: 5, aspectRatio: 2 / 3
  }), { width: 21, height: 31.5 });
});

test("placements flow through rows and pages in photo order", () => {
  const result = layoutPlacements({
    paper: { width: 100, height: 50 }, photo: { width: 40, height: 40 },
    photosPerRow: 2, gapX: 0, gapY: 0, margin: 5
  }, [3, 2]);
  assert.equal(result.capacity.total, 2);
  assert.equal(result.pageCount, 3);
  assert.deepEqual(result.placements.map(({ photoIndex, page, row, column }) => [photoIndex, page, row, column]), [
    [0, 0, 0, 0], [0, 0, 0, 1], [0, 1, 0, 0], [1, 1, 0, 1], [1, 2, 0, 0]
  ]);
});

test("joint-photo orientation fits 28 upright or 30 turned on A4", () => {
  const common = { paper: { width: 210, height: 297 }, margin: 3, gapX: 2, gapY: 2, regularCount: 0, regularColumns: 6, regularRowsPerPage: 7, regularPhotoHeight: 39.6 };
  const upright = layoutJointRows({ ...common, joint: { width: 45, height: 35 }, jointCount: 7 });
  const turned = layoutJointRows({ ...common, joint: { width: 35, height: 45 }, jointCount: 6 });
  assert.equal(upright.columns * upright.rowsPerPage, 28);
  assert.equal(turned.columns * turned.rowsPerPage, 30);
  assert.equal(upright.placements.length, 28);
  assert.equal(turned.placements.length, 30);
});
