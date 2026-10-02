import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { db } from '../data/db';
import { searchSpecies, type SpeciesFilter } from '../data/search';
import type { Edibility, Hymenophore } from '../data/types';
import { Button, SpeciesRow } from '../ui/components';
import { router } from 'expo-router';
import { Icon } from '../ui/Icon';
import { colors, radius, spacing } from '../ui/theme';
import { MODEL_META } from '../ml/modelAsset';
import { trainedSpeciesCount } from '../ml/modelCoverage';

const EDIBILITY_FILTERS: { label: string; value: Edibility[] }[] = [
  { label: 'Все', value: [] },
  { label: 'Съедобные', value: ['edible', 'conditionally_edible'] },
  { label: 'Ядовитые', value: ['poisonous', 'deadly'] },
  { label: 'Несъедобные', value: ['inedible'] },
];

const HYMENOPHORE_FILTERS: { label: string; value?: Hymenophore }[] = [
  { label: 'Любые' },
  { label: 'Трубчатые', value: 'tubes' },
  { label: 'Пластинчатые', value: 'gills' },
  { label: 'Другие', value: 'other' },
];

export default function Catalog() {
  const [query, setQuery] = useState('');
  const [edibility, setEdibility] = useState(0);
  const [hymenophore, setHymenophore] = useState(0);

  const list = useMemo(() => {
    const filter: SpeciesFilter = {
      query,
      edibility: EDIBILITY_FILTERS[edibility]?.value,
      hymenophore: HYMENOPHORE_FILTERS[hymenophore]?.value,
    };
    return searchSpecies(db.all, filter);
  }, [query, edibility, hymenophore]);

  return (
    <FlatList
      data={list}
      keyExtractor={(s) => s.id}
      renderItem={({ item }) => <SpeciesRow species={item} expanded />}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.content}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.title}>Знакомьтесь с лесом</Text>
          <Text style={styles.subtitle}>Признаки, фотографии и виды, с которыми легко ошибиться.</Text>
          <Text style={styles.subtitle}>{db.all.length} видов в атласе · {trainedSpeciesCount(db.all.map(s => s.id), MODEL_META)} входят в текущую модель распознавания.</Text>
          <Button title="Грибы на карте России" icon="map" variant="secondary" onPress={() => router.push('/map')} />
          <Text style={styles.subtitle}>Сезоны примерные: на юге, севере и в горах сроки зависят от погоды.</Text>
          <View style={styles.searchWrap}><Icon name="search" size={21} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Название гриба"
            placeholderTextColor={colors.muted}
            style={styles.search}
            clearButtonMode="while-editing"
            autoCorrect={false}
            accessibilityLabel="Поиск гриба по названию"
          />
          </View>
          <Chips items={EDIBILITY_FILTERS} selected={edibility} onSelect={setEdibility} />
          <Chips items={HYMENOPHORE_FILTERS} selected={hymenophore} onSelect={setHymenophore} />
          <Text style={styles.count}>Найдено: {list.length}</Text>
        </View>
      }
      ListEmptyComponent={<Text style={styles.empty}>Ничего не найдено</Text>}
    />
  );
}

function Chips({
  items,
  selected,
  onSelect,
}: {
  items: { label: string }[];
  selected: number;
  onSelect: (i: number) => void;
}) {
  return (
    <View style={styles.chips}>
      {items.map((it, i) => (
        <Pressable
          key={it.label}
          accessibilityRole="button"
          accessibilityState={{ selected: i === selected }}
          onPress={() => onSelect(i)}
          style={[styles.chip, i === selected && styles.chipActive]}
        >
          <Text style={[styles.chipText, i === selected && styles.chipTextActive]}>{it.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.l },
  title: { fontSize: 29, fontWeight: '700', color: colors.text, letterSpacing: -0.7 },
  subtitle: { fontSize: 17, lineHeight: 25, color: colors.muted },
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.m, paddingLeft: 14, borderWidth: 1, borderColor: colors.border },
  header: { padding: spacing.l, gap: spacing.m },
  search: {
    flex: 1,
    minWidth: 0,
    minHeight: 60,
    backgroundColor: colors.card,
    borderRadius: radius.m,
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m,
    fontSize: 19,
    color: colors.text,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s },
  chip: {
    minHeight: 52,
    maxWidth: '100%',
    justifyContent: 'center',
    paddingHorizontal: spacing.m,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.chip,
  },
  chipActive: { backgroundColor: colors.primary },
  chipText: { fontSize: 17, color: colors.text },
  chipTextActive: { color: colors.primaryText, fontWeight: '600' },
  count: { fontSize: 15, color: colors.muted },
  empty: { textAlign: 'center', color: colors.muted, padding: spacing.xl },
});
