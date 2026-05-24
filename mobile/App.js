import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { api } from './src/lib/api.js';

export default function App() {
  const [status, setStatus] = useState('checking');

  useEffect(() => {
    api.health()
      .then(() => setStatus('connected'))
      .catch(() => setStatus('unreachable'));
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>PLS Calendar</Text>
      <Text style={styles.subtitle}>Mobile App</Text>
      {status === 'checking'    && <ActivityIndicator color="#863bff" style={styles.indicator} />}
      {status === 'connected'   && <Text style={styles.ok}>Backend reachable ✓</Text>}
      {status === 'unreachable' && (
        <Text style={styles.err}>
          Cannot reach backend.{'\n'}
          Check EXPO_PUBLIC_API_URL in mobile/.env
        </Text>
      )}
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a' },
  title:      { color: '#ffffff', fontSize: 24, fontWeight: 'bold' },
  subtitle:   { color: '#94a3b8', fontSize: 14, marginBottom: 24 },
  indicator:  { marginTop: 8 },
  ok:         { color: '#22c55e', marginTop: 8 },
  err:        { color: '#ef4444', marginTop: 8, textAlign: 'center', paddingHorizontal: 32 },
});
