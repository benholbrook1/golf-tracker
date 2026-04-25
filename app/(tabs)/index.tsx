import { ScrollView, StyleSheet, View } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/Themed';
import { Button, Card } from '@/components/ui';
import { colors, space, typography } from '@/theme/tokens';

export default function HomeTab() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>ParTracker</Text>
          <Text style={styles.subtitle}>Track rounds, see stats, and keep a simple handicap — all on device.</Text>
        </View>

        <Card>
          <Text style={styles.cardTitle}>Play</Text>
          <Text style={styles.cardBody}>Start a new round and enter scores hole by hole.</Text>
          <Link href="/round/new" asChild>
            <Button title="Start round" variant="primary" />
          </Link>
        </Card>

        <Card>
          <Text style={styles.cardTitle}>Courses</Text>
          <Text style={styles.cardBody}>Add a course by scanning a scorecard or entering details manually.</Text>
          <View style={styles.row}>
            <Link href="/course/scan" asChild>
              <Button title="Scan scorecard" variant="secondary" />
            </Link>
            <Link href="/course/new" asChild>
              <Button title="Add manually" variant="secondary" />
            </Link>
          </View>
          <Link href="/courses" asChild>
            <Button title="View courses" variant="ghost" />
          </Link>
        </Card>

        <Card>
          <Text style={styles.cardTitle}>History</Text>
          <Text style={styles.cardBody}>Resume an in-progress round or review past results.</Text>
          <View style={styles.row}>
            <Link href="/rounds" asChild>
              <Button title="Rounds" variant="secondary" />
            </Link>
            <Link href="/two" asChild>
              <Button title="Stats" variant="secondary" />
            </Link>
          </View>
        </Card>

        {__DEV__ ? (
          <Card style={styles.devCard}>
            <Text style={styles.devLabel}>Developer</Text>
            <Link href="/seed" asChild>
              <Button title="Run seed" variant="destructive-outline" />
            </Link>
          </Card>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  container: { padding: space[4], gap: space[4], paddingBottom: 40 },

  header: { gap: space[2], paddingTop: space[2] },
  title: { ...typography.headingXl, color: colors.text },
  subtitle: { ...typography.bodyS, color: colors.textMuted },

  cardTitle: { ...typography.headingM, color: colors.text },
  cardBody: { ...typography.bodyS, color: colors.textMuted },

  row: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },

  devCard: { borderColor: colors.outline },
  devLabel: { ...typography.labelS, color: colors.textMuted },
});
