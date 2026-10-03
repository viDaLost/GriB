import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { db } from '../data/db';
import rangesJson from '../data/map-ranges.json';
import snapshotJson from '../data/map-records.json';
import {
  DENSITY_COLORS, densityColor, filterMapRecords, filterRangeEntries, hasCollectionEvidence, MAP_AREAS, regionSpeciesCounts,
  type MapArea, type MapCluster, type MapSnapshot, type RangeEntry, type RangeSnapshot,
} from '../data/mushroomMap';
import { searchSpecies } from '../data/search';
import { formatSeason, isInSeason } from '../data/season';
import { isDangerous, type Species } from '../data/types';
import { Button, Card, EdibilityBadge, SpeciesRow } from '../ui/components';
import { Icon } from '../ui/Icon';
import { RangeCards, RegionPicker } from '../ui/MapRanges';
import { RussiaMap } from '../ui/RussiaMap';
import { colors, edibilityColors } from '../ui/theme';

const ranges = rangesJson as RangeSnapshot;
const speciesSeasons = Object.fromEntries(db.all.map((s) => [s.id, s.season]));
const snapshot = snapshotJson as MapSnapshot;
const sourceIds = new Set(snapshot.sources.map((s) => s.id));
const records = snapshot.records.filter((r) => hasCollectionEvidence(r, sourceIds) && db.get(r.speciesId) && !db.get(r.speciesId)!.protected);
const regionNames: Record<string, string> = {
  'Khanty-Mansiyskiy Avtonomnyy Okrug': 'Ханты-Мансийский автономный округ — Югра',
  'Novgorod': 'Новгородская область', 'Primorskiy Kray': 'Приморский край',
  "Tomskaya Oblast'": 'Томская область', "Sverdlovskaya Oblast'": 'Свердловская область',
  "Irkutskaya Oblast'": 'Иркутская область', 'Respublika Altay': 'Республика Алтай',
  "Moskovskaya Oblast'": 'Московская область', 'Respublika Buryatiya': 'Республика Бурятия',
  'Yamalo-Nenetskiy Avtonomnyy Okrug': 'Ямало-Ненецкий автономный округ',
  "Novosibirskaya Oblast'": 'Новосибирская область',
};
const localRecords = records.map((r) => ({ ...r, region: regionNames[r.region] ?? r.region }));
/** Виды, о которых на карте есть хоть какие-то сведения: только их предлагаем в поиске. */
const mappedIds = new Set([...ranges.entries.map((e) => e.speciesId), ...records.map((r) => r.speciesId)]);

type SeasonFilter = 'now' | 0 | 1 | 2 | 3 | 4;
const SEASONS: { id: SeasonFilter; label: string }[] = [
  { id: 'now', label: 'Сейчас' }, { id: 1, label: 'Весна' }, { id: 2, label: 'Лето' },
  { id: 3, label: 'Осень' }, { id: 4, label: 'Зима' }, { id: 0, label: 'Весь год' },
];
type EdibleFilter = 'all' | 'edible' | 'danger';
const EDIBLE: { id: EdibleFilter; label: string }[] = [
  { id: 'all', label: 'Все грибы' }, { id: 'edible', label: 'Съедобные' }, { id: 'danger', label: 'Ядовитые' },
];
const SEASON_WHEN: Record<number, string> = { 1: 'весной', 2: 'летом', 3: 'осенью', 4: 'зимой' };
function speciesCount(n: number): string {
  const d = n % 10, h = n % 100;
  const word = d === 1 && h !== 11 ? 'вид' : d >= 2 && d <= 4 && (h < 12 || h > 14) ? 'вида' : 'видов';
  return `${n} ${word}`;
}
const MONTHS = ['январе', 'феврале', 'марте', 'апреле', 'мае', 'июне', 'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре'];

function edibleMatch(id: string, f: EdibleFilter): boolean {
  if (f === 'all') return true;
  const e = db.get(id)!.edibility;
  return f === 'danger' ? isDangerous(e) : e === 'edible' || e === 'conditionally_edible';
}

export default function MapScreen() {
  const { species } = useLocalSearchParams<{ species?: string }>();
  const speciesId = species && db.get(species) ? species : undefined;
  const [layer, setLayer] = useState<'ranges' | 'records'>('ranges');
  const [regionId, setRegionId] = useState<string | undefined>();
  const [area, setArea] = useState<MapArea>('all');
  const [season, setSeason] = useState<SeasonFilter>(speciesId ? 0 : 'now');
  const [edible, setEdible] = useState<EdibleFilter>('all');
  const [query, setQuery] = useState('');
  const [cluster, setCluster] = useState<MapCluster | null>(null);
  const [limit, setLimit] = useState(12);
  const [aboutOpen, setAboutOpen] = useState(false);
  const month = new Date().getMonth() + 1;
  const months = season === 'now' ? [month] : undefined;
  const seasonNum = season === 'now' ? 0 : season;
  const reset = () => { setCluster(null); setLimit(12); };
  const chooseSpecies = (id?: string) => { reset(); setQuery(''); if (id) setSeason(0); router.setParams({ species: id ?? '' }); };

  // Районы: вся выборка — для раскраски карты, выбранный регион — для списка.
  const areaEntries = useMemo(
    () => filterRangeEntries(ranges.entries, ranges.regions, { speciesId, area, season: seasonNum, months, speciesSeasons })
      .filter((e) => edibleMatch(e.speciesId, edible)),
    [speciesId, area, seasonNum, season, month, edible], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const counts = useMemo(() => regionSpeciesCounts(areaEntries), [areaEntries]);
  const maxCount = Math.max(0, ...Object.values(counts));
  const regionFill = speciesId ? undefined : Object.fromEntries(ranges.regions.map((r) => [r.id, densityColor(counts[r.id] ?? 0, maxCount)]));
  const highlighted = speciesId ? Object.keys(counts) : [];
  const shownEntries = regionId
    ? areaEntries.map((e) => ({ ...e, reports: e.reports.filter((r) => r.regionId === regionId) })).filter((e) => e.reports.length)
    : areaEntries;

  // Коллекционные находки.
  const filtered = useMemo(
    () => filterMapRecords(localRecords, { speciesId, area, season: seasonNum, months }).filter((r) => edibleMatch(r.speciesId, edible)),
    [speciesId, area, seasonNum, season, month, edible], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const shownRecords = (cluster ? filtered.filter((r) => cluster.records.some((c) => c.id === r.id)) : filtered)
    .sort((a, b) => b.date.localeCompare(a.date));

  const suggestions = query.trim() ? searchSpecies(db.all, { query }).filter((s) => mappedIds.has(s.id)).slice(0, 6) : [];
  const region = regionId ? ranges.regions.find((r) => r.id === regionId) : undefined;
  const placeName = region?.name ?? MAP_AREAS.find((a) => a.id === area)!.name;
  const seasonText = season === 'now' ? `растут в ${MONTHS[month - 1]}` : season ? `растут ${SEASON_WHEN[season]}` : 'встречаются здесь';
  const zoomOut = () => { setArea('all'); setRegionId(undefined); reset(); };

  return <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={styles.search}>
      <Icon name="search" size={24} />
      <TextInput value={query} onChangeText={setQuery} placeholder="Найти гриб на карте" placeholderTextColor={colors.muted} accessibilityLabel="Найти гриб на карте" style={styles.input} />
    </View>
    {suggestions.length ? <View style={styles.suggestions}>{suggestions.map((s) =>
      <Pressable key={s.id} accessibilityRole="button" onPress={() => chooseSpecies(s.id)} style={styles.suggestion}>
        <View style={[styles.dot, { backgroundColor: edibilityColors[s.edibility].fg }]} />
        <Text style={styles.suggestionText}>{s.nameRu}</Text><Text style={styles.small}>{s.latin}</Text>
      </Pressable>)}</View>
      : query.trim() ? <Text style={styles.small}>На карте нет сведений о таком грибе.</Text> : null}
    {speciesId ? <View style={styles.selected}>
      <View style={{ flex: 1 }}><Text style={styles.selectedLabel}>На карте</Text><Text style={styles.selectedName}>{db.get(speciesId)!.nameRu}</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Показать все грибы" onPress={() => chooseSpecies(undefined)} style={styles.clear}><Icon name="close" size={22} /></Pressable>
    </View> : null}

    <View style={styles.segment}>
      <Segment label="Где растёт" active={layer === 'ranges'} onPress={() => { setLayer('ranges'); reset(); }} />
      <Segment label="Находки учёных" active={layer === 'records'} onPress={() => { setLayer('records'); setRegionId(undefined); reset(); }} />
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {SEASONS.map((s) => <Choice key={s.id} label={s.label} active={season === s.id} onPress={() => { setSeason(s.id); reset(); }} />)}
    </ScrollView>
    {!speciesId ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {EDIBLE.map((e) => <Choice key={e.id} label={e.label} active={edible === e.id} onPress={() => { setEdible(e.id); reset(); }} />)}
    </ScrollView> : null}

    <RussiaMap
      records={layer === 'records' ? filtered : []}
      regions={layer === 'ranges' || area === 'kmv' || area === 'kcr' ? ranges.regions : []}
      highlighted={layer === 'ranges' ? highlighted : []}
      regionFill={layer === 'ranges' ? regionFill : undefined}
      selectedRegion={regionId}
      approximate={layer === 'ranges'}
      onRegionSelect={layer === 'ranges' ? (id) => { setRegionId(regionId === id ? undefined : id); reset(); } : undefined}
      focusRegion={region}
      area={area}
      selected={cluster?.id}
      onSelect={(value) => { setCluster(value); setLimit(12); }}
      onZoomOut={zoomOut}
    />
    {layer === 'ranges'
      ? <Legend species={!!speciesId} />
      : <Text style={styles.small}>Число на точке — сколько образцов хранится в научных коллекциях. Нажмите точку, чтобы увидеть записи.</Text>}
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {MAP_AREAS.map((a) => <Choice key={a.id} small label={a.name} active={area === a.id && !regionId} onPress={() => { setArea(a.id); setRegionId(undefined); reset(); }} />)}
    </ScrollView>
    {layer === 'ranges' ? <RegionPicker regions={ranges.regions} value={regionId} onChange={(id) => { setRegionId(id); setArea('all'); reset(); }} /> : null}

    {layer === 'ranges' ? <>
      <Summary title={placeName} subtitle={seasonText} entries={shownEntries} />
      {speciesId
        ? <RangeCards key={`${speciesId}:${area}:${regionId}:${season}`} entries={shownEntries} regions={ranges.regions} source={ranges.source} />
        : <SpeciesList entries={shownEntries} month={month} limit={limit} onMore={() => setLimit((v) => v + 12)} />}
      {area === 'kmv' ? <Card><Text style={styles.text}>Район КМВ: список видов взят по Ставропольскому краю целиком — точные местные находки этим не подтверждаются.</Text></Card> : null}
      {area === 'kcr' ? <Card><Text style={styles.text}>Карачаево-Черкесия: сезон в горах зависит от высоты и погоды; ищите подходящую среду из карточки вида.</Text></Card> : null}
    </> : <>
      <Text style={styles.title}>{cluster ? 'Находки в выбранной точке' : `Находки: ${placeName}`} · {shownRecords.length}</Text>
      {cluster ? <Button title="Снять выбор точки" variant="secondary" onPress={reset} /> : null}
      {shownRecords.length === 0 ? <Card><Text style={styles.text}>Подтверждённых образцов в этой выборке нет. Измените сезон, вид или часть России.</Text></Card> : null}
      {shownRecords.slice(0, limit).map((r) => {
        const s = db.get(r.speciesId)!;
        return <Card key={r.id} style={{ gap: 8 }}>
          <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/species/[id]', params: { id: s.id } })}><Text style={styles.recordTitle}>{s.nameRu} ›</Text></Pressable>
          <EdibilityBadge edibility={s.edibility} />
          <Text style={styles.text}>{r.locality}</Text>
          <Text style={styles.small}>{r.region} · {new Date(r.date).toLocaleDateString('ru-RU')}</Text>
          <Text style={styles.small}>Определил: {r.identifiedBy} · образец {r.catalogNumber}</Text>
          <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(`https://www.gbif.org/occurrence/${r.id}`)}><Text style={styles.link}>Исходная запись в GBIF</Text></Pressable>
        </Card>;
      })}
      {shownRecords.length > limit ? <Button title={`Ещё записи · ${shownRecords.length - limit}`} variant="secondary" onPress={() => setLimit((v) => v + 12)} /> : null}
    </>}

    <Card style={{ gap: 12 }}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: aboutOpen }} onPress={() => setAboutOpen((v) => !v)} style={styles.aboutHead}>
        <Icon name="shield" size={24} /><Text style={styles.aboutTitle}>О данных карты</Text><Text style={styles.small}>{aboutOpen ? 'Скрыть' : 'Подробнее'}</Text>
      </Pressable>
      {aboutOpen ? <>
        <Text style={styles.text}>«Где растёт» — регионы, где вид отмечен в научной литературе (Bolshakov et al., 2021, свод пластинчатых и болетовых грибов России). Это районы, а не точные места; отсутствие сведений не значит, что гриба там нет.</Text>
        <Text style={styles.text}>«Находки учёных» — образцы из научных коллекций с номером, датой, координатами и именем определившего. Выборка неполная.</Text>
        <Text style={styles.small}>Сезон берётся из карточки вида и меняется с погодой и высотой. Охраняемые виды на карте не показываются. Карта не даёт разрешения на сбор и не говорит о съедобности конкретного гриба. Границы: Natural Earth. Карта работает офлайн.</Text>
        <Button title="Открыть научный свод" icon="book" variant="secondary" onPress={() => void Linking.openURL(ranges.source.url)} />
        {snapshot.sources.map((s) => <Pressable key={s.id} accessibilityRole="link" onPress={() => void Linking.openURL(`https://www.gbif.org/dataset/${s.id}`)}>
          <Text style={styles.link}>{s.name} ({s.code}, {s.license})</Text>
        </Pressable>)}
      </> : null}
    </Card>
  </ScrollView>;
}

function Summary({ title, subtitle, entries }: { title: string; subtitle: string; entries: RangeEntry[] }) {
  const kinds = { edible: 0, cond: 0, danger: 0 };
  for (const e of entries) {
    const ed = db.get(e.speciesId)!.edibility;
    if (ed === 'edible') kinds.edible++;
    else if (ed === 'conditionally_edible') kinds.cond++;
    else if (isDangerous(ed)) kinds.danger++;
  }
  return <View style={styles.summary}>
    <Text style={styles.title}>{title}</Text>
    <Text style={styles.text}>{entries.length ? `${subtitle[0]!.toUpperCase()}${subtitle.slice(1)}: ${speciesCount(entries.length)}` : `Нет сведений о видах, которые ${subtitle}. Попробуйте другой сезон или регион.`}</Text>
    {entries.length ? <View style={styles.kinds}>
      <Kind n={kinds.edible} label="съедобных" color={edibilityColors.edible} />
      <Kind n={kinds.cond} label="условно съедобных" color={edibilityColors.conditionally_edible} />
      <Kind n={kinds.danger} label="ядовитых" color={edibilityColors.poisonous} />
    </View> : null}
  </View>;
}

function Kind({ n, label, color }: { n: number; label: string; color: { bg: string; fg: string } }) {
  return <View style={[styles.kind, { backgroundColor: color.bg }]}><Text style={[styles.kindText, { color: color.fg }]}>{n} {label}</Text></View>;
}

function SpeciesList({ entries, month, limit, onMore }: { entries: RangeEntry[]; month: number; limit: number; onMore: () => void }) {
  // Сначала то, что растёт сейчас, затем по алфавиту.
  const list: Species[] = entries.map((e) => db.get(e.speciesId)!).sort((a, b) =>
    Number(isInSeason(b.season, month)) - Number(isInSeason(a.season, month)) || a.nameRu.localeCompare(b.nameRu, 'ru'));
  return <>
    <View style={styles.list}>{list.slice(0, limit).map((s) => {
      const now = isInSeason(s.season, month);
      return <SpeciesRow key={s.id} species={s} right={<Text style={[styles.small, now && styles.now]}>{now ? 'Сейчас сезон' : formatSeason(s.season)}</Text>} />;
    })}</View>
    {list.length > limit ? <Button title={`Ещё виды · ${list.length - limit}`} variant="secondary" onPress={onMore} /> : null}
  </>;
}

function Legend({ species }: { species: boolean }) {
  if (species) {
    return <View style={styles.legend}>
      <View style={[styles.swatch, { backgroundColor: '#D8AC72' }]} />
      <Text style={styles.small}>Регион, где вид отмечен в научной литературе. Нажмите регион, чтобы увидеть подробности.</Text>
    </View>;
  }
  return <View style={{ gap: 6 }}>
    <View style={styles.legend}>
      <Text style={styles.small}>Мало видов</Text>
      {DENSITY_COLORS.slice(1).map((c) => <View key={c} style={[styles.swatch, { backgroundColor: c }]} />)}
      <Text style={styles.small}>Много</Text>
    </View>
    <Text style={styles.small}>Нажмите на регион — ниже появится список грибов.</Text>
  </View>;
}

function Segment({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.segmentItem, active && styles.segmentActive]}>
    <Text style={[styles.segmentText, active && { color: '#fff' }]}>{label}</Text>
  </Pressable>;
}

function Choice({ label, active, onPress, small }: { label: string; active: boolean; onPress: () => void; small?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.chip, small && styles.chipSmall, active && styles.active]}>
    <Text style={[styles.chipText, small && { fontSize: 16 }, active && { color: '#fff' }]}>{label}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32, gap: 14 },
  title: { fontSize: 24, lineHeight: 31, fontWeight: '700', color: colors.text },
  text: { fontSize: 18, lineHeight: 27, color: colors.text },
  small: { fontSize: 15, lineHeight: 22, color: colors.muted },
  link: { fontSize: 16, lineHeight: 24, color: colors.primary, textDecorationLine: 'underline' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.border },
  input: { flex: 1, minWidth: 0, minHeight: 56, fontSize: 18, color: colors.text },
  suggestions: { backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  suggestion: { minHeight: 56, paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderColor: colors.border },
  suggestionText: { fontSize: 18, fontWeight: '600', color: colors.text },
  dot: { width: 12, height: 12, borderRadius: 6 },
  selected: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, backgroundColor: colors.sage },
  selectedLabel: { fontSize: 14, color: colors.muted },
  selectedName: { fontSize: 21, fontWeight: '700', color: colors.text },
  clear: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  segment: { flexDirection: 'row', backgroundColor: colors.chip, borderRadius: 16, padding: 4, gap: 4 },
  segmentItem: { flex: 1, minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  segmentActive: { backgroundColor: colors.primary },
  segmentText: { fontSize: 17, fontWeight: '600', color: colors.text, textAlign: 'center' },
  row: { gap: 8, paddingRight: 8 },
  chip: { minHeight: 48, paddingHorizontal: 16, justifyContent: 'center', borderRadius: 16, backgroundColor: colors.chip },
  chipSmall: { minHeight: 44, paddingHorizontal: 12 },
  active: { backgroundColor: colors.primary },
  chipText: { fontSize: 17, fontWeight: '600', color: colors.text },
  legend: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  swatch: { width: 26, height: 16, borderRadius: 4, borderWidth: 1, borderColor: '#8A9C7E' },
  summary: { gap: 8 },
  kinds: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kind: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  kindText: { fontSize: 15, fontWeight: '700' },
  list: { borderRadius: 20, overflow: 'hidden' },
  now: { color: edibilityColors.edible.fg, fontWeight: '700' },
  recordTitle: { fontSize: 21, lineHeight: 28, fontWeight: '700', color: colors.primary },
  aboutHead: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  aboutTitle: { flex: 1, fontSize: 19, fontWeight: '700', color: colors.text },
});
