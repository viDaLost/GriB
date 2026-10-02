// Веб-версия: нативные модули камеры и TFLite в браузере недоступны,
// распознавание идёт через LiteRT.js (webClassifier.ts).
export { isModelInstalled, modelLabels, warmUpModel } from './webClassifier';

export function classifyImage(): Promise<number[]> {
  return Promise.reject(new Error('В браузере используйте classifyBlob из webClassifier.'));
}
