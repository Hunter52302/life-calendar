// Web implementation — backed by localStorage.
// React Native uses mobile/src/lib/storage.js (SecureStore).

const TOKEN_KEY = 'lc-auth-token';

export const storage = {
  getToken:    ()      => localStorage.getItem(TOKEN_KEY),
  setToken:    (token) => localStorage.setItem(TOKEN_KEY, token),
  removeToken: ()      => localStorage.removeItem(TOKEN_KEY),
};
