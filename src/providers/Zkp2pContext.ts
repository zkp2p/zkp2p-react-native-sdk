import { createContext } from 'react';
import type {
  ProviderSettings,
  NetworkEvent,
  ExtractedItemsList,
} from '../types';
import type { CreateClaimResponse } from '@zkp2p/reclaim-witness-sdk';
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
  generateProof:
    | ((
        providerCfg: ProviderSettings,
        payload: NetworkEvent,
        intentHash: string,
        itemIndex?: number
      ) => Promise<any>)
    | null;
  isGeneratingProof: boolean;
  claimData: CreateClaimResponse | null;

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
  generateProof: null,
  isGeneratingProof: false,
  claimData: null,
  zkp2pClient: null,
};

const Zkp2pContext = createContext<Zkp2pValues>(defaultValues);

export default Zkp2pContext;
