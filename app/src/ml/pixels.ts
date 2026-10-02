/**
 * Преобразование пикселей картинки во входной тензор модели.
 * Чистые функции без React Native — покрыты тестами.
 */

/** Порядок байт в памяти, как его отдаёт react-native-nitro-image. */
export type PixelFormat =
  | 'ARGB' | 'BGRA' | 'ABGR' | 'RGBA'
  | 'XRGB' | 'BGRX' | 'XBGR' | 'RGBX'
  | 'RGB' | 'BGR' | 'unknown';

/** Как модель ожидает значения пикселей (задаётся при экспорте, см. training/). */
export type Normalization = 'raw255' | 'zero_one' | 'minus_one_one';

export interface ModelInputSpec {
  size: number;
  dtype: 'float32' | 'uint8';
  normalization: Normalization;
}

/** Смещения R, G, B внутри пикселя и размер пикселя в байтах. */
export function channelLayout(format: PixelFormat): { r: number; g: number; b: number; stride: number } {
  switch (format) {
    case 'RGBA':
    case 'RGBX':
      return { r: 0, g: 1, b: 2, stride: 4 };
    case 'BGRA':
    case 'BGRX':
      return { r: 2, g: 1, b: 0, stride: 4 };
    case 'ARGB':
    case 'XRGB':
      return { r: 1, g: 2, b: 3, stride: 4 };
    case 'ABGR':
    case 'XBGR':
      return { r: 3, g: 2, b: 1, stride: 4 };
    case 'RGB':
      return { r: 0, g: 1, b: 2, stride: 3 };
    case 'BGR':
      return { r: 2, g: 1, b: 0, stride: 3 };
    default:
      throw new Error(`Неподдерживаемый формат пикселей: ${format}`);
  }
}

/** Центральный квадрат картинки — модель обучена на квадратных снимках. */
export function centerSquare(width: number, height: number): { x: number; y: number; side: number } {
  const side = Math.min(width, height);
  return {
    x: Math.floor((width - side) / 2),
    y: Math.floor((height - side) / 2),
    side,
  };
}

/**
 * Упаковывает пиксели (width × height, с возможным выравниванием строк)
 * в тензор [1, height, width, 3] формата RGB.
 */
export function toModelInput(
  buffer: ArrayBuffer,
  width: number,
  height: number,
  format: PixelFormat,
  spec: ModelInputSpec,
): ArrayBuffer {
  const src = new Uint8Array(buffer);
  const { r, g, b, stride } = channelLayout(format);
  const rowBytes = Math.floor(src.length / height);
  if (rowBytes < width * stride) {
    throw new Error(`Буфер ${src.length} байт меньше ожидаемого для ${width}×${height}`);
  }

  const count = width * height * 3;
  const out = spec.dtype === 'uint8' ? new Uint8Array(count) : new Float32Array(count);
  const scale =
    spec.dtype === 'uint8' || spec.normalization === 'raw255'
      ? (v: number) => v
      : spec.normalization === 'zero_one'
        ? (v: number) => v / 255
        : (v: number) => v / 127.5 - 1;

  let o = 0;
  for (let y = 0; y < height; y++) {
    let i = y * rowBytes;
    for (let x = 0; x < width; x++, i += stride) {
      out[o++] = scale(src[i + r]!);
      out[o++] = scale(src[i + g]!);
      out[o++] = scale(src[i + b]!);
    }
  }
  return out.buffer as ArrayBuffer;
}
