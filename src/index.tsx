// index.ts ― updated
import { useZkp2p } from './hooks/useZkp2p';
import { Zkp2pProvider, Zkp2pContext } from './providers';

export { useZkp2p, Zkp2pProvider, Zkp2pContext };

export type {
  ExtractedItemsList,
  NetworkEvent,
  ProviderSettings,
  SignalIntentParams,
  FulfillIntentParams,
  SignalIntentResponse,
  AuthWVOverrides,
} from './types';
