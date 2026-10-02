import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { db } from '../data/db';
import { runKey, type KeyAnswers, type KeyMatch } from '../data/key';
import traitsJson from '../data/species/traits.json';
import {
  COLOR_LABEL,
  CUT_LABEL,
  FORM_LABEL,
  PLACE_LABEL,
  SUBSTRATE_LABEL,
  UNDERSIDE_LABEL,
  type Traits,
} from '../data/traits';
import { Button, SectionTitle, SpeciesRow } from '../ui/components';
import { alertColors, colors, radius, spacing } from '../ui/theme';

const traits = traitsJson as Record<string, Traits>;
const YES_NO = { yes: 'Есть', no: 'Нет' } as const;

type Option<T> = { value: T; label: string };
const opts = <T extends string>(labels: Record<T, string>): Option<T>[] =>
  (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));

export default function KeyScreen() {
  const [a, setA] = useState<KeyAnswers>({});
  const month = new Date().getMonth() + 1;
  const result = useMemo(() => runKey(db, traits, { ...a, month }), [a, month]);
  const set = <K extends keyof KeyAnswers>(k: K, v: KeyAnswers[K] | undefined) =>
    setA((prev) => ({ ...prev, [k]: prev[k] === v ? undefined : v }));
  const bool = (v: boolean | undefined) => (v == null ? undefined : v ? 'yes' : 'no');
  const fromBool = (v: 'yes' | 'no') => v === 'yes';

  const isCap = a.form == null || a.form === 'cap';

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.intro}>
        Отвечайте на то, что видно. Если не уверены — пропустите вопрос. Повторное нажатие
        снимает ответ.
      </Text>

      <Question title="Как выглядит гриб?" options={opts(FORM_LABEL)} value={a.form} onChange={(v) => set('form', v)} />
      {isCap ? (
        <Question
          title="Что под шляпкой?"
          options={opts(UNDERSIDE_LABEL)}
          value={a.underside}
          onChange={(v) => set('underside', v)}
        />
      ) : null}
      <Question title="Цвет шляпки" options={opts(COLOR_LABEL)} value={a.color} onChange={(v) => set('color', v)} />
      {isCap ? (
        <>
          <Question
            title="Кольцо («юбочка») на ножке"
            options={opts(YES_NO)}
            value={bool(a.ring)}
            onChange={(v) => set('ring', fromBool(v))}
          />
          <Question
            title="Мешочек (вольва) или клубень с ободком у основания ножки"
            hint="Выкопайте гриб целиком — у самых опасных мухоморов вольва прячется в земле."
            options={opts(YES_NO)}
            value={bool(a.volva)}
            onChange={(v) => set('volva', fromBool(v))}
          />
          <Question
            title="Млечный сок на изломе"
            options={opts(YES_NO)}
            value={bool(a.milk)}
            onChange={(v) => set('milk', fromBool(v))}
          />
        </>
      ) : null}
      <Question title="Мякоть на срезе" options={opts(CUT_LABEL)} value={a.cut} onChange={(v) => set('cut', v)} />
      <Question title="Где растёт?" options={opts(SUBSTRATE_LABEL)} value={a.substrate} onChange={(v) => set('substrate', v)} />
      <Question title="Место" options={opts(PLACE_LABEL)} value={a.place} onChange={(v) => set('place', v)} />

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

function Question<T extends string>({
  title,
  hint,
  options,
  value,
  onChange,
}: {
  title: string;
  hint?: string;
  options: Option<T>[];
  value: T | undefined;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.question}>
      <Text style={styles.qTitle}>{title}</Text>
      {hint ? <Text style={styles.qHint}>{hint}</Text> : null}
      <View style={styles.chips}>
        {options.map((o) => {
          const active = o.value === value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => onChange(o.value)}
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
  question: { marginTop: spacing.l },
  qTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: spacing.s },
  qHint: { fontSize: 13, color: colors.muted, marginBottom: spacing.s },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s },
  chip: { paddingHorizontal: spacing.m, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.chip },
  chipActive: { backgroundColor: colors.primary },
  chipText: { fontSize: 14, color: colors.text },
  chipTextActive: { color: colors.primaryText, fontWeight: '600' },
  reset: { marginTop: spacing.l },
  alert: { borderRadius: radius.m, padding: spacing.l, marginTop: spacing.xl, marginBottom: spacing.s },
  alertText: { color: '#fff', fontSize: 15, lineHeight: 21, fontWeight: '600' },
  list: { borderRadius: radius.m, overflow: 'hidden' },
  percent: { fontSize: 16, fontWeight: '600', color: colors.text },
  season: { fontSize: 11, color: colors.muted },
  empty: { color: colors.muted, fontSize: 15 },
  footer: { fontSize: 13, color: colors.muted, marginTop: spacing.xl, textAlign: 'center' },
});
