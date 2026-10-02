import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { db } from '../data/db';
import { runKey, type KeyMatch } from '../data/key';
import { answerValue, isApplicable, QUESTIONS, toggleAnswer, type KeyAnswers } from '../data/questions';
import traitsJson from '../data/species/traits.json';
import type { Traits } from '../data/traits';
import { Button, SectionTitle, SpeciesRow } from '../ui/components';
import { Icon } from '../ui/Icon';
import { QuestionBlock } from '../ui/QuestionBlock';
import { alertColors, colors, radius, spacing } from '../ui/theme';

const traits = traitsJson as Record<string, Traits>;
export default function KeyScreen() {
  const [a, setA] = useState<KeyAnswers>({});
  const [step, setStep] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const month = new Date().getMonth() + 1;
  const result = useMemo(() => runKey(db, traits, { ...a, month }), [a, month]);
  const questions = QUESTIONS.filter((q) => isApplicable(q, a));
  const current = questions[Math.min(step, questions.length - 1)]!;
  const last = step >= questions.length - 1;
  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.introCard}><Icon name="sliders" size={28} /><Text style={styles.title}>Присмотритесь к грибу</Text><Text style={styles.intro}>Один вопрос за раз. Отвечайте только на то, что видите; сомневаетесь — пропустите.</Text></View>
      {!showResult ? <>
        <View style={styles.progress}><View style={[styles.progressFill, { width: `${(step + 1) / questions.length * 100}%` }]} /></View>
        <Text style={styles.step}>ПРИЗНАК {Math.min(step + 1, questions.length)} ИЗ {questions.length}</Text>
        <QuestionBlock question={current} value={answerValue(a, current.id)} onSelect={(v) => setA((prev) => toggleAnswer(prev, current.id, v))} />
        <View style={styles.actions}><Button title={last ? 'Показать варианты' : answerValue(a, current.id) ? 'Дальше' : 'Пропустить'} icon={last ? 'search' : 'arrow'} onPress={() => last ? setShowResult(true) : setStep((s) => s + 1)} />
        {step > 0 ? <Button title="Предыдущий вопрос" variant="secondary" onPress={() => setStep((s) => Math.max(0, s - 1))} /> : null}
        {result.answered > 0 && !last ? <Button title={`Посмотреть варианты · ${result.answered} признаков`} variant="secondary" onPress={() => setShowResult(true)} /> : null}</View>
      </> : <>
        <Button title="Продолжить уточнение" icon="sliders" variant="secondary" onPress={() => setShowResult(false)} />
        {result.dangerous.length > 0 ? <><View style={styles.alert}><Icon name="shield" color="#fff" /><Text style={styles.alertText}>Под описание подходят ядовитые грибы. Проверьте отличия в карточках. Не употребляйте гриб в пищу по результату приложения.</Text></View><MatchList list={result.dangerous.slice(0, 5)} /></> : null}
        <SectionTitle>{result.answered === 0 ? 'Нужны признаки' : 'Похожие виды'}</SectionTitle>
        <Text style={styles.intro}>{result.answered === 0 ? 'Вы пропустили вопросы. Вернитесь и укажите хотя бы один признак.' : 'Процент — доля совпавших признаков, а не вероятность съедобности.'}</Text>
        {result.answered > 0 && result.matches.length === 0 ? <Text style={styles.empty}>Ничего не подходит. Возможно, вида нет в справочнике или какой-то ответ неточен.</Text> : <MatchList list={result.matches} />}
        <Button title="Начать заново" variant="secondary" onPress={() => { setA({}); setStep(0); setShowResult(false); }} />
      </>}
    </ScrollView>
  );
}
function MatchList({ list }: { list: KeyMatch[] }) {
  return <View style={styles.list}>{list.map((m) => <SpeciesRow key={m.species.id} species={m.species} right={<View style={{ alignItems: 'flex-end' }}><Text style={styles.percent}>{Math.round(m.match * 100)}%</Text><Text style={styles.season}>признаков</Text>{m.inSeason === false ? <Text style={styles.season}>не сезон</Text> : null}</View>} />)}</View>;
}
const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 28, gap: 12 },
  introCard: { backgroundColor: colors.sage, borderRadius: radius.l, padding: 22, gap: 10 },
  title: { fontSize: 28, fontWeight: '700', color: colors.text },
  intro: { fontSize: 17, lineHeight: 27, color: colors.muted },
  progress: { height: 5, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden', marginTop: 8 },
  progressFill: { height: 5, backgroundColor: colors.primary, borderRadius: 3 },
  step: { color: colors.muted, fontSize: 13, letterSpacing: 1.4, marginTop: 4 },
  actions: { gap: 12, marginTop: 8 },
  alert: { borderRadius: radius.m, padding: spacing.l, backgroundColor: alertColors.deadly.bg, gap: 10 },
  alertText: { color: '#fff', fontSize: 20, lineHeight: 30, fontWeight: '600' },
  list: { borderRadius: radius.m, overflow: 'hidden' },
  percent: { fontSize: 19, fontWeight: '600', color: colors.text },
  season: { fontSize: 13, color: colors.muted }, empty: { color: colors.muted, fontSize: 18 },
});
