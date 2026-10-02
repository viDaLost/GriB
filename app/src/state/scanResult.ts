import type { Identification } from '../ml/decision';

/** Последний результат распознавания — передаётся с экрана камеры на экран результата. */
export interface ScanResult {
  /** URI снимка для показа (file://...) */
  photoUri: string;
  identification: Identification;
}

let current: ScanResult | null = null;

export function setScanResult(result: ScanResult): void {
  current = result;
}

export function getScanResult(): ScanResult | null {
  return current;
}
