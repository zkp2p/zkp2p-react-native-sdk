import { useContext } from 'react';
import Zkp2pContext from '../providers/Zkp2pContext';
import type { Zkp2pValues } from '../providers/Zkp2pContext';

export function useZkp2p(): Zkp2pValues {
  const context = useContext(Zkp2pContext);
  if (!context) {
    throw new Error('useZkp2p must be used within a Zkp2pProvider');
  }
  return context;
}

export default useZkp2p;
