import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { db } from '../data/db';
import { searchSpecies, type SpeciesFilter } from '../data/search';
import type { Edibility, Hymenophore } from '../data/types';
import { SpeciesRow } from '../ui/components';
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
      ListHeaderComponent={
        <View style={styles.header}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Название: подберёзовик, рыжик, Boletus…"
            placeholderTextColor={colors.muted}
            style={styles.search}
            clearButtonMode="while-editing"
            autoCorrect={false}
          />
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
  header: { padding: spacing.l, gap: spacing.m },
  search: {
    backgroundColor: colors.card,
    borderRadius: radius.m,
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m,
    fontSize: 16,
    color: colors.text,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s },
  chip: {
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
