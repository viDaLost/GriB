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

/** Calendar seasons, including intervals crossing New Year. */
export function formatSeasonPart(season: [number, number]): string {
  if (season[0] === 1 && season[1] === 12) return 'все времена года';
  const parts = [
    { label: 'весна', months: [3, 4, 5] }, { label: 'лето', months: [6, 7, 8] },
    { label: 'осень', months: [9, 10, 11] }, { label: 'зима', months: [12, 1, 2] },
  ];
  return parts.filter((part) => part.months.some((month) => isInSeason(season, month))).map((part) => part.label).join(', ');
}
