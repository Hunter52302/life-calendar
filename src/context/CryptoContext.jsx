import { createContext, useContext, useState } from 'react';

const CryptoContext = createContext({ masterKey: null, isZkEnabled: false, setMasterKey: () => {} });

export function CryptoProvider({ children }) {
  const [masterKey,   setMasterKey]   = useState(null);
  const [isZkEnabled, setIsZkEnabled] = useState(false);

  return (
    <CryptoContext.Provider value={{ masterKey, isZkEnabled, setMasterKey, setIsZkEnabled }}>
      {children}
    </CryptoContext.Provider>
  );
}

export function useCrypto() {
  return useContext(CryptoContext);
}
