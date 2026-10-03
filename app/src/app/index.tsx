import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../data/db';
import { isInSeason } from '../data/season';
import { SPECIES_PHOTOS } from '../data/speciesPhotos';
import { EDIBILITY_LABEL, isDangerous, type Species } from '../data/types';
import { isModelInstalled } from '../ml/classifier';
import { startSession } from '../state/scanSession';
import { Button } from '../ui/components';
import { Icon, type IconName } from '../ui/Icon';
import { colors, edibilityColors, fonts, radius } from '../ui/theme';

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

function speciesWord(n: number): string {
  const d = n % 10, h = n % 100;
  return d === 1 && h !== 11 ? 'вид' : d >= 2 && d <= 4 && (h < 12 || h > 14) ? 'вида' : 'видов';
}

/**
 * Что растёт в этом месяце. Круглогодичные трутовики не показываем — это не новость.
 * Сначала съедобные с фото, затем опасные: их тоже важно знать в лицо.
 */
function inSeasonNow(month: number): Species[] {
  const rank = (s: Species) => (isDangerous(s.edibility) ? 1 : s.edibility === 'inedible' ? 2 : 0);
  return db.all
    .filter((s) => isInSeason(s.season, month) && !(s.season[0] === 1 && s.season[1] === 12))
    .sort((a, b) => rank(a) - rank(b) || Number(!!SPECIES_PHOTOS[b.id]) - Number(!!SPECIES_PHOTOS[a.id]));
}

export default function Home() {
  const modelReady = isModelInstalled();
  const month = new Date().getMonth() + 1;
  const now = inSeasonNow(month);
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.top}>
          <Text style={styles.brand}>грибник</Text>
          <Text style={styles.offline}>Работает без интернета</Text>
        </View>

        <Text accessibilityRole="header" style={styles.month}>{MONTHS[month - 1]}</Text>
        <Text style={styles.lead}>В лесу сейчас {now.length} {speciesWord(now.length)} из атласа</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip} style={styles.stripWrap}>
          {now.slice(0, 14).map((s) => <SeasonPlate key={s.id} species={s} />)}
          <Pressable accessibilityRole="button" onPress={() => router.push('/catalog')} style={styles.allPlate}>
            <Text style={styles.allText}>Весь атлас</Text>
            <Icon name="chevron" size={24} color={colors.primary} />
          </Pressable>
        </ScrollView>

        <View style={styles.actions}>
          <Button title="Сфотографировать гриб" icon="camera" onPress={() => { startSession(); router.push('/scan'); }} />
          {!modelReady ? <Text style={styles.note}>Распознавание по фото ещё не установлено — определите гриб по признакам.</Text> : null}
        </View>

        <View style={styles.list}>
          <Row icon="sliders" title="Определить без фото" sub="Ответьте на вопросы о шляпке, ножке и соке" onPress={() => router.push('/key')} />
          <Row icon="book" title="Атлас" sub={`${db.all.length} ${speciesWord(db.all.length)} с фотографиями и опасными двойниками`} onPress={() => router.push('/catalog')} />
          <Row icon="map" title="Карта" sub="Что растёт в вашем регионе" onPress={() => router.push('/map')} />
          <Row icon="shield" title="Безопасность" sub="Как распознать ядовитый гриб и что делать при отравлении" onPress={() => router.push('/safety')} />
        </View>

        <Pressable accessibilityRole="button" accessibilityLabel="Позвонить в скорую помощь, 103" onPress={() => void Linking.openURL('tel:103')} style={styles.emergency}>
          <Icon name="phone" size={24} color={colors.danger} />
          <Text style={styles.emergencyText}>Подозрение на отравление — звоните 103</Text>
        </Pressable>
        <Text style={styles.note}>Фото подсказывает, на какие виды похож гриб. Есть его можно только после проверки знающим человеком.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function SeasonPlate({ species }: { species: Species }) {
  const tint = edibilityColors[species.edibility];
  const photo = SPECIES_PHOTOS[species.id];
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${species.nameRu}, ${EDIBILITY_LABEL[species.edibility]}`}
      onPress={() => router.push({ pathname: '/species/[id]', params: { id: species.id } })}
      style={({ pressed }) => [styles.plate, pressed && { opacity: 0.7 }]}>
      <View style={styles.plateImage}>
        {photo ? <Image source={photo} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Icon name="mushroom" size={48} color={colors.muted} />}
        <View style={[styles.plateTab, { backgroundColor: tint.fg }]} />
      </View>
      <Text style={styles.plateName} numberOfLines={2}>{species.nameRu}</Text>
      <Text style={[styles.plateEdibility, { color: tint.fg }]}>{EDIBILITY_LABEL[species.edibility]}</Text>
    </Pressable>
  );
}

function Row({ icon, title, sub, onPress }: { icon: IconName; title: string; sub: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}>
      <Icon name={icon} size={28} color={colors.moss} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSub}>{sub}</Text>
      </View>
      <Icon name="chevron" size={22} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: 12, paddingBottom: 28 },
  top: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 20, gap: 12 },
  brand: { fontSize: 24, lineHeight: 30, fontFamily: fonts.display, color: colors.primary },
  offline: { fontSize: 14, lineHeight: 20, fontFamily: fonts.medium, color: colors.muted },
  month: { fontSize: 56, lineHeight: 62, fontFamily: fonts.display, color: colors.text, letterSpacing: -1, paddingHorizontal: 20, marginTop: 28 },
  lead: { fontSize: 19, lineHeight: 27, fontFamily: fonts.body, color: colors.muted, paddingHorizontal: 20, marginTop: 4 },
  stripWrap: { marginTop: 18 },
  strip: { paddingHorizontal: 20, gap: 12 },
  plate: { width: 136 },
  plateImage: { width: 136, height: 168, borderRadius: radius.m, overflow: 'hidden', backgroundColor: colors.sage, alignItems: 'center', justifyContent: 'center' },
  plateTab: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 6 },
  plateName: { fontSize: 17, lineHeight: 22, fontFamily: fonts.display, color: colors.text, marginTop: 8 },
  plateEdibility: { fontSize: 14, lineHeight: 19, fontFamily: fonts.semibold, marginTop: 2 },
  allPlate: { width: 112, height: 168, borderRadius: radius.m, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', gap: 6 },
  allText: { fontSize: 17, fontFamily: fonts.semibold, color: colors.primary, textAlign: 'center' },
  actions: { paddingHorizontal: 20, marginTop: 28, gap: 10 },
  list: { marginTop: 28, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 84, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  rowTitle: { fontSize: 21, lineHeight: 27, fontFamily: fonts.display, color: colors.text },
  rowSub: { fontSize: 16, lineHeight: 23, fontFamily: fonts.body, color: colors.muted, marginTop: 2 },
  emergency: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingHorizontal: 20, marginTop: 8 },
  emergencyText: { flex: 1, fontSize: 18, lineHeight: 25, fontFamily: fonts.semibold, color: colors.danger },
  note: { fontSize: 15, lineHeight: 22, fontFamily: fonts.body, color: colors.muted, paddingHorizontal: 20 },
});
