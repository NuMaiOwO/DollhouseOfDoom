import { SHEET_H, SHEET_W, VIEWS, emptySheet, type Pixels, type Sheet, type View } from "./sheet";

/**
 * Browser-only helpers: drawing sheets onto canvases and converting to/from PNG.
 * PNG layout (72×48): [facing right | facing left | back].
 */
export const PNG_W = SHEET_W * VIEWS.length;
export const PNG_H = SHEET_H;
const col = (v: View) => VIEWS.indexOf(v) * SHEET_W;

function putPixels(data: Uint8ClampedArray, stride: number, p: Pixels, ox: number) {
  for (let y = 0; y < SHEET_H; y++) {
    for (let x = 0; x < SHEET_W; x++) {
      const c = p[y * SHEET_W + x];
      if (!c) continue;
      const o = (y * stride + ox + x) * 4;
      data[o] = (c >>> 24) & 255;
      data[o + 1] = (c >>> 16) & 255;
      data[o + 2] = (c >>> 8) & 255;
      data[o + 3] = c & 255;
    }
  }
}

/** The full 72×48 sheet as a canvas (for export). */
export function sheetToCanvas(sheet: Sheet): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = PNG_W;
  c.height = PNG_H;
  const ctx = c.getContext("2d")!;
  const data = ctx.createImageData(PNG_W, PNG_H);
  for (const v of VIEWS) putPixels(data.data, PNG_W, sheet[v], col(v));
  ctx.putImageData(data, 0, 0);
  return c;
}

export function sheetToPngBlob(sheet: Sheet): Promise<Blob> {
  return new Promise((resolve, reject) => sheetToCanvas(sheet).toBlob((b) => (b ? resolve(b) : reject(new Error("PNG export failed"))), "image/png"));
}

/** Reads a 72×48 PNG. (48×48 = right + left only; 24×48 = right only. Missing views stay empty.) */
export async function pngToSheet(file: Blob): Promise<Sheet> {
  const bitmap = await createImageBitmap(file);
  const views = bitmap.width / SHEET_W;
  if (bitmap.height !== PNG_H || ![1, 2, 3].includes(views)) {
    throw new Error(`Expected a ${PNG_W}×${PNG_H} PNG (got ${bitmap.width}×${bitmap.height})`);
  }
  const c = document.createElement("canvas");
  c.width = bitmap.width;
  c.height = bitmap.height;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0);
  const data = ctx.getImageData(0, 0, c.width, c.height).data;
  const sheet = emptySheet();
  VIEWS.slice(0, views).forEach((v) => {
    for (let y = 0; y < SHEET_H; y++) {
      for (let x = 0; x < SHEET_W; x++) {
        const o = (y * c.width + col(v) + x) * 4;
        const a = data[o + 3];
        sheet[v][y * SHEET_W + x] = a < 16 ? 0 : ((data[o] << 24) | (data[o + 1] << 16) | (data[o + 2] << 8) | a) >>> 0;
      }
    }
  });
  return sheet;
}

/** One view of a sheet, drawn into a canvas at the given zoom. */
export function renderView(sheet: Sheet, view: View, scale = 1): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = SHEET_W;
  c.height = SHEET_H;
  const ctx = c.getContext("2d")!;
  const data = ctx.createImageData(SHEET_W, SHEET_H);
  putPixels(data.data, SHEET_W, sheet[view], 0);
  ctx.putImageData(data, 0, 0);
  if (scale === 1) return c;
  const big = document.createElement("canvas");
  big.width = SHEET_W * scale;
  big.height = SHEET_H * scale;
  const bctx = big.getContext("2d")!;
  bctx.imageSmoothingEnabled = false;
  bctx.drawImage(c, 0, 0, big.width, big.height);
  return big;
}

/** A guide image for drawing in other tools: the 72×48 layout, labeled, at 8× zoom. */
export function templateGuideCanvas(): HTMLCanvasElement {
  const z = 8;
  const c = document.createElement("canvas");
  c.width = PNG_W * z;
  c.height = PNG_H * z;
  const ctx = c.getContext("2d")!;
  ctx.font = "bold 14px sans-serif";
  for (const v of VIEWS) {
    const ox = col(v) * z;
    ctx.fillStyle = "#f3f3f3";
    ctx.fillRect(ox, 0, SHEET_W * z, SHEET_H * z);
    ctx.strokeStyle = "#999";
    ctx.strokeRect(ox + 0.5, 0.5, SHEET_W * z - 1, SHEET_H * z - 1);
    ctx.fillStyle = "#222";
    ctx.fillText(v === "back" ? "back (turned away)" : `facing ${v}`, ox + 6, 18);
  }
  return c;
}
