import { Pressable, StyleSheet, View } from 'react-native';
import { Link } from 'expo-router';

import { Text } from '@/components/Themed';

export default function HomeTab() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>ParTracker</Text>
      <Text style={styles.subtitle}>Log rounds, track stats, and keep a lightweight handicap on your device.</Text>

      <View style={styles.block}>
        <Text style={styles.blockTitle}>Play</Text>
        <Link href="/round/new" asChild>
          <Pressable style={styles.primary}>
            <Text style={styles.primaryText}>Start a round</Text>
          </Pressable>
        </Link>
        <Text style={styles.caption}>Pick a course, choose 9 or 18 holes, then enter scores hole by hole.</Text>
      </View>

      <View style={styles.block}>
        <Text style={styles.blockTitle}>Courses</Text>
        <View style={styles.row}>
          <Link href="/course/scan" asChild>
            <Pressable style={styles.secondary}>
              <Text style={styles.secondaryText}>Scan scorecard</Text>
            </Pressable>
          </Link>
          <Link href="/course/new" asChild>
            <Pressable style={styles.secondary}>
              <Text style={styles.secondaryText}>Add manual</Text>
            </Pressable>
          </Link>
        </View>
        <Link href="/courses" asChild>
          <Pressable style={styles.tertiary}>
            <Text style={styles.tertiaryText}>View all courses</Text>
          </Pressable>
        </Link>
      </View>

      <View style={styles.block}>
        <Text style={styles.blockTitle}>History & stats</Text>
        <Link href="/rounds" asChild>
          <Pressable style={styles.tertiary}>
            <Text style={styles.tertiaryText}>Past rounds</Text>
          </Pressable>
        </Link>
        <Link href="/two" asChild>
          <Pressable style={styles.tertiary}>
            <Text style={styles.tertiaryText}>Stats & handicap</Text>
          </Pressable>
        </Link>
      </View>

      {__DEV__ ? (
        <View style={styles.block}>
          <Text style={styles.devLabel}>Developer</Text>
          <Link href="/seed" asChild>
            <Pressable style={styles.devButton}>
              <Text style={styles.devButtonText}>Run seed</Text>
            </Pressable>
          </Link>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    gap: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '600',
    opacity: 0.85,
    lineHeight: 22,
  },
  block: { gap: 10 },
  blockTitle: { fontSize: 13, fontWeight: '800', opacity: 0.55, textTransform: 'uppercase', letterSpacing: 0.5 },
  row: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  primary: {
    backgroundColor: '#2f80ed',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  primaryText: { color: 'white', fontSize: 17, fontWeight: '900' },
  secondary: {
    borderWidth: 1.5,
    borderColor: '#2f80ed',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  secondaryText: { color: '#2f80ed', fontSize: 16, fontWeight: '800' },
  tertiary: {
    paddingVertical: 10,
  },
  tertiaryText: { fontSize: 16, fontWeight: '800', color: '#2f80ed' },
  caption: { fontSize: 13, fontWeight: '600', opacity: 0.75, lineHeight: 18 },
  devLabel: { fontSize: 12, fontWeight: '700', opacity: 0.5 },
  devButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#999',
  },
  devButtonText: { fontSize: 14, fontWeight: '600', opacity: 0.8 },
});
