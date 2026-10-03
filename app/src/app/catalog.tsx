import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { db } from '../data/db';
import { searchSpecies, type SpeciesFilter } from '../data/search';
import type { Edibility, Hymenophore } from '../data/types';
import { formatSeason } from '../data/season';
import { SpeciesRow } from '../ui/components';
import { Icon } from '../ui/Icon';
import { fonts, colors, radius, spacing } from '../ui/theme';
import { MODEL_META } from '../ml/modelAsset';
import { trainedSpeciesCount } from '../ml/modelCoverage';

const EDIBILITY_FILTERS: { label: string; value: Edibility[] }[] = [
  { label: 'Все грибы', value: [] },
  { label: 'Съедобные', value: ['edible', 'conditionally_edible'] },
  { label: 'Ядовитые', value: ['poisonous', 'deadly'] },
  { label: 'Несъедобные', value: ['inedible'] },
];

const HYMENOPHORE_FILTERS: { label: string; value?: Hymenophore }[] = [
  { label: 'Любой низ шляпки' },
  { label: 'Трубчатые', value: 'tubes' },
  { label: 'Пластинчатые', value: 'gills' },
  { label: 'Другие формы', value: 'other' },
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
      renderItem={({ item }) => <SpeciesRow species={item} right={<Text style={styles.season}>{formatSeason(item.season)}</Text>} />}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.content}
      ListHeaderComponent={
        <View style={styles.header}>
          <View style={styles.searchWrap}>
            <Icon name="search" size={22} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Название гриба, в том числе народное"
              placeholderTextColor={colors.muted}
              style={styles.search}
              clearButtonMode="while-editing"
              autoCorrect={false}
              accessibilityLabel="Поиск гриба по названию"
            />
          </View>
          <Chips items={EDIBILITY_FILTERS} selected={edibility} onSelect={setEdibility} />
          <Chips items={HYMENOPHORE_FILTERS} selected={hymenophore} onSelect={setHymenophore} />
          <Text style={styles.count}>
            {list.length === db.all.length ? `${db.all.length} видов в атласе` : `Найдено видов: ${list.length}`}. По фото узнаются {trainedSpeciesCount(db.all.map((s) => s.id), MODEL_META)}.
          </Text>
        </View>
      }
      ListFooterComponent={<Text style={styles.footer}>Сроки сезона примерные: на юге, севере и в горах они сдвигаются вместе с погодой.</Text>}
      ListEmptyComponent={<Text style={styles.empty}>Такого гриба в атласе нет. Проверьте название или снимите фильтры.</Text>}
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
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.l },
  header: { paddingTop: spacing.l, paddingBottom: spacing.m, gap: spacing.m, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  searchWrap: { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.l, backgroundColor: colors.card, borderRadius: radius.m, paddingLeft: 14, borderWidth: 1, borderColor: colors.border },
  search: { flex: 1, minWidth: 0, minHeight: 58, paddingHorizontal: spacing.m, fontSize: 18, fontFamily: fonts.body, color: colors.text },
  chips: { flexDirection: 'row', gap: spacing.s, paddingHorizontal: spacing.l },
  chip: { minHeight: 46, justifyContent: 'center', paddingHorizontal: spacing.m, borderRadius: radius.s, backgroundColor: colors.chip },
  chipActive: { backgroundColor: colors.primary },
  chipText: { fontSize: 17, fontFamily: fonts.medium, color: colors.text },
  chipTextActive: { color: colors.primaryText, fontFamily: fonts.semibold },
  count: { fontSize: 15, lineHeight: 22, fontFamily: fonts.body, color: colors.muted, paddingHorizontal: spacing.l },
  season: { fontSize: 15, lineHeight: 21, fontFamily: fonts.body, color: colors.muted },
  footer: { fontSize: 15, lineHeight: 22, fontFamily: fonts.body, color: colors.muted, padding: spacing.l },
  empty: { fontSize: 17, lineHeight: 25, fontFamily: fonts.body, color: colors.muted, padding: spacing.xl },
});
