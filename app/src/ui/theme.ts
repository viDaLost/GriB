import type { Edibility } from '../data/types';
import type { AlertLevel } from '../ml/decision';

/**
 * Палитра «полевого определителя»: прохладная берёста, ельник, мох.
 * Тёплые и красные цвета зарезервированы под смысл: сезон и опасность.
 */
export const colors = {
  bg: '#EDEFE9', // берёста
  card: '#F8F9F5', // страница определителя
  text: '#1D3327', // ельник
  muted: '#4E5F55',
  border: '#D3D8CE', // тонкая линейка между записями
  primary: '#1F3A2B',
  primaryText: '#FFFFFF',
  moss: '#56732B',
  chip: '#E0E4DB',
  accent: '#B5781A', // лисичка — только «сейчас сезон»
  accentSoft: '#F3E3C2',
  danger: '#A8231B', // мухомор — только опасность
  sage: '#DDE3D2',
  forestLight: '#B9CFAD',
};

/** Literata — книжный шрифт определителя (названия видов, латынь); Golos Text — интерфейс. */
export const fonts = {
  display: 'Literata_600SemiBold',
  italic: 'Literata_400Regular_Italic',
  body: 'GolosText_400Regular',
  medium: 'GolosText_500Medium',
  semibold: 'GolosText_600SemiBold',
  bold: 'GolosText_700Bold',
};

export const edibilityColors: Record<Edibility, { bg: string; fg: string }> = {
  edible: { bg: '#E1EAD0', fg: '#3F5B1C' },
  conditionally_edible: { bg: '#F4E6C2', fg: '#7A5600' },
  inedible: { bg: '#E2E3DE', fg: '#4A4D47' },
  poisonous: { bg: '#F6DACB', fg: '#9A3A12' },
  deadly: { bg: '#F4CDC9', fg: '#8E1414' },
};

export const alertColors: Record<AlertLevel, { bg: string; fg: string; border: string }> = {
  deadly: { bg: '#8E0E0E', fg: '#FFFFFF', border: '#8E0E0E' },
  poisonous: { bg: '#B8460F', fg: '#FFFFFF', border: '#B8460F' },
  caution: { bg: '#FFF6DB', fg: '#5C4500', border: '#E9C866' },
};

export const spacing = { xs: 4, s: 8, m: 12, l: 16, xl: 24 };
/** Радиусы по иерархии: мелкие элементы почти прямые, фото и листы — мягче. */
export const radius = { s: 6, m: 12, l: 20 };
