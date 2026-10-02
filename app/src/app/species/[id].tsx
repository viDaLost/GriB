import { Image } from 'expo-image';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { db } from '../../data/db';
import { PHOTO_CREDITS, SPECIES_PHOTOS } from '../../data/speciesPhotos';
import { formatSeason, formatSeasonPart } from '../../data/season';
import { HYMENOPHORE_LABEL, isDangerous } from '../../data/types';
import { Button, Card, EdibilityBadge, SectionTitle, SpeciesRow } from '../../ui/components';
import { Icon } from '../../ui/Icon';
import { VerifyChecklist } from '../../ui/VerifyChecklist';
import { colors, edibilityColors, spacing } from '../../ui/theme';

export default function SpeciesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const s = id ? db.get(id) : undefined;

  if (!s) {
    return <Text style={styles.missing}>Вид не найден</Text>;
  }

  const danger = isDangerous(s.edibility);
  const tint = edibilityColors[s.edibility];
  const photo = SPECIES_PHOTOS[s.id];
  const credit = PHOTO_CREDITS[s.id];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: 'Карточка гриба' }} />

      {photo != null ? (
        <View style={styles.photoWrap}>
          <Image source={photo} style={styles.photo} contentFit="cover" />
          {credit ? (
            <Text style={styles.credit} onPress={() => void Linking.openURL(credit.url)}>
              Фото: {credit.author || 'iNaturalist'} · {credit.license} · iNaturalist
            </Text>
          ) : null}
        </View>
      ) : null}

      <View>
        <Text style={styles.name}>{s.nameRu}</Text>
        <Text style={styles.latin}>{s.latin}</Text>
        <Text style={styles.family}>
          {s.family} · {HYMENOPHORE_LABEL[s.hymenophore].toLowerCase()}
        </Text>
        {s.altNamesRu.length > 0 ? (
          <Text style={styles.family}>Также: {s.altNamesRu.join(', ')}</Text>
        ) : null}
      </View>

      <View style={[styles.edibility, { backgroundColor: tint.bg }]}>
        <EdibilityBadge edibility={s.edibility} large />
        {s.edibilityNote ? (
          <Text style={[styles.edibilityNote, { color: tint.fg }, danger && styles.bold]}>
            {s.edibilityNote}
          </Text>
        ) : null}
        {s.protected ? (
          <Text style={[styles.edibilityNote, { color: tint.fg }]}>
            Охраняется в ряде регионов — занесён в региональные Красные книги.
          </Text>
        ) : null}
      </View>

      <View style={{ marginTop: spacing.l }}>
        <VerifyChecklist key={s.id} species={s} />
      </View>

      <View style={styles.discovery}>
        <View style={styles.discoveryHeading}><Icon name="calendar" size={30} /><Text style={styles.discoveryTitle}>Когда встречается</Text></View>
        <Text style={styles.season}>{formatSeason(s.season)}</Text>
        <Text style={styles.fieldValue}>{formatSeasonPart(s.season)}</Text>
        <Text style={styles.seasonHint}>Сроки примерные. На юге и в горах сезон зависит от высоты, дождей и температуры.</Text>
      </View>
      <View style={styles.discovery}>
        <View style={styles.discoveryHeading}><Icon name="leaf" size={30} /><Text style={styles.discoveryTitle}>Где растёт</Text></View>
        <Text style={styles.fieldValue}>{s.habitat}</Text>
        <Field label="Где встречается в России" value={s.range} />
        <Button title="Районы и находки на карте" icon="map" variant="secondary" onPress={() => router.push({ pathname: '/map', params: { species: s.id } })} />
      </View>

      <SectionTitle>Главные признаки</SectionTitle>
      <Card>
        {s.keyFeatures.map((f) => (
          <Text key={f} style={styles.feature}>
            • {f}
          </Text>
        ))}
      </Card>

      <SectionTitle>Описание</SectionTitle>
      <Card style={{ gap: spacing.m }}>
        <Field label="Шляпка" value={s.cap} />
        <Field label="Низ шляпки" value={s.underside} />
        <Field label="Ножка" value={s.stem} />
        <Field label="Мякоть" value={s.flesh} />
      </Card>

      {s.lookalikes.length > 0 ? (
        <>
          <SectionTitle>Похожие виды и как отличить</SectionTitle>
          {s.lookalikes.map((l) => {
            const other = db.get(l.id);
            if (!other) return null;
            return (
              <View key={l.id} style={styles.lookalike}>
                <SpeciesRow species={other} />
                <Text style={styles.howToTell}>{l.howToTell}</Text>
              </View>
            );
          })}
        </>
      ) : null}
    </ScrollView>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.l, paddingBottom: spacing.xl * 2 },
  photoWrap: { marginBottom: spacing.l },
  photo: { width: '100%', aspectRatio: 1.25, borderRadius: 24, backgroundColor: colors.chip },
  credit: { fontSize: 14, color: colors.muted, marginTop: spacing.xs },
  missing: { padding: spacing.xl, textAlign: 'center', color: colors.muted },
  name: { fontSize: 34, lineHeight: 42, fontWeight: '700', color: colors.text },
  latin: { fontSize: 19, fontStyle: 'italic', color: colors.muted, marginTop: 2 },
  family: { fontSize: 17, color: colors.muted, marginTop: spacing.xs },
  edibility: { marginTop: spacing.l, padding: spacing.l, borderRadius: 12, gap: spacing.s },
  edibilityNote: { fontSize: 18, lineHeight: 27 },
  bold: { fontWeight: '600' },
  feature: { fontSize: 20, lineHeight: 30, color: colors.text },
  fieldLabel: { fontSize: 18, lineHeight: 26, fontWeight: '700', color: colors.muted },
  fieldValue: { fontSize: 20, lineHeight: 30, color: colors.text, marginTop: 4 },
  discovery: { backgroundColor: colors.sage, borderRadius: 24, padding: 20, marginTop: 20, gap: 12 },
  discoveryHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  discoveryTitle: { flex: 1, fontSize: 23, lineHeight: 30, fontWeight: '700', color: colors.text },
  season: { fontSize: 27, lineHeight: 35, fontWeight: '700', color: colors.primary },
  seasonHint: { fontSize: 17, lineHeight: 26, color: colors.muted },
  lookalike: {
    marginBottom: spacing.m,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  howToTell: { fontSize: 17, lineHeight: 25, color: colors.text, padding: spacing.l, paddingTop: spacing.s },
});
