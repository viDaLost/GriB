/** Признаки вида для определителя. null — признак варьирует или не применим, в счёте не участвует. */

export type Form = 'cap' | 'puffball' | 'morel' | 'bracket' | 'coral';
export type Underside = 'gills' | 'folds' | 'tubes' | 'spines';
export type CapColor =
  | 'white' | 'yellow' | 'orange' | 'red' | 'pink'
  | 'violet' | 'green' | 'brown' | 'gray' | 'black';
export type CutColor = 'none' | 'blue' | 'red' | 'yellow' | 'green' | 'darkens';
export type MilkColor = 'white' | 'orange' | 'red' | 'clear';
export type Substrate = 'soil' | 'wood';
export type Place = 'forest' | 'open' | 'both';

export interface Traits {
  form: Form;
  underside: Underside | null;
  colors: CapColor[];
  ring: boolean | null;
  volva: boolean | null;
  milk: boolean | null;
  /** Initial colour, immediately after a break; later oxidation is a separate trait. */
  milkColor?: MilkColor[];
  cut: CutColor[] | null;
  substrate: Substrate | null;
  place: Place;
}

export const FORM_LABEL: Record<Form, string> = {
  cap: 'Шляпка на ножке',
  puffball: 'Шар или груша без шляпки',
  morel: 'Ячеистая или мозговидная шляпка',
  bracket: 'Нарост на дереве',
  coral: 'Кустик-кораллы без шляпки',
};

export const UNDERSIDE_LABEL: Record<Underside, string> = {
  gills: 'Пластинки',
  folds: 'Толстые складки',
  tubes: 'Губка (трубочки)',
  spines: 'Шипики',
};

export const COLOR_LABEL: Record<CapColor, string> = {
  white: 'Белая',
  yellow: 'Жёлтая',
  orange: 'Оранжевая',
  red: 'Красная',
  pink: 'Розовая',
  violet: 'Фиолетовая',
  green: 'Зеленоватая',
  brown: 'Коричневая',
  gray: 'Серая',
  black: 'Чёрная',
};

export const CUT_LABEL: Record<CutColor, string> = {
  none: 'Не меняет цвет',
  blue: 'Синеет',
  red: 'Краснеет',
  yellow: 'Желтеет',
  green: 'Зеленеет',
  darkens: 'Буреет или чернеет',
};

export const SUBSTRATE_LABEL: Record<Substrate, string> = {
  soil: 'На земле',
  wood: 'На дереве или пне',
};

export const PLACE_LABEL: Record<Exclude<Place, 'both'>, string> = {
  forest: 'В лесу',
  open: 'Луг, сад, обочина',
};
