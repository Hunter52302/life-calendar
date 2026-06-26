import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useState } from 'react';

/**
 * Bottom banner shown when an OTA update (or a server-issued rollback) is
 * ready, mirroring the desktop UpdateBanner. No-ops when auto-update is on
 * (the update just applies silently) or once dismissed.
 */
export default function UpdateBanner({ updater, T }) {
  const { autoUpdate, status, apply } = updater;
  const [dismissed, setDismissed] = useState(false);

  if (status === 'installing') {
    return (
      <View style={[s.banner, { backgroundColor: T.accent }]}>
        <ActivityIndicator color="#fff" size="small" />
        <Text style={s.text}>Installing update…</Text>
      </View>
    );
  }

  if (autoUpdate || dismissed || (status !== 'available' && status !== 'rollback')) return null;

  return (
    <View style={[s.banner, { backgroundColor: T.accent }]}>
      <Text style={[s.text, { flex: 1 }]}>
        {status === 'rollback' ? 'A fix is ready to install' : 'A new version is available'}
      </Text>
      <Pressable style={s.btn} onPress={apply}>
        <Text style={s.btnText}>Update</Text>
      </Pressable>
      <Pressable style={s.dismiss} onPress={() => setDismissed(true)}>
        <Text style={s.dismissText}>Later</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  text: { color: '#fff', fontSize: 13, fontWeight: '600' },
  btn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.2)' },
  btnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  dismiss: { paddingHorizontal: 8, paddingVertical: 6 },
  dismissText: { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
});
