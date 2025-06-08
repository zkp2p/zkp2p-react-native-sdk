import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  executeZkFunction(
    requestId: string,
    functionName: string,
    args: string[],
    algorithm: string
  ): Promise<void>;

  executeOprfFunction(
    requestId: string,
    functionName: string,
    args: string[],
    algorithm: string
  ): Promise<void>;

  // Event emitter methods are handled automatically by TurboModule
  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('Zkp2pGnarkModule');
