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

test("A4 keeps seven rows for default, passport, and smaller photos", () => {
  for (const photo of [{ width: 32, height: 39.6 }, { width: 35, height: 45 }, { width: 25, height: 35 }, { width: 50.8, height: 50.8 }]) {
    const input = { paper: { width: 210, height: 297 }, photo, photosPerRow: 6, gapX: 2, gapY: 2, margin: 3 };
    const result = layoutPlacements(input, [43]);
    assert.equal(result.capacity.rows, 7);
    assert.equal(result.capacity.total, 42);
    assert.equal(result.placements[41].page, 0);
    assert.equal(result.placements[41].row, 6);
    assert.equal(result.placements[42].page, 1);
    assert.ok(Math.abs(result.capacity.photoWidth / result.capacity.photoHeight - photo.width / photo.height) < 1e-9);
    assert.ok(input.margin + 7 * result.capacity.photoHeight + 6 * input.gapY <= 297 - input.margin + 1e-9);
  }
});

test("A4 cannot fit seven rows when vertical gaps exceed the paper", () => {
  const result = layoutPlacements({ paper: { width: 210, height: 297 }, photo: { width: 35, height: 45 }, photosPerRow: 6, gapX: 2, gapY: 50, margin: 3 }, [42]);
  assert.equal(result.capacity.total, 0);
  assert.deepEqual(result.placements, []);
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

test("excessive margins or gaps produce no placements and finite capacity", () => {
  const base = { paper: { width: 100, height: 100 }, photo: { width: 20, height: 20 }, photosPerRow: 4, gapX: 0, gapY: 0, margin: 50 };
  for (const input of [base, { ...base, margin: 5, gapX: 40 }]) {
    const result = layoutPlacements(input, [6]);
    assert.equal(result.capacity.total, 0);
    assert.equal(result.capacity.rows, 0);
    assert.deepEqual(result.placements, []);
    assert.equal(result.pageCount, 1);
  }
});

test("joint photos larger than usable paper do not overflow the sheet", () => {
  const base = { paper: { width: 100, height: 100 }, joint: { width: 95, height: 20 }, margin: 5, gapX: 2, gapY: 2, regularCount: 5, regularColumns: 2, regularRowsPerPage: 2, regularPhotoHeight: 20, jointCount: 1 };
  for (const joint of [base.joint, { width: 20, height: 95 }, { width: 0, height: 20 }]) {
    const result = layoutJointRows({ ...base, joint });
    assert.deepEqual(result.placements, []);
    assert.equal(result.pageCount, 2);
  }
});

test("no joint photos preserves a partially filled regular last page", () => {
  const result = layoutJointRows({ paper: { width: 100, height: 100 }, joint: { width: 20, height: 20 }, margin: 5, gapX: 2, gapY: 2, regularCount: 5, regularColumns: 2, regularRowsPerPage: 2, regularPhotoHeight: 20, jointCount: 0 });
  assert.equal(result.pageCount, 2);
  assert.deepEqual(result.placements, []);
});
