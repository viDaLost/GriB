import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Question } from '../data/questions';
import { colors, spacing } from './theme';
import { Icon } from './Icon';

/** Вопрос о признаке гриба с вариантами-кнопками. Повторное нажатие снимает ответ. */
export function QuestionBlock({
  question,
  value,
  onSelect,
}: {
  question: Question;
  value: string | undefined;
  onSelect: (value: string) => void;
}) {
  return (
    <View style={styles.question}>
      <View style={styles.heading}><Icon name={question.id === 'milk' || question.id === 'milkColor' ? 'drop' : 'sliders'} size={24} /><Text style={styles.title}>{question.title}</Text></View>
      {question.hint ? <Text style={styles.hint}>{question.hint}</Text> : null}
      <View style={styles.chips}>
        {question.options.map((o) => {
          const active = o.value === value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => onSelect(o.value)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Не знаю: ${question.title}`} onPress={() => value && onSelect(value)} style={styles.skip}>
        <Text style={styles.skipText}>{value ? 'Сбросить · не знаю' : 'Не знаю — можно пропустить'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  question: { marginTop: spacing.l, backgroundColor: colors.card, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: colors.border },
  heading: { flexDirection: 'row', gap: 8, marginBottom: spacing.s },
  title: { flex: 1, fontSize: 20, lineHeight: 27, fontWeight: '700', color: colors.text },
  hint: { fontSize: 16, lineHeight: 24, color: colors.muted, marginBottom: spacing.s },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s },
  chip: { minHeight: 52, maxWidth: '100%', justifyContent: 'center', paddingHorizontal: spacing.m, paddingVertical: 12, borderRadius: 14, backgroundColor: colors.chip },
  chipActive: { backgroundColor: colors.primary },
  chipText: { fontSize: 17, color: colors.text },
  chipTextActive: { color: colors.primaryText, fontWeight: '600' },
  skip: { minHeight: 48, maxWidth: '100%', justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: 4, marginTop: 4 },
  skipText: { fontSize: 15, color: colors.muted },
});
