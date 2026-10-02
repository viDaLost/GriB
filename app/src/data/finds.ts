/**
 * Мои находки: места, где пользователь нашёл гриб. Хранятся только на устройстве.
 * Чистый модуль без React Native.
 */
import type { MapRecord } from './mushroomMap.ts';

export interface Find {
  id: string;
  /** id вида из справочника; нет — гриб не определён */
  speciesId?: string;
  latitude: number;
  longitude: number;
  /** Точность координат, м */
  accuracy: number | null;
  /** ISO-дата */
  date: string;
  note?: string;
}

export const MY_FINDS_DATASET = 'my-finds';

/** Разбор сохранённого списка; повреждённые записи пропускаются. */
export function parseFinds(raw: string | null): Find[] {
  if (!raw) return [];
  try {
    const list: unknown = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list.filter(
      (f): f is Find =>
        typeof f === 'object' && f != null &&
        typeof f.id === 'string' && typeof f.date === 'string' &&
        Number.isFinite(f.latitude) && Number.isFinite(f.longitude) &&
        Math.abs(f.latitude) <= 90 && Math.abs(f.longitude) <= 180,
    );
  } catch {
    return [];
  }
}

/** Находка в формате точки карты — чтобы показать её тем же слоем, что и коллекции. */
export function findToRecord(f: Find): MapRecord {
  return {
    id: f.id,
    speciesId: f.speciesId ?? '',
    datasetId: MY_FINDS_DATASET,
    latitude: f.latitude,
    longitude: f.longitude,
    date: f.date,
    locality: f.note ?? '',
    region: '',
    identifiedBy: 'Я',
    catalogNumber: '',
    uncertaintyMeters: f.accuracy,
    basisOfRecord: 'HUMAN_OBSERVATION',
    countryCode: '',
  };
}

