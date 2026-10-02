import type { ModelMeta } from './modelMeta';

export function modelCoverage(id: string, meta: ModelMeta | null): string {
  if (!meta?.labels.includes(id)) {
    return 'Пока только в атласе: текущая модель не обучена распознавать этот вид по фото.';
  }
  const stat = meta.perClass?.[id];
  if (meta.limitedValidation?.includes(id) || (stat && stat.n < 20)) {
    return 'Входит в распознавание, но проверочных фотографий пока мало. Особенно внимательно сравните признаки и двойников.';
  }
  return 'Этот вид входит в распознавание по фото. Результат нужно проверить по признакам и опасным двойникам.';
}

export function trainedSpeciesCount(ids: string[], meta: ModelMeta | null): number {
  const supported = new Set(meta?.labels ?? []);
  return ids.filter(id => supported.has(id)).length;
}
