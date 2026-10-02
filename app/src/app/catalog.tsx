import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { db } from '../data/db';
import { searchSpecies, type SpeciesFilter } from '../data/search';
import type { Edibility, Hymenophore } from '../data/types';
import { SpeciesRow } from '../ui/components';
import { Icon } from '../ui/Icon';
import { colors, radius, spacing } from '../ui/theme';

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
      renderItem={({ item }) => <SpeciesRow species={item} />}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.content}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.title}>Знакомьтесь с лесом</Text>
          <Text style={styles.subtitle}>Признаки, фотографии и виды, с которыми легко ошибиться.</Text>
          <View style={styles.searchWrap}><Icon name="search" size={21} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Название: подберёзовик, рыжик, Boletus…"
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
  title: { fontSize: 25, fontWeight: '700', color: colors.text, letterSpacing: -0.7 },
  subtitle: { fontSize: 14, lineHeight: 20, color: colors.muted },
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.m, paddingLeft: 14, borderWidth: 1, borderColor: colors.border },
  header: { padding: spacing.l, gap: spacing.m },
  search: {
    flex: 1,
    minWidth: 0,
    minHeight: 52,
    backgroundColor: colors.card,
    borderRadius: radius.m,
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m,
    fontSize: 16,
    color: colors.text,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.m,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.chip,
  },
  chipActive: { backgroundColor: colors.primary },
  chipText: { fontSize: 14, color: colors.text },
  chipTextActive: { color: colors.primaryText, fontWeight: '600' },
  count: { fontSize: 13, color: colors.muted },
  empty: { textAlign: 'center', color: colors.muted, padding: spacing.xl },
});
