import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Question } from '../data/questions';
import { colors, spacing } from './theme';

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
      <Text style={styles.title}>{question.title}</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  question: { marginTop: spacing.l },
  title: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: spacing.s },
  hint: { fontSize: 13, color: colors.muted, marginBottom: spacing.s },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s },
  chip: { paddingHorizontal: spacing.m, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.chip },
  chipActive: { backgroundColor: colors.primary },
  chipText: { fontSize: 14, color: colors.text },
  chipTextActive: { color: colors.primaryText, fontWeight: '600' },
});
