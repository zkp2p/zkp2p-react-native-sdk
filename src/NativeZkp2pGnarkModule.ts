import { NativeModules } from 'react-native';

export interface Spec {
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

  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

export default NativeModules.Zkp2pGnarkModule as Spec;
