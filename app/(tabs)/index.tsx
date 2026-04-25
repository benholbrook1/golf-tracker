import { Pressable, StyleSheet } from 'react-native';
import { Link } from 'expo-router';

import { Text, View } from '@/components/Themed';

export default function TabOneScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>ParTracker</Text>
      <Text style={styles.subtitle}>Under Construction</Text>
      <View style={styles.separator} lightColor="#eee" darkColor="rgba(255,255,255,0.1)" />

      <Link href="/seed" asChild>
        <Pressable style={styles.devButton}>
          <Text style={styles.devButtonText}>Dev: Run seed</Text>
        </Pressable>
      </Link>

      <Link href="/course/scan" asChild>
        <Pressable style={styles.devButton}>
          <Text style={styles.devButtonText}>Scan scorecard</Text>
        </Pressable>
      </Link>

      <Link href="/course/new" asChild>
        <Pressable style={styles.devButton}>
          <Text style={styles.devButtonText}>Manual course</Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  subtitle: {
    marginTop: 6,
    opacity: 0.75,
    fontWeight: '600',
  },
  separator: {
    marginVertical: 30,
    height: 1,
    width: '80%',
  },
  devButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#999',
    marginBottom: 16,
  },
  devButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
