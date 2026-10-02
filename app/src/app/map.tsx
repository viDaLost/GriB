import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { db } from '../data/db';
import rangesJson from '../data/map-ranges.json';
import { RangeCards, RegionPicker } from '../ui/MapRanges';
import snapshotJson from '../data/map-records.json';
import { filterMapRecords, filterRangeEntries, hasCollectionEvidence, MAP_AREAS, type MapArea, type MapCluster, type MapSnapshot, type RangeSnapshot } from '../data/mushroomMap';
import { Button, Card, EdibilityBadge } from '../ui/components';
import { Icon } from '../ui/Icon';
import { RussiaMap } from '../ui/RussiaMap';
import { colors } from '../ui/theme';

const ranges = rangesJson as RangeSnapshot;
const speciesSeasons = Object.fromEntries(db.all.map((s) => [s.id, s.season]));
const snapshot = snapshotJson as MapSnapshot;
const sourceIds = new Set(snapshot.sources.map((s) => s.id));
const records = snapshot.records.filter((r) => hasCollectionEvidence(r, sourceIds) && db.get(r.speciesId) && !db.get(r.speciesId)!.protected);
const speciesNames = Object.fromEntries(db.all.map((s) => [s.id, `${s.nameRu} ${s.latin}`]));
const seasons = ['Все сезоны', 'Весна', 'Лето', 'Осень', 'Зима'];
const regionNames: Record<string, string> = {
  'Khanty-Mansiyskiy Avtonomnyy Okrug': 'Ханты-Мансийский автономный округ — Югра',
  'Novgorod': 'Новгородская область', 'Primorskiy Kray': 'Приморский край',
  "Tomskaya Oblast'": 'Томская область', "Sverdlovskaya Oblast'": 'Свердловская область',
  "Irkutskaya Oblast'": 'Иркутская область', 'Respublika Altay': 'Республика Алтай',
  "Moskovskaya Oblast'": 'Московская область', 'Respublika Buryatiya': 'Республика Бурятия',
  'Yamalo-Nenetskiy Avtonomnyy Okrug': 'Ямало-Ненецкий автономный округ',
  "Novosibirskaya Oblast'": 'Новосибирская область',
};
const searchRecords = records.map((r) => ({ ...r, region: regionNames[r.region] ?? r.region }));

export default function MapScreen() {
  const { species } = useLocalSearchParams<{ species?: string }>();
  const speciesId = species && db.get(species) ? species : undefined;
  const [layer, setLayer] = useState<'ranges' | 'records'>('ranges');
  const [regionId, setRegionId] = useState<string | undefined>();
  const [area, setArea] = useState<MapArea>('all');
  const [season, setSeason] = useState(0);
  const [query, setQuery] = useState('');
  const [cluster, setCluster] = useState<MapCluster | null>(null);
  const [limit, setLimit] = useState(12);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const filtered = useMemo(() => filterMapRecords(searchRecords, { speciesId, area, season, query, speciesNames }), [speciesId, area, season, query]);
  const rangeEntries = useMemo(() => filterRangeEntries(ranges.entries, ranges.regions, { speciesId, area, regionId, season, query, speciesNames, speciesSeasons }), [speciesId, area, regionId, season, query]);
  const highlighted = [...new Set(rangeEntries.flatMap((e) => e.reports.map((r) => r.regionId)))];
  const shown = cluster ? filtered.filter((r) => cluster.records.some((c) => c.id === r.id)) : filtered;
  const sorted = [...shown].sort((a, b) => b.date.localeCompare(a.date));
  const reset = () => { setCluster(null); setLimit(12); };
  return <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={styles.intro}>
      <Icon name="map" size={38} />
      <Text style={styles.title}>Грибы на карте России</Text>
      <Text style={styles.text}>Выберите гриб и посмотрите, в каких регионах его встречали и в какой среде он растёт.</Text>
      <Text style={styles.count}>{ranges.entries.length} видов с региональными сведениями · {records.length} коллекционных находок</Text>
      <Text style={styles.small}>Два слоя: примерные районы по научной литературе и отдельные находки из коллекций.</Text>
    </View>
    {speciesId ? <Card><Text style={styles.recordTitle}>{db.get(speciesId)!.nameRu}</Text><Button title="Показать все виды" variant="secondary" onPress={() => { reset(); router.setParams({ species: '' }); }} /></Card> : null}
    <View style={styles.search}><Icon name="search" size={26} /><TextInput value={query} onChangeText={(value) => { setQuery(value); reset(); }} placeholder="Гриб, регион или местность" placeholderTextColor={colors.muted} accessibilityLabel="Поиск на карте" style={styles.input} /></View>
    <View style={styles.chips}><Choice label="Примерные районы" active={layer === 'ranges'} onPress={() => { setLayer('ranges'); reset(); }} /><Choice label="Коллекционные находки" active={layer === 'records'} onPress={() => { setLayer('records'); setRegionId(undefined); reset(); }} /></View>
    <Text style={styles.label}>Часть России</Text>
    <View style={styles.chips}>{MAP_AREAS.map((a) => <Choice key={a.id} label={a.name} active={area === a.id} onPress={() => { setArea(a.id); setRegionId(undefined); reset(); }} />)}</View>
    {layer === 'ranges' ? <RegionPicker regions={ranges.regions} value={regionId} onChange={(id) => { setRegionId(id); setArea('all'); reset(); }} /> : null}
    <RussiaMap records={layer === 'records' ? filtered : []} regions={layer === 'ranges' || area === 'kmv' || area === 'kcr' ? ranges.regions : []} highlighted={layer === 'ranges' ? highlighted : []} approximate={layer === 'ranges'} onRegionSelect={layer === 'ranges' ? (id) => { setRegionId(id); setArea('all'); reset(); } : undefined} focusRegion={regionId ? ranges.regions.find((r) => r.id === regionId) : undefined} area={area} selected={cluster?.id} onSelect={(value) => { setCluster(value); setLimit(12); }} />
    <Text style={styles.small}>{layer === 'ranges' ? 'Подсвечены регионы с сообщениями о выбранных грибах в научной литературе. Это примерные районы, а не точные места сбора. Нажмите регион или выберите его кнопкой. Выберите вид поиском или откройте карту из его карточки.' : 'Число на точке — количество коллекционных записей. Нажмите, чтобы увидеть находки.'} Карта работает офлайн.</Text>
    {area === 'kmv' ? <Card><Text style={styles.recordTitle}>Кавказские Минеральные Воды</Text><Text style={styles.text}>На карте приближен район КМВ. Список видов основан на сведениях по Ставропольскому краю целиком: точные местные находки этим не подтверждаются. Для рыжиков в КМВ данных в выбранном своде нет.</Text></Card> : null}
    {area === 'kcr' ? <Text style={styles.small}>Карачаево-Черкесия: региональные сообщения не определяют точное место. Ищите подходящую среду из карточки вида; сезон в горах зависит от высоты и погоды.</Text> : null}
    <Text style={styles.label}>{layer === 'ranges' ? 'Примерный сезон гриба' : 'Время года находки'}</Text>
    <View style={styles.chips}>{seasons.map((label, i) => <Choice key={label} label={label} active={season === i} onPress={() => { setSeason(i); reset(); }} />)}</View>
    <Text style={styles.small}>{layer === 'ranges' ? 'Сезон взят из атласа: это общий ориентир, который меняется с погодой и высотой. Границы региона не означают сплошной ареал; наличие вида и съедобность по карте не определяются.' : 'Фильтр использует дату исторической находки, а не прогноз урожая.'}</Text>
    {layer === 'ranges' ? <RangeCards key={`${speciesId}:${area}:${regionId}:${season}:${query}`} entries={[...rangeEntries].sort((a, b) => db.get(a.speciesId)!.nameRu.localeCompare(db.get(b.speciesId)!.nameRu, 'ru'))} regions={ranges.regions} source={ranges.source} /> : null}
    {layer === 'records' ? <>
    <Text style={styles.label}>{cluster ? 'Находки в выбранной группе' : 'Найденные записи'} · {shown.length}</Text>
    {cluster ? <Button title="Снять выбор точки" variant="secondary" onPress={reset} /> : null}
    <Card style={{ gap: 12 }}><Text style={styles.label}>Что проверено</Text><Text style={styles.text}>Источник — научная коллекция; указан номер образца, определитель, дата и координаты. Записи с известными ошибками координат и неточным совпадением вида исключены.</Text><Text style={styles.small}>Определение взято из коллекции и не перепроверялось нами в поле. Покрытие России пока неполное: отсутствие точки не означает, что гриб здесь не растёт. В заповедниках сбор может быть запрещён.</Text>
      <Button title={sourcesOpen ? 'Скрыть источники' : 'Источники и проверка'} icon="shield" variant="secondary" onPress={() => setSourcesOpen((v) => !v)} />
      {sourcesOpen ? <><Text style={styles.small}>Снимок данных: {new Date(snapshot.updatedAt).toLocaleDateString('ru-RU')}. Защищённые виды из справочника не публикуются на карте.</Text>{snapshot.sources.map((s) => <View key={s.id} style={styles.source}><Text style={styles.recordTitle}>{s.name}</Text><Text style={styles.small}>{s.code} · {s.license}</Text><Button title="Открыть коллекцию" variant="secondary" onPress={() => void Linking.openURL(`https://www.gbif.org/dataset/${s.id}`)} /></View>)}<Text style={styles.small}>Контур и границы карты: Natural Earth, public domain. Отображение схематичное.</Text></> : null}
    </Card>
    {sorted.length === 0 ? <Card><Text style={styles.recordTitle}>Подтверждённых коллекционных записей в этой выборке нет</Text><Text style={styles.text}>Измените вид, сезон или часть России. Непроверенные точки здесь не добавляются.</Text></Card> : null}
    {sorted.slice(0, limit).map((r) => {
      const s = db.get(r.speciesId)!; const source = snapshot.sources.find((v) => v.id === r.datasetId)!;
      return <Card key={r.id} style={{ gap: 12 }}><Text style={styles.recordTitle}>{s.nameRu}</Text><EdibilityBadge edibility={s.edibility} /><Text style={styles.text}>{r.locality}</Text><Text style={styles.small}>{r.region}</Text><Text style={styles.text}>Найден: {new Date(r.date).toLocaleDateString('ru-RU')}</Text><Text style={styles.small}>Коллекция: {source.code} · образец {r.catalogNumber}{'\n'}Определил: {r.identifiedBy}</Text><Text style={styles.small}>Координаты: {r.latitude.toFixed(4)}, {r.longitude.toFixed(4)}{'\n'}{r.uncertaintyMeters === null ? 'Точность координат источником не указана.' : `Погрешность по источнику: до ${r.uncertaintyMeters} м.`}</Text><Button title="Проверить исходную запись" icon="shield" variant="secondary" onPress={() => void Linking.openURL(`https://www.gbif.org/occurrence/${r.id}`)} /><Button title="Открыть карточку гриба" icon="book" onPress={() => router.push({ pathname: '/species/[id]', params: { id: s.id } })} /></Card>;
    })}
    {sorted.length > limit ? <Button title={`Ещё записи · ${sorted.length - limit}`} variant="secondary" onPress={() => setLimit((v) => v + 12)} /> : null}
    </> : <Card style={{ gap: 12 }}><Text style={styles.label}>Источник районов</Text><Text style={styles.small}>Bolshakov et al., 2021. Свод опубликованных сведений о пластинчатых и болетовых грибах России; приложение A. Использованы точные названия видов, сохранены регионы, страницы и ссылки на исходные исследования. Определения из литературы нами не перепроверялись. Покрытие неполное.</Text><Button title="Открыть публикацию" icon="shield" variant="secondary" onPress={() => void Linking.openURL(ranges.source.url)} /><Text style={styles.small}>Границы: Natural Earth, public domain. Региональные сообщения не превращаются в точки. Охраняемые виды из атласа исключены; карта не даёт разрешения на сбор.</Text></Card>}
  </ScrollView>;
}
function Choice({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.chip, active && styles.active]}><Text style={[styles.chipText, active && { color: '#fff' }]}>{label}</Text></Pressable>;
}
const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32, gap: 16 },
  intro: { padding: 20, borderRadius: 28, backgroundColor: colors.sage, gap: 12 },
  title: { fontSize: 31, lineHeight: 39, fontWeight: '700', color: colors.text },
  text: { fontSize: 20, lineHeight: 30, color: colors.text },
  small: { fontSize: 17, lineHeight: 26, color: colors.muted },
  count: { fontSize: 19, lineHeight: 28, fontWeight: '700', color: colors.primary },
  label: { fontSize: 23, lineHeight: 31, fontWeight: '700', color: colors.text },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: colors.border },
  input: { flex: 1, minWidth: 0, minHeight: 66, paddingVertical: 16, fontSize: 19, color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { maxWidth: '100%', minHeight: 56, padding: 14, justifyContent: 'center', borderRadius: 18, backgroundColor: colors.chip },
  active: { backgroundColor: colors.primary }, chipText: { fontSize: 18, lineHeight: 26, color: colors.text, fontWeight: '600' },
  recordTitle: { fontSize: 24, lineHeight: 32, fontWeight: '700', color: colors.text },
  source: { gap: 10, paddingTop: 16, borderTopWidth: 1, borderColor: colors.border },
});
