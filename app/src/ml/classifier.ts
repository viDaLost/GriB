import { loadTensorflowModel, type TfliteModel } from 'react-native-fast-tflite';
import type { Image } from 'react-native-nitro-image';
import { applyTemperature, averageProbs } from './ensemble';
import { MODEL_META, MODEL_SOURCE } from './modelAsset';
import { centerSquare, toModelInput, type ModelInputSpec } from './pixels';

export function isModelInstalled(): boolean {
  return MODEL_SOURCE != null && MODEL_META != null;
}

export function modelLabels(): string[] {
  return MODEL_META?.labels ?? [];
}

let modelPromise: Promise<TfliteModel> | null = null;

/** Модель грузится один раз и переиспользуется. Работает на CPU — для одного снимка этого достаточно. */
function getModel(): Promise<TfliteModel> {
  if (MODEL_SOURCE == null) {
    return Promise.reject(new Error('Модель распознавания ещё не установлена в приложение.'));
  }
  modelPromise ??= loadTensorflowModel(MODEL_SOURCE, []).catch((e: unknown) => {
    modelPromise = null;
    throw e;
  });
  return modelPromise;
}

/** Заранее загрузить модель, чтобы первый снимок обработался быстрее. */
export function warmUpModel(): void {
  if (isModelInstalled()) getModel().catch(() => {});
}

/** Фактические параметры входа берём из самой модели — они главнее описания. */
function inputSpec(model: TfliteModel): ModelInputSpec {
  const tensor = model.inputs[0];
  const meta = MODEL_META!.input;
  if (!tensor) return meta;
  const size = tensor.shape[1] ?? meta.size;
  const dtype = tensor.dataType === 'uint8' ? 'uint8' : 'float32';
  return { size, dtype, normalization: meta.normalization };
}

function readOutput(model: TfliteModel, buffer: ArrayBuffer): ArrayLike<number> {
  const type = model.outputs[0]?.dataType;
  if (type === 'uint8') return Array.from(new Uint8Array(buffer), (v) => v / 255);
  return new Float32Array(buffer);
}

async function run(model: TfliteModel, spec: ModelInputSpec, view: Image): Promise<number[]> {
  const resized = await view.resizeAsync(spec.size, spec.size);
  let input: ArrayBuffer;
  try {
    const pixels = await resized.toRawPixelDataAsync();
    input = toModelInput(pixels.buffer, pixels.width, pixels.height, pixels.pixelFormat, spec);
  } finally { resized.dispose(); }
  const [output] = await model.run([input]);
  if (!output) throw new Error('Модель не вернула результат.');
  return applyTemperature(readOutput(model, output), MODEL_META!.temperature ?? 1);
}

/**
 * Вероятности классов для снимка. Модель смотрит на кадр трижды — центральный квадрат,
 * он же чуть ближе и он же зеркально — и ответы усредняются: так случайные ошибки
 * одного ракурса сглаживаются.
 */
export async function classifyImage(image: Image): Promise<number[]> {
  const model = await getModel();
  const spec = inputSpec(model);

  const { x, y, side } = centerSquare(image.width, image.height);
  const square = await image.cropAsync(x, y, x + side, y + side);
  const inset = Math.round(side * 0.1);
  const views: Image[] = [square];
  try {
    views.push(await square.cropAsync(inset, inset, side - inset, side - inset));
    views.push(await square.mirrorHorizontallyAsync());
    const outputs: number[][] = [];
    for (const view of views) outputs.push(await run(model, spec, view));
    return averageProbs(outputs);
  } finally { views.forEach((v) => v.dispose()); }
}
