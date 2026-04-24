import { useState } from 'react';
import { Button, StyleSheet, View } from 'react-native';

import { Text } from '@/components/Themed';
import { seed } from '@/db/seed';

type Status =
  | { state: 'idle' }
  | { state: 'running' }
  | { state: 'success' }
  | { state: 'error'; message: string };

export default function SeedScreen() {
  const [status, setStatus] = useState<Status>({ state: 'idle' });

  const onSeed = async () => {
    setStatus({ state: 'running' });
    try {
      await seed();
      setStatus({ state: 'success' });
    } catch (e) {
      setStatus({ state: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Dev Seed</Text>
      <Text style={styles.subtitle}>
        Runs the development seed against the on-device SQLite database.
      </Text>

      <View style={styles.actions}>
        <Button title={status.state === 'running' ? 'Seeding…' : 'Run seed'} onPress={onSeed} disabled={status.state === 'running'} />
      </View>

      <Text style={styles.status}>
        Status:{' '}
        {status.state === 'idle'
          ? 'Idle'
          : status.state === 'running'
            ? 'Running'
            : status.state === 'success'
              ? 'Success'
              : `Error: ${status.message}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 12,
  },
  subtitle: {
    opacity: 0.8,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  actions: {
    alignSelf: 'flex-start',
  },
  status: {
    marginTop: 8,
  },
});

