/**
 * Проверочные признаки: что убедиться у гриба, похожего на съедобный, прежде чем его брать.
 * Чистый модуль без React Native.
 */
import { isDangerous, type Species } from './types.ts';

export interface Check {
  /** Что должно быть у этого вида */
  must: string;
  /** Что значит несовпадение */
  ifNot: string;
  /** Опасные виды, на которые указывает несовпадение */
  danger?: string[];
}

/** Ссылка на группу проверок — строка вида '@agaricus'. */
export type CheckEntry = Check | string;

export interface ChecksData {
  groups: Record<string, Check[]>;
  species: Record<string, CheckEntry[]>;
}

const FALLBACK_GROUP: Record<Species['hymenophore'], string> = {
  gills: 'gilled',
  tubes: 'tubular',
  other: 'general',
};

/** Проверки для вида. Для ядовитых видов их нет: такой гриб не берут вовсе. */
export function checksFor(s: Species, data: ChecksData): Check[] {
  if (isDangerous(s.edibility) || s.edibility === 'inedible') return [];
  const entries = data.species[s.id] ?? [`@${FALLBACK_GROUP[s.hymenophore]}`];
  const out: Check[] = [];
  for (const e of entries) {
    if (typeof e !== 'string') out.push(e);
    else out.push(...(data.groups[e.slice(1)] ?? []));
  }
  return out;
}

export type CheckAnswer = 'yes' | 'no';

/** Опасные виды, на которые указывают проверки с ответом «нет». */
export function failedDangers(checks: Check[], answers: Record<number, CheckAnswer>): string[] {
  const ids = new Set<string>();
  checks.forEach((c, i) => {
    if (answers[i] === 'no') c.danger?.forEach((id) => ids.add(id));
  });
  return [...ids];
}
