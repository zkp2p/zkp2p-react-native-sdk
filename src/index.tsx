import { createClient, getClient } from './client';
import { useZkp2p } from './hooks/useZkp2p';
import { AuthenticationWebView } from './components/AuthenticationWebView';
import { RPCWebView } from './components/RPCWebView';
import type {
  ExtractedTransaction,
  NetworkEvent,
  ProviderSettings,
  SignalIntentParams,
  FulfillIntentParams,
  SignalIntentResponse,
} from './types';

export { createClient, getClient, useZkp2p, AuthenticationWebView, RPCWebView };

export type {
  ExtractedTransaction,
  NetworkEvent,
  ProviderSettings,
  SignalIntentParams,
  FulfillIntentParams,
  SignalIntentResponse,
};
