import type { ModelInputSpec } from './pixels';

/** Описание обученной модели — генерирует training/export_tflite.py. */
export interface ModelMeta {
  version: string;
  createdAt: string;
  architecture: string;
  input: ModelInputSpec;
  /** id вида для каждого выхода модели; служебный класс — «__not_mushroom__» */
  labels: string[];
  metrics?: {
    top1?: number;
    top3?: number;
    testImages?: number;
  };
}
