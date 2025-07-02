import React from 'react';
import type { InterceptWebView } from '@zkp2p/react-native-webview-intercept';
import type {
  ProviderSettings,
  ExtractedMetadataList,
  NetworkEvent,
  ProofData,
  FlowState,
  InitiateOptions,
} from '../types';
import type { Zkp2pClient } from '../client';

export interface Zkp2pValues {
  provider: ProviderSettings | null;
  flowState: FlowState;
  authError: Error | null;
  metadataList: ExtractedMetadataList[];
  interceptedPayload: NetworkEvent | null;
  initiate?: (
    platform: string,
    actionType: string,
    options?: InitiateOptions
  ) => Promise<ProviderSettings>;
  authenticate?: () => Promise<void>;
  authWebViewProps: React.ComponentProps<typeof InterceptWebView> | null;
  closeAuthWebView?: () => void;
  generateProof?: (
    providerCfg: ProviderSettings,
    payload: NetworkEvent,
    intentHash: string,
    itemIndex?: number
  ) => Promise<ProofData[]>;
  proofData: ProofData[];
  zkp2pClient: Zkp2pClient | null;
}

const Zkp2pContext = React.createContext<Zkp2pValues>({
  provider: null,
  flowState: 'idle',
  authError: null,
  metadataList: [],
  interceptedPayload: null,
  authWebViewProps: null,
  proofData: [],
  zkp2pClient: null,
});

export default Zkp2pContext;
