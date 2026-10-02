import { Linking, ScrollView, StyleSheet, Text } from 'react-native';
import { Button, Card, SectionTitle } from '../ui/components';
import { colors, spacing } from '../ui/theme';
import { Icon } from '../ui/Icon';

export default function Safety() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card style={styles.emergency}>
        <Icon name="shield" size={32} color="#8E0E0E" />
        <Text style={styles.emergencyTitle}>Подозрение на отравление грибами</Text>
        <Text style={styles.emergencyText}>
          Сразу вызывайте скорую помощь, даже если симптомы слабые или ещё не появились. При
          отравлении бледной поганкой человек может почувствовать себя лучше на 2–3 день — это
          мнимое улучшение, печень в это время продолжает разрушаться.
        </Text>
        <Button title="Позвонить 103" icon="phone" onPress={() => void Linking.openURL('tel:103')} />
        <Button title="Позвонить 112" icon="phone" variant="secondary" onPress={() => void Linking.openURL('tel:112')} />
      </Card>

      <SectionTitle>До приезда врачей</SectionTitle>
      <Card>
        <Text style={styles.p}>
          • Сохраните остатки грибов, очистки и, если была, рвотную массу — это поможет врачам
          понять, чем отравление.{'\n'}
          • Пейте воду маленькими глотками.{'\n'}
          • Не принимайте алкоголь и не занимайтесь самолечением «народными средствами».{'\n'}
          • Если грибы ели несколько человек — к врачу нужно всем, даже тем, кто чувствует себя
          нормально.
        </Text>
      </Card>

      <SectionTitle>Правила грибника</SectionTitle>
      <Card>
        <Text style={styles.p}>
          • Берите только те грибы, в которых уверены. Сомневаетесь — не берите.{'\n'}
          • Выкапывайте гриб целиком, с основанием ножки: у самых опасных мухоморов вольва
          («мешочек») прячется в земле.{'\n'}
          • Не собирайте старые, червивые, раскисшие грибы и грибы у дорог, предприятий, на
          свалках — они накапливают тяжёлые металлы.{'\n'}
          • Не кладите незнакомые грибы в общую корзину.{'\n'}
          • Не пробуйте грибы сырыми, не давайте грибы детям, беременным и пожилым.{'\n'}
          • Условно съедобные грибы обязательно вымачивайте или отваривайте, как указано в
          карточке, и сливайте отвар.{'\n'}
          • Ни одно приложение не заменяет знаний и проверки опытным грибником.
        </Text>
      </Card>

      <SectionTitle>Опаснее всего</SectionTitle>
      <Card>
        <Text style={styles.p}>
          Пластинчатые грибы с белыми пластинками, кольцом на ножке и утолщением или «мешочком»
          у основания. Так выглядят бледная поганка и мухомор вонючий — их путают с сыроежками,
          шампиньонами, зеленками и дождевиками. Мелкие коричневые грибы на пнях — среди опят
          встречается смертельно ядовитая галерина.
        </Text>
      </Card>

      <Text style={styles.small}>
        Справочная информация собрана из открытых источников и не является медицинской
        рекомендацией.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.l, paddingBottom: spacing.xl * 2 },
  emergency: { backgroundColor: '#F7C9C9', borderColor: '#8E0E0E', gap: spacing.m },
  emergencyTitle: { fontSize: 18, fontWeight: '700', color: '#8E0E0E' },
  emergencyText: { fontSize: 15, lineHeight: 21, color: '#5A0A0A' },
  p: { fontSize: 15, lineHeight: 23, color: colors.text },
  small: { fontSize: 13, color: colors.muted, marginTop: spacing.xl, textAlign: 'center' },
});
