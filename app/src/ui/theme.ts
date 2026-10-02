import type { Edibility } from '../data/types';
import type { AlertLevel } from '../ml/decision';

export const colors = {
  bg: '#F7F4EC',
  card: '#FFFEFA',
  text: '#223E35',
  muted: '#4F6256',
  border: '#E3E5DA',
  primary: '#234F40',
  primaryText: '#FFFFFF',
  chip: '#ECEEE4',
  accent: '#B75B3D',
  accentSoft: '#F7E4D6',
  sage: '#DFE8D7',
  forestLight: '#B9CFAD',
};

export const edibilityColors: Record<Edibility, { bg: string; fg: string }> = {
  edible: { bg: '#DCEFD9', fg: '#1E5A26' },
  conditionally_edible: { bg: '#FBEFC9', fg: '#7A5A00' },
  inedible: { bg: '#E7E4DC', fg: '#4A4A42' },
  poisonous: { bg: '#FBDCCB', fg: '#9A3A0E' },
  deadly: { bg: '#F7C9C9', fg: '#8E0E0E' },
};

export const alertColors: Record<AlertLevel, { bg: string; fg: string; border: string }> = {
  deadly: { bg: '#8E0E0E', fg: '#FFFFFF', border: '#8E0E0E' },
  poisonous: { bg: '#B8460F', fg: '#FFFFFF', border: '#B8460F' },
  caution: { bg: '#FFF6DB', fg: '#5C4500', border: '#E9C866' },
};

export const spacing = { xs: 4, s: 8, m: 12, l: 16, xl: 24 };
export const radius = { s: 10, m: 20, l: 28 };
