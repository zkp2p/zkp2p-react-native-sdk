import { createContext } from 'react';
import type {
  ProviderSettings,
  NetworkEvent,
  ExtractedItemsList,
  ProofData,
} from '../types';
import type { Zkp2pClient } from '../client';

export interface Zkp2pValues {
  /* auth */
  provider: ProviderSettings | null;
  isAuthenticating: boolean;
  authError: Error | null;
  startAuthentication:
    | ((platform: string, actionType: string) => Promise<ProviderSettings>)
    | null;
  authWebViewProps: any;
  closeAuthWebView: (() => void) | null;

  /* tx */
  itemsList: ExtractedItemsList[];

  /* auth state */
  isAuthenticated: boolean;
  interceptedPayload: NetworkEvent | null;

  /* proof */
  generateReclaimProof:
    | ((
        providerCfg: ProviderSettings,
        payload: NetworkEvent,
        intentHash: string,
        itemIndex?: number
      ) => Promise<any>)
    | null;
  isGeneratingProof: boolean;
  proofData: ProofData | null;

  /* client */
  zkp2pClient: Zkp2pClient | null;
}

const defaultValues: Zkp2pValues = {
  provider: null,
  isAuthenticating: false,
  authError: null,
  startAuthentication: null,
  authWebViewProps: null,
  closeAuthWebView: null,
  itemsList: [],
  isAuthenticated: false,
  interceptedPayload: null,
  generateReclaimProof: null,
  isGeneratingProof: false,
  proofData: null,
  zkp2pClient: null,
};

const Zkp2pContext = createContext<Zkp2pValues>(defaultValues);

export default Zkp2pContext;
