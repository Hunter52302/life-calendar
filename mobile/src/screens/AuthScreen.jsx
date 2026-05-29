import { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AuthScreen({ authState, onSetup, onLogin, onContinueOffline, onRetry }) {
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const isSetup   = authState === 'setup';
  const isOffline = authState === 'offline';

  async function handleSubmit() {
    setError('');
    if (isSetup && password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (!password) {
      setError('Please enter a password.');
      return;
    }
    setLoading(true);
    try {
      if (isSetup) await onSetup(password);
      else         await onLogin(password);
    } catch (err) {
      setError(err.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  }

  if (isOffline) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <View style={styles.iconWrap}>
            <Text style={styles.iconText}>📡</Text>
          </View>
          <Text style={styles.heading}>Can't reach server</Text>
          <Text style={styles.sub}>
            Make sure the backend is running and{'\n'}
            EXPO_PUBLIC_API_URL is set in mobile/.env
          </Text>
          <Pressable onPress={onRetry} style={styles.btnPrimary}>
            <Text style={styles.btnPrimaryText}>Retry connection</Text>
          </Pressable>
          <Pressable onPress={onContinueOffline} style={styles.btnSecondary}>
            <Text style={styles.btnSecondaryText}>Continue with local data</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.kvWrap}
      >
        <View style={styles.center}>
          <View style={styles.logoWrap}>
            <Text style={styles.logoText}>PLS</Text>
          </View>
          <Text style={styles.heading}>
            {isSetup ? 'Create your password' : 'Welcome back'}
          </Text>
          <Text style={styles.sub}>
            {isSetup
              ? 'Set a password to protect your calendar data.'
              : 'Enter your password to sync your calendar.'}
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#9CA3AF"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoFocus
            returnKeyType={isSetup ? 'next' : 'done'}
            onSubmitEditing={isSetup ? undefined : handleSubmit}
          />

          {isSetup && (
            <TextInput
              style={styles.input}
              placeholder="Confirm password"
              placeholderTextColor="#9CA3AF"
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable onPress={handleSubmit} style={styles.btnPrimary} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnPrimaryText}>{isSetup ? 'Create account' : 'Sign in'}</Text>
            }
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: '#F9FAFB' },
  kvWrap:          { flex: 1 },
  center:          { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  logoWrap:        { width: 72, height: 72, borderRadius: 20, backgroundColor: '#7C3AED', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  logoText:        { color: '#fff', fontSize: 24, fontWeight: '800', letterSpacing: 2 },
  iconWrap:        { marginBottom: 16 },
  iconText:        { fontSize: 48 },
  heading:         { fontSize: 24, fontWeight: '700', color: '#111827', textAlign: 'center', marginBottom: 8 },
  sub:             { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 32, lineHeight: 20 },
  input:           { width: '100%', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 14, fontSize: 16, color: '#111827', backgroundColor: '#fff', marginBottom: 12 },
  error:           { color: '#DC2626', fontSize: 13, marginBottom: 12, textAlign: 'center' },
  btnPrimary:      { width: '100%', backgroundColor: '#7C3AED', borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 12 },
  btnPrimaryText:  { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnSecondary:    { width: '100%', borderRadius: 12, padding: 14, alignItems: 'center' },
  btnSecondaryText:{ color: '#7C3AED', fontSize: 15, fontWeight: '600' },
});
