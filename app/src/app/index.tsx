import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { db } from '../data/db';
import { isModelInstalled } from '../ml/classifier';
import { colors, radius, spacing } from '../ui/theme';

export default function Home() {
  const modelReady = isModelInstalled();
  const counts = {
    all: db.all.length,
    deadly: db.all.filter((s) => s.edibility === 'deadly').length,
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/scan')}
        style={({ pressed }) => [styles.scan, pressed && styles.pressed]}
      >
        <Text style={styles.scanIcon}>📷</Text>
        <Text style={styles.scanTitle}>Определить гриб</Text>
        <Text style={styles.scanSub}>
          {modelReady
            ? 'Наведите камеру на гриб и сделайте снимок'
            : 'Модель распознавания пока не установлена — доступен справочник'}
        </Text>
      </Pressable>

      <Tile
        title="Определить по признакам"
        sub="Ответьте на несколько вопросов: шляпка, ножка, срез, где растёт"
        onPress={() => router.push('/key')}
      />
      <Tile
        title="Справочник грибов"
        sub={`${counts.all} видов России, из них ${counts.deadly} смертельно ядовитых`}
        onPress={() => router.push('/catalog')}
      />
      <Tile
        title="Безопасность"
        sub="Правила сбора и что делать при отравлении"
        onPress={() => router.push('/safety')}
      />

      <Text style={styles.footer}>
        Работает без интернета. Распознавание по фото может ошибаться — никогда не ешьте гриб
        только на основании ответа приложения.
      </Text>
    </ScrollView>
  );
}

function Tile({ title, sub, onPress }: { title: string; sub: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.tileTitle}>{title}</Text>
        <Text style={styles.tileSub}>{sub}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.l, gap: spacing.m },
  scan: {
    backgroundColor: colors.primary,
    borderRadius: radius.l,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.s,
  },
  scanIcon: { fontSize: 44 },
  scanTitle: { color: colors.primaryText, fontSize: 22, fontWeight: '700' },
  scanSub: { color: '#D9E7DB', fontSize: 14, textAlign: 'center' },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.m,
    padding: spacing.l,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  tileTitle: { fontSize: 17, fontWeight: '600', color: colors.text },
  tileSub: { fontSize: 14, color: colors.muted, marginTop: 2 },
  chevron: { fontSize: 24, color: colors.muted },
  pressed: { opacity: 0.7 },
  footer: { fontSize: 13, color: colors.muted, textAlign: 'center', marginTop: spacing.l },
});
