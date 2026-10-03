import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { clusterRecords, densityColor, DENSITY_COLORS, filterMapRecords, filterRangeEntries, hasCollectionEvidence, projectPoint, regionSpeciesCounts, type MapRecord, type MapSnapshot } from '../src/data/mushroomMap.ts';
import { formatSeasonPart } from '../src/data/season.ts';
import { db } from './loadDb.ts';
const snapshot = JSON.parse(readFileSync(new URL('../src/data/map-records.json', import.meta.url), 'utf8')) as MapSnapshot;
const sources = new Set(snapshot.sources.map((s) => s.id));
const specimen: MapRecord = { id: '1', speciesId: 'boletus-edulis', datasetId: snapshot.sources[0]!.id, latitude: 60, longitude: 68, date: '2024-08-12', locality: 'Шапша', region: 'Югра', identifiedBy: 'Determiner', catalogNumber: 'YSU-F-1', uncertaintyMeters: 30, countryCode: 'RU', basisOfRecord: 'PRESERVED_SPECIMEN' };

test('shipped map contains only traceable specimens of known non-protected species', () => {
  assert.ok(snapshot.records.length > 0);
  assert.equal(new Set(snapshot.records.map((r) => r.id)).size, snapshot.records.length);
  for (const r of snapshot.records) {
    assert.ok(hasCollectionEvidence(r, sources), r.id);
    assert.ok(/^\d+$/.test(r.id));
    assert.ok(db.get(r.speciesId), r.speciesId);
    assert.ok(!db.get(r.speciesId)!.protected);
  }
  for (const source of snapshot.sources) assert.ok(['CC0 1.0', 'CC BY 4.0'].includes(source.license));
});
test('records without collection evidence, with wrong country or invalid coordinates/dates are rejected', () => {
  assert.ok(hasCollectionEvidence(specimen, sources));
  for (const change of [
    { identifiedBy: '' }, { catalogNumber: '' }, { datasetId: 'unreviewed-source' },
    { countryCode: 'EE' }, { basisOfRecord: 'HUMAN_OBSERVATION' }, { latitude: NaN },
    { longitude: 181 }, { uncertaintyMeters: 5001 }, { uncertaintyMeters: -1 },
    { date: '2024-02-30' }, { date: '2099-10-02' }, { date: '2024-08' },
  ]) assert.ok(!hasCollectionEvidence({ ...specimen, ...change }, sources), JSON.stringify(change));
  assert.ok(hasCollectionEvidence({ ...specimen, uncertaintyMeters: null }, sources));
});
test('the Russian Far East crosses the antimeridian without wrapping onto the west', () => {
  const p = projectPoint(66, -175);
  assert.ok(p.x > 950 && p.x < 1000);
  assert.equal(filterMapRecords([{ ...specimen, longitude: -175 }], { area: 'east' }).length, 1);
  assert.equal(filterMapRecords([{ ...specimen, longitude: -175 }], { area: 'west' }).length, 0);
});
test('season filter uses historical observation date and search includes Russian species names', () => {
  const rows = [specimen, { ...specimen, id: '2', date: '2020-12-12' }];
  assert.deepEqual(filterMapRecords(rows, { season: 4 }).map((r) => r.id), ['2']);
  assert.equal(filterMapRecords(rows, { speciesId: 'lactarius-deliciosus' }).length, 0);
  assert.equal(filterMapRecords(rows, { query: ' БЕЛЫЙ ', speciesNames: { 'boletus-edulis': 'Белый гриб' } }).length, 2);
  assert.equal(filterMapRecords(rows, { query: 'шапша' }).length, 2);
});
test('cluster groups retain every individual source record', () => {
  const rows = [specimen, { ...specimen, id: '2', longitude: 68.01 }, { ...specimen, id: '3', longitude: 150 }];
  const clusters = clusterRecords(rows, 100);
  assert.equal(clusters.length, 2);
  assert.equal(clusters.flatMap((c) => c.records).length, 3);
});
test('calendar season labels include winter in intervals crossing New Year', () => {
  assert.equal(formatSeasonPart([9, 4]), 'весна, осень, зима');
  assert.equal(formatSeasonPart([6, 10]), 'лето, осень');
  assert.equal(formatSeasonPart([1, 12]), 'все времена года');
});

test('regional reports preserve provenance and never pretend to be coordinates', async () => {
  const ranges = JSON.parse(readFileSync(new URL('../src/data/map-ranges.json', import.meta.url), 'utf8'));
  const ids = new Set(ranges.regions.map((r: { id: string }) => r.id));
  assert.ok(ids.has('RU-KC')); assert.ok(ids.has('RU-STA'));
  for (const e of ranges.entries) {
    assert.ok(db.get(e.speciesId) && !db.get(e.speciesId)!.protected);
    assert.ok(e.page >= 2 && e.page < 663);
    assert.equal('latitude' in e, false);
    for (const r of e.reports) { assert.ok(ids.has(r.regionId)); assert.ok(r.references.trim()); }
  }
  const { filterRangeEntries } = await import('../src/data/mushroomMap.ts');
  const names = Object.fromEntries(db.all.map((s) => [s.id, s.nameRu]));
  const seasons = Object.fromEntries(db.all.map((s) => [s.id, s.season]));
  const kcr = filterRangeEntries(ranges.entries, ranges.regions, { area: 'kcr', query: 'рыжик', speciesNames: names });
  assert.equal(kcr.length, 2);
  assert.ok(kcr.every((e) => e.reports.every((r) => r.regionId === 'RU-KC')));
  assert.equal(filterRangeEntries(ranges.entries, ranges.regions, { area: 'kmv', query: 'рыжик', speciesNames: names }).length, 0);
  assert.ok(filterRangeEntries(ranges.entries, ranges.regions, { area: 'kmv' }).every((e) => e.reports.every((r) => r.regionId === 'RU-STA')));
  assert.equal(filterRangeEntries(ranges.entries, ranges.regions, { speciesId: 'lactarius-deliciosus', season: 1, speciesSeasons: seasons }).length, 0);
  assert.equal(filterMapRecords([specimen], { area: 'kcr' }).length, 0);
});

test('«сейчас»: месяцы фильтруют и литературные районы, и находки', () => {
  const rows = [specimen, { ...specimen, id: '2', date: '2020-12-12' }];
  assert.deepEqual(filterMapRecords(rows, { months: [12] }).map((r) => r.id), ['2']);
  const regions = [{ id: 'RU-A', name: 'A', paths: [], bounds: [100, 100, 110, 110] }];
  const entries = [{ speciesId: 'boletus-edulis', page: 1, reports: [{ regionId: 'RU-A', references: 'x' }] }];
  const seasons = { 'boletus-edulis': [6, 10] as [number, number] };
  assert.equal(filterRangeEntries(entries, regions, { months: [8], speciesSeasons: seasons }).length, 1);
  assert.equal(filterRangeEntries(entries, regions, { months: [1], speciesSeasons: seasons }).length, 0);
});

test('плотность видов по регионам и цвет заливки', () => {
  const entries = [
    { speciesId: 'a', page: 1, reports: [{ regionId: 'R1', references: '' }, { regionId: 'R2', references: '' }] },
    { speciesId: 'b', page: 1, reports: [{ regionId: 'R1', references: '' }] },
  ];
  assert.deepEqual(regionSpeciesCounts(entries), { R1: 2, R2: 1 });
  assert.equal(densityColor(0, 10), DENSITY_COLORS[0]);
  assert.equal(densityColor(10, 10), DENSITY_COLORS[DENSITY_COLORS.length - 1]);
  assert.notEqual(densityColor(1, 10), DENSITY_COLORS[0]);
});
