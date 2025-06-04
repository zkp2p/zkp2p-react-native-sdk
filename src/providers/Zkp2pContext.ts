import React from 'react';
import type { InterceptWebView } from '@zkp2p/react-native-webview-intercept';
import type {
  ProviderSettings,
  ExtractedMetadataList,
  NetworkEvent,
  ProofData,
  FlowState,
  StartAuthenticationOptions,
} from '../types';
import type { Zkp2pClient } from '../client';

export interface Zkp2pValues {
  /* auth */
  provider: ProviderSettings | null;
  flowState: FlowState;
  authError: Error | null;
  metadataList: ExtractedMetadataList[];
  interceptedPayload: NetworkEvent | null;
  startAuthentication?: (
    platform: string,
    actionType: string,
    options?: StartAuthenticationOptions
  ) => Promise<ProviderSettings>;
  authWebViewProps: React.ComponentProps<typeof InterceptWebView> | null;
  closeAuthWebView?: () => void;

  /* proof */
  generateProof?: (
    providerCfg: ProviderSettings,
    payload: NetworkEvent,
    intentHash: string,
    itemIndex?: number
  ) => Promise<any>;
  proofData: ProofData | null;

  /* client */
  zkp2pClient: Zkp2pClient | null;
}

const Zkp2pContext = React.createContext<Zkp2pValues>({
  provider: null,
  flowState: 'idle',
  authError: null,
  metadataList: [],
  interceptedPayload: null,
  authWebViewProps: null,
  proofData: null,
  zkp2pClient: null,
});

export default Zkp2pContext;
