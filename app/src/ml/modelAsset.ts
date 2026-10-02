// Этот файл перезаписывает training/export_tflite.py после обучения модели.
// Пока модели нет, приложение работает как офлайн-справочник.
import type { ModelMeta } from './modelMeta';

export const MODEL_SOURCE: number | null = null;
export const MODEL_META: ModelMeta | null = null;
