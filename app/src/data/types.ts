/**
 * Категории съедобности в принятой в России классификации.
 * Порядок важен: чем больше индекс, тем опаснее гриб (см. DANGER_RANK).
 */
export type Edibility =
  | 'edible' // съедобный
  | 'conditionally_edible' // условно съедобный — только после специальной обработки
  | 'inedible' // несъедобный (горький, жёсткий, неприятный)
  | 'poisonous' // ядовитый
  | 'deadly'; // смертельно ядовитый

/** Тип гименофора — первое, на что смотрят при определении. */
export type Hymenophore =
  | 'tubes' // трубчатый (губчатый)
  | 'gills' // пластинчатый
  | 'other'; // сумчатые, дождевики, ежовики, трутовики и т.п.

export interface Lookalike {
  /** id вида в базе */
  id: string;
  /** Как отличить именно от этого вида */
  howToTell: string;
}

export interface Species {
  /** Стабильный id — латинское название в kebab-case. Он же метка класса модели. */
  id: string;
  nameRu: string;
  /** Народные и устаревшие названия — участвуют в поиске */
  altNamesRu: string[];
  latin: string;
  family: string;
  edibility: Edibility;
  /** Как обрабатывать или почему опасен. Для условно съедобных — обязательно. */
  edibilityNote?: string;
  hymenophore: Hymenophore;
  /** Главные признаки, по которым вид узнают в лесу */
  keyFeatures: string[];
  cap: string;
  underside: string;
  stem: string;
  flesh: string;
  habitat: string;
  /** Месяцы плодоношения [с, по], 1–12. Может переходить через год: [9, 4]. */
  season: [number, number];
  /** Где встречается в России */
  range: string;
  lookalikes: Lookalike[];
  /** Охраняется (Красная книга РФ или многих регионов) */
  protected?: boolean;
}

export const EDIBILITY_LABEL: Record<Edibility, string> = {
  edible: 'Съедобный',
  conditionally_edible: 'Условно съедобный',
  inedible: 'Несъедобный',
  poisonous: 'Ядовитый',
  deadly: 'Смертельно ядовитый',
};

export const DANGER_RANK: Record<Edibility, number> = {
  edible: 0,
  conditionally_edible: 1,
  inedible: 2,
  poisonous: 3,
  deadly: 4,
};

export const HYMENOPHORE_LABEL: Record<Hymenophore, string> = {
  tubes: 'Трубчатый',
  gills: 'Пластинчатый',
  other: 'Другие',
};

export function isDangerous(e: Edibility): boolean {
  return e === 'poisonous' || e === 'deadly';
}
