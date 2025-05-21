import type { CreateClaimResponse } from '@zkp2p/reclaim-witness-sdk';
import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  startAuthentication(provider: Object): Promise<void>;
  handleSuccess(provider: Object): Promise<void>;
  handleError(errorMessage: string): Promise<void>;
  generateProof(
    provider: Object,
    transaction: Object,
    interceptedPayload: Object,
    intentHash: string
  ): Promise<CreateClaimResponse>;
  handleIntercept(event: Object): Promise<void>;
  extractTransactionsData(
    provider: Object,
    jsonResponseBody: string
  ): Promise<Object[]>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('Zkp2pReactNativeSdk');
