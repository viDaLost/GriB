import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { checksFor, failedDangers, type CheckAnswer, type ChecksData } from '../data/checks';
import { db } from '../data/db';
import checksJson from '../data/species/checks.json';
import type { Species } from '../data/types';
import { SpeciesRow } from './components';
import { Icon } from './Icon';
import { fonts, alertColors, colors, radius, spacing } from './theme';

const checksData = checksJson as ChecksData;

/**
 * Проверка гриба, похожего на съедобный: пользователь сверяет признаки в руках.
 * Любое несовпадение — предупреждение с опасными видами. Совпадение всех — не разрешение есть.
 */
export function VerifyChecklist({ species }: { species: Species }) {
  const checks = checksFor(species, checksData);
  const [answers, setAnswers] = useState<Record<number, CheckAnswer>>({});
  if (checks.length === 0) return null;

  const failed = checks.map((c, i) => (answers[i] === 'no' ? c : null)).filter((c) => c != null);
  const dangers = failedDangers(checks, answers).map((id) => db.get(id)).filter((s) => s != null);
  const allYes = checks.every((_, i) => answers[i] === 'yes');
  const set = (i: number, v: CheckAnswer) =>
    setAnswers((prev) => {
      const next = { ...prev };
      if (next[i] === v) delete next[i];
      else next[i] = v;
      return next;
    });

  return (
    <View style={styles.box}>
      <View style={styles.heading}>
        <Icon name="shield" size={26} />
        <Text style={styles.title}>Проверьте гриб в руках</Text>
      </View>
      <Text style={styles.hint}>
        Сверьте признаки «{species.nameRu}» с грибом. Если хоть один не совпадает — гриб не берите.
      </Text>
      {checks.map((c, i) => (
        <View key={i} style={styles.check}>
          <Text style={styles.must}>{c.must}</Text>
          <View style={styles.row}>
            <Choice label="Да, так" active={answers[i] === 'yes'} onPress={() => set(i, 'yes')} />
            <Choice label="Нет / не уверен" active={answers[i] === 'no'} danger onPress={() => set(i, 'no')} />
          </View>
          {answers[i] === 'no' ? <Text style={styles.ifNot}>{c.ifNot}</Text> : null}
        </View>
      ))}
      {failed.length > 0 ? (
        <View style={styles.alert}>
          <Text style={styles.alertTitle}>Не совпало: {failed.length}. Не берите этот гриб.</Text>
          {dangers.length > 0 ? (
            <>
              <Text style={styles.alertText}>Несовпадения указывают на:</Text>
              <View style={styles.list}>
                {dangers.map((s) => (
                  <SpeciesRow key={s.id} species={s} />
                ))}
              </View>
            </>
          ) : null}
        </View>
      ) : allYes ? (
        <View style={styles.ok}>
          <Text style={styles.okText}>
            Все признаки совпали. Это снижает риск ошибки, но не гарантирует съедобность: покажите гриб
            опытному грибнику и готовьте по правилам из карточки.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function Choice({ label, active, danger, onPress }: { label: string; active: boolean; danger?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.chip, active && (danger ? styles.chipDanger : styles.chipActive)]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: colors.card, borderRadius: radius.m, borderWidth: 1, borderColor: colors.border, padding: spacing.l, gap: spacing.m },
  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  title: { flex: 1, fontSize: 22, fontFamily: fonts.display, lineHeight: 30, color: colors.text },
  hint: { fontSize: 17, fontFamily: fonts.body, lineHeight: 26, color: colors.muted },
  check: { gap: spacing.s, paddingTop: spacing.m, borderTopWidth: 1, borderColor: colors.border },
  must: { fontSize: 19, fontFamily: fonts.body, lineHeight: 28, color: colors.text },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s },
  chip: { minHeight: 52, justifyContent: 'center', paddingHorizontal: spacing.l, borderRadius: 8, backgroundColor: colors.chip },
  chipActive: { backgroundColor: colors.primary },
  chipDanger: { backgroundColor: alertColors.deadly.bg },
  chipText: { fontSize: 18, fontFamily: fonts.body, color: colors.text },
  chipTextActive: { color: '#fff', fontFamily: fonts.semibold },
  ifNot: { fontSize: 18, fontFamily: fonts.semibold, lineHeight: 27, color: alertColors.deadly.bg },
  alert: { backgroundColor: alertColors.deadly.bg, borderRadius: radius.s, padding: spacing.l, gap: spacing.s },
  alertTitle: { color: '#fff', fontSize: 20, fontFamily: fonts.bold, lineHeight: 28 },
  alertText: { color: '#fff', fontSize: 17, fontFamily: fonts.body },
  list: { borderRadius: radius.s, overflow: 'hidden' },
  ok: { backgroundColor: colors.sage, borderRadius: radius.s, padding: spacing.l },
  okText: { fontSize: 17, fontFamily: fonts.body, lineHeight: 26, color: colors.text },
});
