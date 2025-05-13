import { useContext } from 'react';
import Zkp2pContext from '../providers/Zkp2pContext';
import type { Zkp2pValues } from '../providers/Zkp2pContext';
import type { ProviderSettings, ExtractedItemsList } from '../types';
import type { NetworkEvent } from '../providers/Zkp2pProvider';
import type { CreateClaimResponse } from '@zkp2p/reclaim-witness-sdk';
import type { InterceptWebView } from '@zkp2p/react-native-webview-intercept';

export interface AuthWVOverrides
  extends Partial<React.ComponentProps<typeof InterceptWebView>> {}

export function useZkp2p(): Zkp2pValues {
  const context = useContext(Zkp2pContext);
  if (!context) {
    throw new Error('useZkp2p must be used within a Zkp2pProvider');
  }
  return context;
}

export default useZkp2p;

// Re-export types for convenience
export type {
  NetworkEvent,
  ProviderSettings,
  ExtractedItemsList,
  CreateClaimResponse,
};
