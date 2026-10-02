export interface MapRecord {
  id: string;
  speciesId: string;
  datasetId: string;
  latitude: number;
  longitude: number;
  date: string;
  locality: string;
  region: string;
  identifiedBy: string;
  catalogNumber: string;
  uncertaintyMeters: number | null;
  basisOfRecord: string;
  countryCode: string;
}
export interface MapSource { id: string; name: string; code: string; license: string; doi: string }
export interface MapSnapshot { updatedAt: string; sources: MapSource[]; records: MapRecord[]; method: string }
export type MapArea = 'all' | 'west' | 'ural' | 'siberia' | 'east' | 'kmv' | 'kcr';
export const MAP_AREAS: { id: MapArea; name: string; minLon: number; maxLon: number; minLat?: number; maxLat?: number; regionId?: string }[] = [
  { id: 'all', name: 'Вся Россия', minLon: 19, maxLon: 191 },
  { id: 'kmv', name: 'КМВ', minLon: 42.35, maxLon: 43.35, minLat: 43.7, maxLat: 44.4, regionId: 'RU-STA' },
  { id: 'kcr', name: 'КЧР', minLon: 40.6, maxLon: 43, minLat: 42.9, maxLat: 44.6, regionId: 'RU-KC' },
  { id: 'west', name: 'Европейская часть', minLon: 19, maxLon: 55 },
  { id: 'ural', name: 'Урал', minLon: 55, maxLon: 65 },
  { id: 'siberia', name: 'Сибирь', minLon: 65, maxLon: 110 },
  { id: 'east', name: 'Дальний Восток', minLon: 110, maxLon: 191 },
];
export function eastLongitude(lon: number) { return lon < 0 ? lon + 360 : lon; }
/** Same equirectangular projection as the bundled Natural Earth outlines. */
export function projectPoint(latitude: number, longitude: number) {
  return { x: (eastLongitude(longitude) - 19) / 172 * 1000, y: (82 - latitude) / 41 * 480 };
}
/** Require evidence fields. Upstream taxon and coordinate issues are checked at import. */
export function hasCollectionEvidence(r: MapRecord, sourceIds: Set<string>): boolean {
  const timestamp = Date.parse(r.date);
  return sourceIds.has(r.datasetId) && r.basisOfRecord === 'PRESERVED_SPECIMEN' && r.countryCode === 'RU'
    && !!r.id && !!r.catalogNumber.trim() && !!r.identifiedBy.trim() && !!r.locality.trim()
    && /^\d{4}-\d{2}-\d{2}$/.test(r.date) && Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === r.date && timestamp <= Date.now()
    && Number.isFinite(r.latitude) && r.latitude >= 41 && r.latitude <= 82
    && Number.isFinite(r.longitude) && r.longitude >= -180 && r.longitude <= 180 && eastLongitude(r.longitude) >= 19 && eastLongitude(r.longitude) <= 191
    && (r.uncertaintyMeters === null || (Number.isFinite(r.uncertaintyMeters) && r.uncertaintyMeters >= 0 && r.uncertaintyMeters <= 5000));
}
export function filterMapRecords(records: MapRecord[], { speciesId, area = 'all', season = 0, query = '', speciesNames = {} }: {
  speciesId?: string; area?: MapArea; season?: number; query?: string; speciesNames?: Record<string, string>;
}) {
  const bounds = MAP_AREAS.find((a) => a.id === area)!;
  const q = query.trim().toLocaleLowerCase('ru');
  return records.filter((r) => {
    const lon = eastLongitude(r.longitude);
    const month = Number(r.date.slice(5, 7));
    const part = month === 12 || month <= 2 ? 4 : month <= 5 ? 1 : month <= 8 ? 2 : 3;
    return (!speciesId || r.speciesId === speciesId) && lon >= bounds.minLon && lon < bounds.maxLon
      && r.latitude >= (bounds.minLat ?? 41) && r.latitude <= (bounds.maxLat ?? 82)
      && (!season || season === part)
      && (!q || `${speciesNames[r.speciesId] ?? ''} ${r.locality} ${r.region}`.toLocaleLowerCase('ru').includes(q));
  });
}
export interface MapCluster { id: string; x: number; y: number; records: MapRecord[] }
export function clusterRecords(records: MapRecord[], cellSize: number): MapCluster[] {
  const cells = new Map<string, MapRecord[]>();
  for (const r of records) {
    const p = projectPoint(r.latitude, r.longitude);
    const key = `${Math.floor(p.x / cellSize)}:${Math.floor(p.y / cellSize)}`;
    const cell = cells.get(key) ?? []; cell.push(r); cells.set(key, cell);
  }
  return [...cells.entries()].map(([id, rows]) => {
    const points = rows.map((r) => projectPoint(r.latitude, r.longitude));
    return { id, x: points.reduce((sum, p) => sum + p.x, 0) / rows.length, y: points.reduce((sum, p) => sum + p.y, 0) / rows.length, records: rows };
  });
}

export interface MapRegion { id: string; name: string; paths: string[]; bounds: number[] }
export interface RangeEntry { speciesId: string; page: number; reports: { regionId: string; references: string }[] }
export interface RangeSnapshot {
  source: { title: string; url: string; supplement: string; year: number; method: string };
  regions: MapRegion[];
  entries: RangeEntry[];
}
/** Regional literature reports remain regions; never turn them into point observations. */
export function filterRangeEntries(entries: RangeEntry[], regions: MapRegion[], { speciesId, area = 'all', regionId, season = 0, query = '', speciesNames = {}, speciesSeasons = {} }: {
  speciesId?: string; area?: MapArea; regionId?: string; season?: number; query?: string;
  speciesNames?: Record<string, string>; speciesSeasons?: Record<string, [number, number]>;
}): RangeEntry[] {
  const bounds = MAP_AREAS.find((a) => a.id === area)!;
  const left = projectPoint(82, bounds.minLon).x, right = projectPoint(41, bounds.maxLon).x;
  const top = projectPoint(bounds.maxLat ?? 82, 19).y, bottom = projectPoint(bounds.minLat ?? 41, 19).y;
  const q = query.trim().toLocaleLowerCase('ru');
  const months = season === 4 ? [12, 1, 2] : season ? [season * 3, season * 3 + 1, season * 3 + 2] : [];
  return entries.filter((e) => (!speciesId || e.speciesId === speciesId) && (!season || months.some((m) => {
    const s = speciesSeasons[e.speciesId]; return s && (s[0] <= s[1] ? m >= s[0] && m <= s[1] : m >= s[0] || m <= s[1]);
  }))).map((e) => ({ ...e, reports: e.reports.filter((report) => {
    const region = regions.find((r) => r.id === report.regionId);
    if (!region || (regionId && region.id !== regionId) || (bounds.regionId && region.id !== bounds.regionId)) return false;
    const b = region.bounds;
    return b[0]! <= right && b[2]! >= left && b[1]! <= bottom && b[3]! >= top
      && (!q || `${speciesNames[e.speciesId] ?? ''} ${region.name}`.toLocaleLowerCase('ru').includes(q));
  }) })).filter((e) => e.reports.length > 0);
}
