const MONTHS = [
  'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
  'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь',
];

/** Попадает ли месяц (1–12) в сезон [с, по]. Сезон может переходить через Новый год: [9, 4]. */
export function isInSeason(season: [number, number], month: number): boolean {
  const [from, to] = season;
  return from <= to ? month >= from && month <= to : month >= from || month <= to;
}

export function formatSeason(season: [number, number]): string {
  const [from, to] = season;
  if (from === 1 && to === 12) return 'круглый год';
  if (from === to) return MONTHS[from - 1] ?? '';
  return `${MONTHS[from - 1]} — ${MONTHS[to - 1]}`;
}
