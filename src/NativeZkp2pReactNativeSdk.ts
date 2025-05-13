import type { CreateClaimResponse } from '@zkp2p/reclaim-witness-sdk';
import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';
import type {
  ProviderSettings,
  ExtractedItemsList,
  NetworkEvent,
} from './types';

export interface Spec extends TurboModule {
  startAuthentication(provider: ProviderSettings): Promise<void>;
  handleSuccess(provider: ProviderSettings): Promise<void>;
  handleError(errorMessage: string): Promise<void>;
  generateProof(
    provider: ProviderSettings,
    transaction: ExtractedItemsList,
    interceptedPayload: NetworkEvent,
    intentHash: string
  ): Promise<CreateClaimResponse>;
  handleIntercept(event: NetworkEvent): Promise<void>;
  extractTransactionsData(
    provider: ProviderSettings,
    jsonResponseBody: string
  ): Promise<ExtractedItemsList[]>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('Zkp2pReactNativeSdk');
