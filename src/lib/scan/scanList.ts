// Reads a photo of a delivery list in the browser. The photo never leaves the phone: Tesseract runs here, and only
// its program and English data are downloaded (about 5 MB, once, then cached by the browser).
import { cleanImage } from "./cleanImage";
import { readTable, type OcrResult, type ScanResult } from "./readTable";

// Tesseract reads best with text about 30 to 40 pixels tall, so photos are scaled to roughly this size.
const LONG_SIDE_MIN = 2400;
const LONG_SIDE_MAX = 3200;

export async function scanList(file: File, onProgress: (message: string) => void): Promise<ScanResult> {
  onProgress("Preparing the photo...");
  const bitmap = await createImageBitmap(file);
  const long = Math.max(bitmap.width, bitmap.height);
  const scale = Math.min(LONG_SIDE_MAX, Math.max(LONG_SIDE_MIN, long)) / long;
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const pixels = ctx.getImageData(0, 0, width, height);
  // Let the message paint before the heavy work blocks the page for a second or two.
  await new Promise((r) => setTimeout(r, 50));
  const ink = cleanImage(pixels.data, width, height);
  for (let i = 0; i < ink.length; i++) {
    pixels.data[i * 4] = pixels.data[i * 4 + 1] = pixels.data[i * 4 + 2] = ink[i];
    pixels.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(pixels, 0, 0);

  onProgress("Loading the text reader (first time takes longer)...");
  const { createWorker, PSM } = await import("tesseract.js");
  const worker = await createWorker("eng");
  onProgress("Reading the page...");
  try {
    return await readTable(
      async ({ rect, mode, whitelist }): Promise<OcrResult> => {
        await worker.setParameters({
          tessedit_pageseg_mode: mode === "sparse" ? PSM.SPARSE_TEXT : PSM.SINGLE_BLOCK,
          tessedit_char_whitelist: whitelist ?? "",
        });
        const { data } = await worker.recognize(canvas, rect ? { rectangle: rect } : {}, { blocks: true });
        const lines = (data.blocks ?? []).flatMap((b) => b.paragraphs.flatMap((p) => p.lines));
        return {
          lines: lines.map((l) => ({ text: l.text.trim(), y0: l.bbox.y0, y1: l.bbox.y1 })),
          words: lines.flatMap((l) => l.words).map((w) => ({ text: w.text, ...w.bbox })),
        };
      },
      { width, height },
      (done, total) => onProgress(`Reading column ${done} of ${total}...`),
    );
  } finally {
    await worker.terminate();
  }
}
