import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { db } from '../data/db';
import type { MapRegion, RangeEntry, RangeSnapshot } from '../data/mushroomMap';
import { formatSeason, formatSeasonPart } from '../data/season';
import { Button, Card, EdibilityBadge } from './components';
import { fonts, colors } from './theme';

export function RegionPicker({ regions, value, onChange }: { regions: MapRegion[]; value?: string; onChange: (id?: string) => void }) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const shown = [...regions].filter((r) => r.name.toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru'))).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  return <><Button title={value ? regions.find((r) => r.id === value)!.name : 'Выбрать регион'} icon="map" variant="secondary" onPress={() => setOpen(true)} />
    <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
      <View style={styles.overlay}><View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 24) }]} accessibilityViewIsModal><Text style={styles.title}>Регион России</Text>
        <TextInput value={query} onChangeText={setQuery} accessibilityLabel="Поиск региона" placeholder="Название региона" placeholderTextColor={colors.muted} style={styles.input} />
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 10, paddingBottom: 16 }}>
          <Button title="Все регионы" variant="secondary" onPress={() => { onChange(undefined); setOpen(false); }} />
          {shown.map((r) => <Pressable key={r.id} accessibilityRole="button" accessibilityState={{ selected: value === r.id }} onPress={() => { onChange(r.id); setOpen(false); }} style={styles.region}><Text style={styles.text}>{r.name}</Text></Pressable>)}
          {!shown.length ? <Text style={styles.text}>Регион не найден</Text> : null}
        </ScrollView><Button title="Закрыть выбор региона" onPress={() => setOpen(false)} />
      </View></View>
    </Modal></>;
}
export function RangeCards({ entries, regions, source }: { entries: RangeEntry[]; regions: MapRegion[]; source: RangeSnapshot['source'] }) {
  const [limit, setLimit] = useState(12);
  const [expanded, setExpanded] = useState<string | null>(null);
  return <><Text style={styles.title}>Виды в выбранных районах · {entries.length}</Text>
    {!entries.length ? <Card><Text style={styles.title}>В этом своде данных для выборки нет</Text><Text style={styles.text}>Отсутствие сведений не означает, что гриб здесь не растёт. Попробуйте другой вид или регион.</Text></Card> : null}
    {entries.slice(0, limit).map((e) => {
      const s = db.get(e.speciesId)!;
      const reports = [...e.reports].sort((a, b) => regions.find((r) => r.id === a.regionId)!.name.localeCompare(regions.find((r) => r.id === b.regionId)!.name, 'ru'));
      return <Card key={e.speciesId} style={{ gap: 12 }}><Text style={styles.title}>{s.nameRu}</Text><EdibilityBadge edibility={s.edibility} />
        <Text style={styles.text}>Когда: {formatSeason(s.season)} · {formatSeasonPart(s.season)}</Text><Text style={styles.text}>Среда: {s.habitat}</Text>
        <Text style={styles.small}>Регионы по литературным данным: {reports.slice(0, 4).map((r) => regions.find((v) => v.id === r.regionId)!.name).join(' · ')}{reports.length > 4 ? ` · ещё ${reports.length - 4} (в подтверждении)` : ''}</Text>
        <Button title="Открыть карточку гриба" icon="book" onPress={() => router.push({ pathname: '/species/[id]', params: { id: s.id } })} />
        <Button title={expanded === e.speciesId ? 'Скрыть подтверждение' : 'Проверить региональные сведения'} icon="shield" variant="secondary" onPress={() => setExpanded(expanded === e.speciesId ? null : e.speciesId)} />
        {expanded === e.speciesId ? <><Text style={styles.small}>Свод Bolshakov et al., 2021, приложение A, страница {e.page} PDF. В нём сохранены ссылки на региональные публикации.</Text>
          {reports.map((r) => <Text key={r.regionId} style={styles.small}>{regions.find((v) => v.id === r.regionId)!.name}: {r.references}</Text>)}
          <Button title="Открыть научный источник" variant="secondary" onPress={() => void Linking.openURL(`${source.supplement}#page=${e.page}`)} /></> : null}
      </Card>;
    })}
    {entries.length > limit ? <Button title={`Ещё виды · ${entries.length - limit}`} variant="secondary" onPress={() => setLimit((v) => v + 12)} /> : null}
  </>;
}
const styles = StyleSheet.create({
  title: { fontSize: 24, fontFamily: fonts.display, lineHeight: 32, color: colors.text }, text: { fontSize: 20, fontFamily: fonts.body, lineHeight: 30, color: colors.text }, small: { fontSize: 17, fontFamily: fonts.body, lineHeight: 26, color: colors.muted },
  overlay: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: 'rgba(25,40,32,0.45)' }, sheet: { width: '100%', maxWidth: 760, maxHeight: '88%', padding: 20, paddingBottom: 32, gap: 16, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: colors.bg },
  input: { minHeight: 66, padding: 16, fontSize: 20, fontFamily: fonts.body, borderRadius: 18, backgroundColor: colors.card, color: colors.text }, region: { minHeight: 64, padding: 16, borderRadius: 18, backgroundColor: colors.chip },
});
