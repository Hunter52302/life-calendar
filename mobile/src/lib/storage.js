// React Native implementation — backed by expo-secure-store.
// Web uses src/lib/storage.js (localStorage).

import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'lc-auth-token';

export const storage = {
  getToken:    ()      => SecureStore.getItemAsync(TOKEN_KEY),
  setToken:    (token) => SecureStore.setItemAsync(TOKEN_KEY, token),
  removeToken: ()      => SecureStore.deleteItemAsync(TOKEN_KEY),
};
