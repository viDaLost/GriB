/**
 * Распознавание в браузере (веб-версия / PWA): та же модель .tflite через LiteRT.js (WebAssembly).
 * Файлы модели и рантайма кладёт рядом с сайтом scripts/build-web.mjs.
 */
import { loadAndCompile, loadLiteRt, Tensor, type CompiledModel } from '@litertjs/core';
import { applyTemperature, averageProbs } from './ensemble';
import { MODEL_META } from './modelAsset';
import { centerSquare, toModelInput } from './pixels';

/** Путь сайта, например «/GriB» на GitHub Pages; задаётся experiments.baseUrl в app.json. */
const BASE = (process.env.EXPO_BASE_URL ?? '').replace(/\/$/, '');
export const WEB_MODEL_URL = `${BASE}/model/gribnik.tflite`;
export const WEB_LITERT_DIR = `${BASE}/litert/`;

let modelPromise: Promise<CompiledModel> | null = null;

function getModel(): Promise<CompiledModel> {
  if (!MODEL_META) return Promise.reject(new Error('Модель распознавания ещё не установлена.'));
  modelPromise ??= (async () => {
    await loadLiteRt(WEB_LITERT_DIR);
    return loadAndCompile(WEB_MODEL_URL, { accelerator: 'wasm' });
  })().catch((e: unknown) => {
    modelPromise = null;
    throw e;
  });
  return modelPromise;
}

export function isModelInstalled(): boolean {
  return MODEL_META != null;
}

export function modelLabels(): string[] {
  return MODEL_META?.labels ?? [];
}

export function warmUpModel(): void {
  if (isModelInstalled()) getModel().catch(() => {});
}

/** Картинка из файла с учётом поворота из EXIF (браузер применяет его сам при декодировании <img>). */
async function decode(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    // Картинка уже декодирована — ссылку можно отпустить.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

type View = { zoom: number; mirror: boolean };
const VIEWS: View[] = [
  { zoom: 1, mirror: false },
  { zoom: 0.8, mirror: false },
  { zoom: 1, mirror: true },
];

function pixelsFor(img: HTMLImageElement, size: number, view: View): Uint8ClampedArray {
  const { x, y, side } = centerSquare(img.naturalWidth, img.naturalHeight);
  const crop = side * view.zoom;
  const off = (side - crop) / 2;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Браузер не поддерживает canvas.');
  ctx.imageSmoothingQuality = 'high';
  if (view.mirror) {
    ctx.translate(size, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(img, x + off, y + off, crop, crop, 0, 0, size, size);
  return ctx.getImageData(0, 0, size, size).data;
}

/**
 * Вероятности классов для фото: центр, приближение и зеркальный вариант,
 * с калибровкой — так же, как в Android-версии.
 */
export async function classifyBlob(blob: Blob, onProgress?: (done: number, total: number) => void): Promise<number[]> {
  const model = await getModel();
  const meta = MODEL_META!;
  const size = meta.input.size;
  const img = await decode(blob);

  const outputs: number[][] = [];
  for (const view of VIEWS) {
    onProgress?.(outputs.length + 1, VIEWS.length);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const rgba = pixelsFor(img, size, view);
    const input = toModelInput(rgba.buffer as ArrayBuffer, size, size, 'RGBA', meta.input);
    const tensor = new Tensor(new Float32Array(input), [1, size, size, 3]);
    try {
      const results = await model.run(tensor);
      try {
        const out = results[0];
        if (!out) throw new Error('Модель не вернула результат.');
        outputs.push(applyTemperature(out.toTypedArray() as Float32Array, meta.temperature ?? 1));
      } finally { results.forEach((r) => r.delete()); }
    } finally { tensor.delete(); }
  }
  return averageProbs(outputs);
}
