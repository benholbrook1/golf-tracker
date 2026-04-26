import Constants from 'expo-constants';
import { Link } from 'expo-router';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/Themed';

export default function AboutModal() {
  const appVersion = Constants.expoConfig?.version ?? '—';
  return (
    <View style={styles.container}>
      <Text style={styles.title}>GolfLog</Text>
      <Text style={styles.body}>
        A local-first golf log: your rounds and courses stay in SQLite on this device. No account required in this build.
      </Text>
      <Text style={styles.meta}>
        {Platform.OS === 'ios' ? 'iOS' : Platform.OS === 'android' ? 'Android' : 'Web'} · Version {appVersion}
      </Text>
      <View style={styles.block}>
        <Text style={styles.h3}>Quick links</Text>
        <Link href="/courses" asChild>
          <Pressable>
            <Text style={styles.link}>Courses</Text>
          </Pressable>
        </Link>
        <Link href="/rounds" asChild>
          <Pressable>
            <Text style={styles.link}>Rounds</Text>
          </Pressable>
        </Link>
        <Link href="/two" asChild>
          <Pressable>
            <Text style={styles.link}>Stats</Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    gap: 14,
    paddingTop: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
  },
  body: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
    opacity: 0.9,
  },
  meta: {
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.6,
  },
  block: { marginTop: 8, gap: 8 },
  h3: { fontSize: 14, fontWeight: '800', opacity: 0.6, textTransform: 'uppercase' },
  link: { fontSize: 16, fontWeight: '800', color: '#2f80ed' },
});
