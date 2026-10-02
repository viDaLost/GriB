import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Candidate } from '../ml/decision';
import { getScanResult } from '../state/scanResult';
import { Button, Card, EdibilityBadge, SectionTitle, SpeciesRow } from '../ui/components';
import { alertColors, colors, radius, spacing } from '../ui/theme';

function percent(p: number): string {
  return p >= 0.995 ? '>99%' : p < 0.01 ? '<1%' : `${Math.round(p * 100)}%`;
}

export default function ResultScreen() {
  const result = getScanResult();
  if (!result) {
    return (
      <View style={styles.container}>
        <Text style={styles.advice}>Нет результата. Сделайте снимок ещё раз.</Text>
        <Button title="К камере" onPress={() => router.replace('/scan')} />
      </View>
    );
  }

  const { identification: id, photoUri } = result;
  const alert = alertColors[id.alertLevel];
  const top = id.candidates[0];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Image source={{ uri: photoUri }} style={styles.photo} contentFit="cover" />

      <View style={[styles.alert, { backgroundColor: alert.bg, borderColor: alert.border }]}>
        <Text style={[styles.headline, { color: alert.fg }]}>{id.headline}</Text>
        <Text style={[styles.advice, { color: alert.fg }]}>{id.advice}</Text>
      </View>

      {top && id.verdict !== 'unknown' ? (
        <Card>
          <Text style={styles.topName}>{top.species.nameRu}</Text>
          <Text style={styles.latin}>{top.species.latin}</Text>
          <View style={{ marginTop: spacing.s }}>
            <EdibilityBadge edibility={top.species.edibility} large />
          </View>
          {top.species.edibilityNote ? (
            <Text style={styles.note}>{top.species.edibilityNote}</Text>
          ) : null}
        </Card>
      ) : null}

      {id.dangerousCandidates.length > 0 ? (
        <>
          <SectionTitle>Опасные варианты</SectionTitle>
          <CandidateList list={id.dangerousCandidates} raw />
        </>
      ) : null}

      {id.candidates.length > 0 ? (
        <>
          <SectionTitle>
            {id.verdict === 'unknown' ? 'Отдалённо похоже на' : 'Варианты по фото'}
          </SectionTitle>
          <CandidateList list={id.candidates} />
        </>
      ) : null}

      {id.dangerousLookalikes.length > 0 && top ? (
        <>
          <SectionTitle>С чем можно спутать</SectionTitle>
          <View style={styles.list}>
            {id.dangerousLookalikes.map((s) => (
              <SpeciesRow key={s.id} species={s} />
            ))}
          </View>
          <Text style={styles.hint}>
            Откройте карточку вида — там описано, как отличить «{top.species.nameRu}» от двойника.
          </Text>
        </>
      ) : null}

      <View style={styles.actions}>
        <Button title="Сфотографировать ещё" onPress={() => router.back()} />
        <Button title="Уточнить по признакам" variant="secondary" onPress={() => router.push('/key')} />
        <Button title="Безопасность и первая помощь" variant="secondary" onPress={() => router.push('/safety')} />
      </View>
    </ScrollView>
  );
}

function CandidateList({ list, raw }: { list: Candidate[]; raw?: boolean }) {
  return (
    <View style={styles.list}>
      {list.map((c) => (
        <SpeciesRow
          key={c.species.id}
          species={c.species}
          right={
            <View style={styles.right}>
              <Text style={styles.percent}>{percent(raw ? c.rawProbability : c.probability)}</Text>
              {c.inSeason === false ? <Text style={styles.season}>не сезон</Text> : null}
            </View>
          }
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.l, gap: spacing.m, paddingBottom: spacing.xl * 2 },
  photo: { width: '100%', aspectRatio: 1, borderRadius: radius.l, backgroundColor: '#ddd' },
  alert: { borderRadius: radius.m, borderWidth: 1, padding: spacing.l, gap: spacing.s },
  headline: { fontSize: 20, fontWeight: '700' },
  advice: { fontSize: 15, lineHeight: 21, color: colors.text },
  topName: { fontSize: 22, fontWeight: '700', color: colors.text },
  latin: { fontSize: 15, fontStyle: 'italic', color: colors.muted },
  note: { fontSize: 14, lineHeight: 20, color: colors.text, marginTop: spacing.m },
  list: { borderRadius: radius.m, overflow: 'hidden' },
  right: { alignItems: 'flex-end' },
  percent: { fontSize: 16, fontWeight: '600', color: colors.text },
  season: { fontSize: 11, color: colors.muted },
  hint: { fontSize: 13, color: colors.muted, marginTop: spacing.s },
  actions: { gap: spacing.m, marginTop: spacing.xl },
});
