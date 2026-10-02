import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { db } from '../data/db';
import { answerValue, isApplicable, QUESTION_BY_ID, QUESTIONS, toggleAnswer } from '../data/questions';
import traitsJson from '../data/species/traits.json';
import type { Traits } from '../data/traits';
import { isDangerous } from '../data/types';
import { modelLabels } from '../ml/classifier';
import { identify, type Candidate } from '../ml/decision';
import { averageProbs, bestQuestions, conflictingShots, fuseWithAnswers } from '../ml/ensemble';
import { MODEL_META } from '../ml/modelAsset';
import { MAX_SHOTS, SHOT_HINTS, removeShot, setAnswers, startSession, useScanSession } from '../state/scanSession';
import { Button, Card, EdibilityBadge, SectionTitle, SpeciesRow } from '../ui/components';
import { QuestionBlock } from '../ui/QuestionBlock';
import { Icon } from '../ui/Icon';
import { alertColors, colors, radius, spacing } from '../ui/theme';

const traits = traitsJson as Record<string, Traits>;
const dangerousIds = new Set(db.all.filter((s) => isDangerous(s.edibility)).map((s) => s.id));

function percent(p: number): string {
  return p >= 0.995 ? '>99%' : p < 0.01 ? '<1%' : `${Math.round(p * 100)}%`;
}

export default function ResultScreen() {
  const session = useScanSession();
  const [allQuestions, setAllQuestions] = useState(false);
  const labels = modelLabels();

  const computed = useMemo(() => {
    if (session.shots.length === 0 || labels.length === 0) return null;
    // Фото: среднее по всем снимкам. Ответы пользователя уточняют порядок вариантов,
    // а опасные виды ищутся ещё и по одному фото — ответ не может их скрыть.
    const photo = averageProbs(session.shots.map((s) => s.probs));
    const fused = fuseWithAnswers(photo, labels, traits, session.answers);
    const result = identify(fused, labels, db, {
      month: new Date().getMonth() + 1,
      safetyOutput: photo,
      safetyOutputs: session.shots.map((s) => s.probs),
      conflictingEvidence: conflictingShots(session.shots.map((s) => s.probs)),
    });
    const ask =
      result.verdict === 'not_mushroom'
        ? []
        : bestQuestions(fused, labels, traits, session.answers, { dangerousIds });
    return { result, ask };
  }, [session, labels]);

  if (!computed) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Нет снимков. Сфотографируйте гриб.</Text>
        <Button title="К камере" onPress={() => router.replace('/scan')} />
      </View>
    );
  }

  const { result: id, ask } = computed;
  const alert = alertColors[id.alertLevel];
  const top = id.candidates[0];
  const answeredQs = QUESTIONS.filter((q) => session.answers[q.id] != null && isApplicable(q, session.answers));
  const shownQs = allQuestions ? QUESTIONS.filter((q) => isApplicable(q, session.answers)) : [...answeredQs, ...ask.map((qid) => QUESTION_BY_ID[qid])];
  const canAddShot = session.shots.length < MAX_SHOTS;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.shots}>
        {session.shots.map((s, i) => (
          <View key={`${s.uri}-${i}`} style={styles.shotWrap}>
            <Image source={{ uri: s.uri }} style={styles.shotPhoto} contentFit="cover" />
            <Pressable accessibilityRole="button" accessibilityLabel={`Удалить снимок ${i + 1}`} onPress={() => removeShot(i)} style={styles.removeShot}><Icon name="close" size={18} color="#fff" /></Pressable>
          </View>
        ))}
        {canAddShot ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/scan')}
            style={({ pressed }) => [styles.shot, styles.addShot, pressed && { opacity: 0.6 }]}
          >
            <Icon name="plus" size={28} />
            <Text style={styles.addText}>{SHOT_HINTS[session.shots.length]}</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={[styles.alert, { backgroundColor: alert.bg, borderColor: alert.border }]}>
        <Icon name="shield" color={alert.fg} size={24} />
        <Text style={[styles.headline, { color: alert.fg }]}>{id.headline}</Text>
        <Text style={[styles.text, { color: alert.fg }]}>{id.advice}</Text>
      </View>
      <Text style={styles.small}>Сходство по фото — не вероятность съедобности. Для проверки нужны низ шляпки, целая ножка и признаки.</Text>

      {top && id.verdict !== 'unknown' ? (
        <Card>
          <Text style={styles.topName}>{top.species.nameRu}</Text>
          <Text style={styles.latin}>{top.species.latin}</Text>
          <View style={{ marginTop: spacing.s }}>
            <EdibilityBadge edibility={top.species.edibility} large />
          </View>
          {top.species.edibilityNote ? <Text style={styles.note}>{top.species.edibilityNote}</Text> : null}
        </Card>
      ) : null}

      {id.verdict !== 'not_mushroom' ? <Button title={allQuestions ? 'Оставить важные вопросы' : 'Уточнить все признаки'} variant="secondary" icon="sliders" onPress={() => setAllQuestions((v) => !v)} /> : null}

      {shownQs.length > 0 ? (
        <>
          <SectionTitle>Уточните — так точнее</SectionTitle>
          <Text style={styles.small}>
            Ответьте на то, что видите. Это меняет порядок вариантов, но не скрывает опасные грибы.
          </Text>
          {shownQs.map((q) => (
            <QuestionBlock
              key={q.id}
              question={q}
              value={answerValue(session.answers, q.id)}
              onSelect={(v) => setAnswers(toggleAnswer(session.answers, q.id, v))}
            />
          ))}
        </>
      ) : null}

      {id.dangerousCandidates.length > 0 ? (
        <>
          <SectionTitle>Опасные совпадения по фото</SectionTitle>
          <Text style={styles.small}>Модель дала эти варианты хотя бы на одном снимке. Это предупреждение, а не подтверждение вида.</Text>
          <CandidateList list={id.dangerousCandidates} raw />
        </>
      ) : null}

      {id.candidates.length > 0 ? (
        <>
          <SectionTitle>{id.verdict === 'unknown' ? 'Отдалённо похоже на' : 'Варианты'}</SectionTitle>
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
          <Text style={styles.small}>
            Откройте карточку вида — там описано, как отличить «{top.species.nameRu}» от двойника.
          </Text>
        </>
      ) : null}

      <View style={styles.actions}>
        {canAddShot ? (
          <Button
            title={`Добавить снимок (${session.shots.length + 1} из ${MAX_SHOTS})`}
            onPress={() => router.push('/scan')}
            icon="camera"
          />
        ) : null}
        <Button
          title="Определить другой гриб"
          variant="secondary"
          onPress={() => {
            startSession();
            router.replace('/scan');
          }}
        />
        <Button title="Безопасность и первая помощь" variant="secondary" onPress={() => router.push('/safety')} />
      </View>

      {MODEL_META?.metrics?.top1 != null ? (
        <Text style={styles.model}>
          Модель {MODEL_META.version}: на проверочных фото верный вид первым —{' '}
          {Math.round(MODEL_META.metrics.top1 * 100)}%, среди трёх вариантов —{' '}
          {Math.round((MODEL_META.metrics.top3 ?? 0) * 100)}%.
        </Text>
      ) : null}
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
              <Text style={styles.season}>сходство</Text>
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
  shots: { flexDirection: 'row', gap: spacing.s },
  shotWrap: { flex: 1, minHeight: 112, minWidth: 0 },
  shotPhoto: { width: '100%', height: '100%', borderRadius: radius.m },
  removeShot: { position: 'absolute', right: 3, top: 3, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(34,62,53,0.8)', alignItems: 'center', justifyContent: 'center' },
  shot: { flex: 1, minHeight: 112, minWidth: 0, borderRadius: radius.m, backgroundColor: '#ddd' },
  addShot: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.s,
  },
  addPlus: { fontSize: 32, color: colors.primary },
  addText: { fontSize: 14, color: colors.primary, textAlign: 'center' },
  alert: { borderRadius: radius.m, borderWidth: 1, padding: spacing.l, gap: spacing.s },
  headline: { fontSize: 24, fontWeight: '700' },
  text: { fontSize: 18, lineHeight: 27, color: colors.text },
  topName: { fontSize: 26, fontWeight: '700', color: colors.text },
  latin: { fontSize: 18, fontStyle: 'italic', color: colors.muted },
  note: { fontSize: 17, lineHeight: 25, color: colors.text, marginTop: spacing.m },
  list: { borderRadius: radius.m, overflow: 'hidden' },
  right: { alignItems: 'flex-end' },
  percent: { fontSize: 19, fontWeight: '600', color: colors.text },
  season: { fontSize: 14, color: colors.muted },
  small: { fontSize: 15, color: colors.muted },
  actions: { gap: spacing.m, marginTop: spacing.xl },
  model: { fontSize: 15, color: colors.muted, textAlign: 'center', marginTop: spacing.l },
});
