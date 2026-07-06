// Expo push-notification registration for the mobile app.
//
// The server already knows how to deliver reminders to an Expo push token
// (see server: expo_push integration + /push/expo-token). This module is the
// missing client half: it asks the OS for permission, obtains this device's
// Expo push token, and hands it to the caller to register with the server.
//
// Requires a development build (expo-notifications remote push does not work in
// Expo Go on SDK 53+). This project already ships a dev client — see
// mobile/AGENTS.md.

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

// Foreground presentation: show the banner + keep it in the notification list.
// SDK 56 replaced the old `shouldShowAlert` with `shouldShowBanner` /
// `shouldShowList`.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** The EAS project id, needed by getExpoPushTokenAsync in a dev/standalone build. */
function getProjectId() {
  return (
    Constants?.easConfig?.projectId ??
    Constants?.expoConfig?.extra?.eas?.projectId ??
    null
  );
}

/**
 * Ask for notification permission and return this device's Expo push token.
 *
 * @returns {Promise<{ token: string } | { error: string }>}
 *   `{ token }` on success, or `{ error }` describing why registration could
 *   not complete (not a physical device, permission denied, missing config…).
 */
export async function registerForPushNotificationsAsync() {
  // Android needs a channel before notifications will display with sound/importance.
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
      });
    } catch { /* non-fatal — channel setup can fail on odd OEM builds */ }
  }

  // Push tokens are only issued to physical devices, never simulators.
  if (!Device.isDevice) {
    return { error: 'Push notifications require a physical device.' };
  }

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  if (status !== 'granted') {
    return { error: 'Notification permission was not granted.' };
  }

  const projectId = getProjectId();
  if (!projectId) {
    return { error: 'Missing EAS projectId — cannot obtain a push token.' };
  }

  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return { token: data };
  } catch (err) {
    return { error: err?.message ?? 'Could not obtain an Expo push token.' };
  }
}
