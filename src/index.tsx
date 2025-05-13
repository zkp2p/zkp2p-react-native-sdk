// index.ts ― updated
import { createClient, getClient } from './client';
import { useZkp2p } from './hooks/useZkp2p';
import { Zkp2pProvider, Zkp2pContext } from './providers';

export { createClient, getClient, useZkp2p, Zkp2pProvider, Zkp2pContext };

export type {
  ExtractedItemsList,
  NetworkEvent,
  ProviderSettings,
  SignalIntentParams,
  FulfillIntentParams,
  SignalIntentResponse,
  AuthWVOverrides,
} from './types';
