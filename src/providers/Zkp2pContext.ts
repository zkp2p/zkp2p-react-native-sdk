import { createContext } from 'react';
import type {
  ProviderSettings,
  NetworkEvent,
  ExtractedItemsList,
  ProofData,
  FlowState,
} from '../types';
import type { Zkp2pClient } from '../client';

export interface Zkp2pValues {
  /* auth */
  provider: ProviderSettings | null;
  flowState: FlowState;
  authError: Error | null;
  startAction:
    | ((
        platform: string,
        actionType: string,
        onCompleted: () => Promise<void> | void,
        overrides?: any
      ) => Promise<ProviderSettings>)
    | null;
  startAuthentication:
    | ((
        platform: string,
        actionType: string,
        overrides?: any
      ) => Promise<ProviderSettings>)
    | null;
  authWebViewProps: any;
  closeAuthWebView: (() => void) | null;

  /* tx */
  itemsList: ExtractedItemsList[];

  /* auth state */
  interceptedPayload: NetworkEvent | null;

  /* proof */
  generateProof:
    | ((
        providerCfg: ProviderSettings,
        payload: NetworkEvent,
        intentHash: string,
        itemIndex?: number
      ) => Promise<any>)
    | null;
  proofData: ProofData | null;

  /* client */
  zkp2pClient: Zkp2pClient | null;
}

const defaultValues: Zkp2pValues = {
  provider: null,
  flowState: 'idle',
  authError: null,
  startAction: null,
  startAuthentication: null,
  authWebViewProps: null,
  closeAuthWebView: null,
  itemsList: [],
  interceptedPayload: null,
  generateProof: null,
  proofData: null,
  zkp2pClient: null,
};

const Zkp2pContext = createContext<Zkp2pValues>(defaultValues);

export default Zkp2pContext;
