import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../data/db';
import { isModelInstalled } from '../ml/classifier';
import { startSession } from '../state/scanSession';
import { Button } from '../ui/components';
import { ForestArt, Icon, type IconName } from '../ui/Icon';
import { colors, radius, spacing } from '../ui/theme';

export default function Home() {
  const modelReady = isModelInstalled();
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.brand}>
          <View style={styles.brandIcon}><Icon name="mushroom" size={27} color="#fff" /></View>
          <View><Text style={styles.brandName}>грибник</Text><Text style={styles.brandSub}>ВАШ ЛЕСНОЙ СПУТНИК</Text></View>
          <View style={styles.offline}><View style={styles.dot} /><Text style={styles.offlineText}>Офлайн</Text></View>
        </View>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>БЛИЖЕ К ПРИРОДЕ</Text>
          <Text style={styles.title}>У каждого гриба{'\n'}своя история.</Text>
          <View style={styles.art}><ForestArt size={185} /></View>
          <Text style={styles.subtitle}>Узнайте, что перед вами.{'\n'}Сравните фото и признаки.</Text>
          <Button title="Определить по фото" icon="camera" onPress={() => { startSession(); router.push('/scan'); }} />
          {!modelReady ? <Text style={styles.small}>Фото пока недоступно — используйте признаки.</Text> : null}
        </View>
        <View style={styles.section}><Text style={styles.sectionTitle}>Всё для прогулки</Text><Icon name="leaf" size={20} /></View>
        <Tile icon="sliders" title="По признакам" sub="Шляпка, ножка, млечный сок — шаг за шагом" tint={colors.accentSoft} onPress={() => router.push('/key')} />
        <Tile icon="book" title="Лесной атлас" sub={`${db.all.length} видов · фотографии и опасные двойники`} tint={colors.sage} onPress={() => router.push('/catalog')} />
        <Tile icon="shield" title="Собирайте с осторожностью" sub="Правила сбора и помощь при отравлении" tint="#EFE9D5" onPress={() => router.push('/safety')} />
        <View style={styles.note}><Icon name="shield" size={22} color={colors.accent} /><Text style={styles.noteText}>Фото помогает найти похожие виды. Решение о съедобности требует проверки специалистом.</Text></View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Tile({ icon, title, sub, tint, onPress }: { icon: IconName; title: string; sub: string; tint: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.tile, pressed && { opacity: 0.7 }]}>
      <View style={[styles.tileIcon, { backgroundColor: tint }]}><Icon name={icon} size={26} /></View>
      <View style={{ flex: 1, minWidth: 0 }}><Text style={styles.tileTitle}>{title}</Text><Text style={styles.tileSub}>{sub}</Text></View>
      <Icon name="chevron" size={18} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 24, gap: 12 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  brandIcon: { width: 44, height: 44, borderRadius: 15, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  brandName: { fontSize: 26, fontWeight: '800', letterSpacing: -1, color: colors.text },
  brandSub: { fontSize: 8, fontWeight: '600', letterSpacing: 1.4, color: colors.muted },
  offline: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 5, padding: 8, borderRadius: 15, backgroundColor: colors.sage },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.primary },
  offlineText: { fontSize: 10, color: colors.primary, fontWeight: '600' },
  hero: { backgroundColor: '#EBEEDC', padding: 22, borderRadius: radius.l, overflow: 'hidden' },
  eyebrow: { fontSize: 10, letterSpacing: 2, fontWeight: '700', color: colors.muted, marginBottom: 12 },
  title: { fontSize: 30, fontWeight: '700', lineHeight: 36, color: colors.text, letterSpacing: -1 },
  art: { alignItems: 'center', marginVertical: 8 },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: 'center', marginBottom: 18 },
  section: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, marginBottom: 2 },
  sectionTitle: { fontSize: 19, fontWeight: '700', color: colors.text },
  tile: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: colors.card, borderRadius: radius.m, borderColor: colors.border, borderWidth: 1 },
  tileIcon: { width: 50, height: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
  tileTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  tileSub: { fontSize: 12, lineHeight: 18, color: colors.muted, marginTop: 3 },
  note: { flexDirection: 'row', gap: 10, padding: spacing.s, marginTop: 6 },
  noteText: { flex: 1, fontSize: 12, lineHeight: 18, color: colors.muted },
  small: { fontSize: 12, color: colors.muted, marginTop: 10 },
});
