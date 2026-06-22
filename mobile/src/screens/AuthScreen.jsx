import { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * AuthScreen — sign in / create account / unlock encrypted data.
 *
 * authState: 'setup' (first launch → register), 'login', 'locked'
 * (valid session but the ZK master key needs the password), 'offline'.
 */
export default function AuthScreen({ authState, onSetup, onLogin, onRegister, onUnlock, onContinueOffline, onRetry, onLogout }) {
  const [mode, setMode]         = useState(null); // null | 'login' | 'register'
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const isOffline  = authState === 'offline';
  const isLocked   = authState === 'locked';
  const effectiveMode = authState === 'setup' ? 'register' : (mode ?? 'login');
  const isRegister = effectiveMode === 'register' && !isLocked;

  async function handleSubmit() {
    setError('');
    if (isLocked) {
      if (!password) return;
      setLoading(true);
      try { await onUnlock(password); }
      catch (err) { setError(err.message || 'Incorrect password.'); }
      finally { setLoading(false); }
      return;
    }
    if (isRegister) {
      if (!email.trim()) { setError('Email is required.'); return; }
      if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
      if (password !== confirm) { setError('Passwords do not match.'); return; }
    } else if (!password) {
      setError('Please enter your password.');
      return;
    }
    setLoading(true);
    try {
      if (isRegister) await onRegister(email.trim(), password);
      else            await onLogin(email.trim(), password);
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
            <Text style={styles.logoText}>{isLocked ? '🔒' : 'PLS'}</Text>
          </View>
          <Text style={styles.heading}>
            {isLocked ? 'Unlock your data' : isRegister ? 'Create your account' : 'Welcome back'}
          </Text>
          <Text style={styles.sub}>
            {isLocked
              ? 'Enter your password to decrypt your calendar.'
              : isRegister
                ? 'Your password also encrypts your data — zero-knowledge by default.'
                : 'Sign in to sync your calendar.'}
          </Text>

          {!isLocked && (
            <TextInput
              style={styles.input}
              placeholder={isRegister ? 'Email' : 'Email (blank if set up before accounts)'}
              placeholderTextColor="#9CA3AF"
              value={email}
              onChangeText={t => { setEmail(t); setError(''); }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />
          )}

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#9CA3AF"
            value={password}
            onChangeText={t => { setPassword(t); setError(''); }}
            secureTextEntry
            autoFocus={isLocked}
            returnKeyType={isRegister ? 'next' : 'done'}
            onSubmitEditing={isRegister ? undefined : handleSubmit}
          />

          {isRegister && (
            <TextInput
              style={styles.input}
              placeholder="Confirm password"
              placeholderTextColor="#9CA3AF"
              value={confirm}
              onChangeText={t => { setConfirm(t); setError(''); }}
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable onPress={handleSubmit} style={styles.btnPrimary} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnPrimaryText}>
                  {isLocked ? 'Unlock' : isRegister ? 'Create account' : 'Sign in'}
                </Text>
            }
          </Pressable>
          {loading && (isLocked || isRegister) && (
            <Text style={styles.hint}>Deriving encryption key — this takes a few seconds…</Text>
          )}

          {authState === 'login' && (
            <Pressable onPress={() => { setMode(isRegister ? 'login' : 'register'); setError(''); setConfirm(''); }} style={styles.btnSecondary}>
              <Text style={styles.btnSecondaryText}>
                {isRegister ? 'Already have an account? Sign in' : 'New here? Create an account'}
              </Text>
            </Pressable>
          )}
          {isLocked && (
            <Pressable onPress={onLogout} style={styles.btnSecondary}>
              <Text style={styles.btnSecondaryText}>Sign in as someone else</Text>
            </Pressable>
          )}

          {isRegister && (
            <Text style={styles.hint}>
              If you forget your password, your encrypted data cannot be recovered.
            </Text>
          )}
          {isLocked && (
            <Text style={styles.hint}>
              If an admin reset your password, enter your previous password here.
            </Text>
          )}
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
  hint:            { fontSize: 12, color: '#9CA3AF', textAlign: 'center', marginTop: 4, lineHeight: 17 },
});
