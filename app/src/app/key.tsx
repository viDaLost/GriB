import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { db } from '../data/db';
import { runKey, type KeyMatch } from '../data/key';
import { answerValue, isApplicable, QUESTIONS, toggleAnswer, type KeyAnswers } from '../data/questions';
import traitsJson from '../data/species/traits.json';
import type { Traits } from '../data/traits';
import { Button, SectionTitle, SpeciesRow } from '../ui/components';
import { QuestionBlock } from '../ui/QuestionBlock';
import { alertColors, colors, radius, spacing } from '../ui/theme';

const traits = traitsJson as Record<string, Traits>;

export default function KeyScreen() {
  const [a, setA] = useState<KeyAnswers>({});
  const month = new Date().getMonth() + 1;
  const result = useMemo(() => runKey(db, traits, { ...a, month }), [a, month]);

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.intro}>
        Отвечайте на то, что видно. Если не уверены — пропустите вопрос. Повторное нажатие
        снимает ответ.
      </Text>

      {QUESTIONS.filter((q) => isApplicable(q, a)).map((q) => (
        <QuestionBlock
          key={q.id}
          question={q}
          value={answerValue(a, q.id)}
          onSelect={(v) => setA((prev) => toggleAnswer(prev, q.id, v))}
        />
      ))}

      {result.answered > 0 ? (
        <View style={styles.reset}>
          <Button title="Сбросить ответы" variant="secondary" onPress={() => setA({})} />
        </View>
      ) : null}

      {result.dangerous.length > 0 ? (
        <>
          <View style={[styles.alert, { backgroundColor: alertColors.deadly.bg }]}>
            <Text style={styles.alertText}>
              Под описание подходят ядовитые грибы. Проверьте отличия в их карточках и не
              собирайте гриб, если сомневаетесь.
            </Text>
          </View>
          <MatchList list={result.dangerous.slice(0, 5)} />
        </>
      ) : null}

      <SectionTitle>
        {result.answered === 0 ? 'Ответьте хотя бы на один вопрос' : 'Похожие виды'}
      </SectionTitle>
      {result.answered > 0 && result.matches.length === 0 ? (
        <Text style={styles.empty}>
          Ничего не подходит. Возможно, этого вида нет в справочнике или какой-то ответ неточен.
        </Text>
      ) : (
        <MatchList list={result.matches} />
      )}

      {result.answered > 0 ? (
        <Text style={styles.footer}>
          Определитель подсказывает, на что похож гриб, но не заменяет проверку опытным
          грибником. Никогда не ешьте гриб только на основании этого списка.
        </Text>
      ) : null}
    </ScrollView>
  );
}

function MatchList({ list }: { list: KeyMatch[] }) {
  return (
    <View style={styles.list}>
      {list.map((m) => (
        <SpeciesRow
          key={m.species.id}
          species={m.species}
          right={
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.percent}>{Math.round(m.match * 100)}%</Text>
              {m.inSeason === false ? <Text style={styles.season}>не сезон</Text> : null}
            </View>
          }
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.l, paddingBottom: spacing.xl * 2 },
  intro: { fontSize: 15, lineHeight: 21, color: colors.muted },
  reset: { marginTop: spacing.l },
  alert: { borderRadius: radius.m, padding: spacing.l, marginTop: spacing.xl, marginBottom: spacing.s },
  alertText: { color: '#fff', fontSize: 15, lineHeight: 21, fontWeight: '600' },
  list: { borderRadius: radius.m, overflow: 'hidden' },
  percent: { fontSize: 16, fontWeight: '600', color: colors.text },
  season: { fontSize: 11, color: colors.muted },
  empty: { color: colors.muted, fontSize: 15 },
  footer: { fontSize: 13, color: colors.muted, marginTop: spacing.xl, textAlign: 'center' },
});
