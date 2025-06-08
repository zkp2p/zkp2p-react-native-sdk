import { NativeEventEmitter } from 'react-native';
import NativeZkp2pGnarkModule from '../NativeZkp2pGnarkModule';

/**
 * Simple wrapper for the Gnark TurboModule.
 * You can also use NativeZkp2pGnarkModule directly if you prefer.
 */
export class GnarkBridge {
  private eventEmitter: NativeEventEmitter;
  private subscription: any;

  constructor() {
    if (!NativeZkp2pGnarkModule) {
      throw new Error(
        '[GnarkBridge] Native module Zkp2pGnarkModule not available. Make sure you have rebuilt the app.'
      );
    }

    console.log('[GnarkBridge] TurboModule loaded successfully');

    // Create event emitter with the TurboModule
    this.eventEmitter = new NativeEventEmitter(NativeZkp2pGnarkModule as any);
  }

  async prove(
    requestId: string,
    witness: string,
    algorithm: string
  ): Promise<void> {
    return NativeZkp2pGnarkModule.executeZkFunction(
      requestId,
      'prove',
      [witness],
      algorithm
    );
  }

  async verify(
    requestId: string,
    publicSignals: string,
    proof: string,
    algorithm: string
  ): Promise<void> {
    return NativeZkp2pGnarkModule.executeZkFunction(
      requestId,
      'verify',
      [publicSignals, proof],
      algorithm
    );
  }

  async executeOprfFunction(
    requestId: string,
    functionName: string,
    args: string[],
    algorithm: string
  ): Promise<void> {
    return NativeZkp2pGnarkModule.executeOprfFunction(
      requestId,
      functionName,
      args,
      algorithm
    );
  }

  onResponse(callback: (data: any) => void): () => void {
    this.subscription = this.eventEmitter.addListener(
      'GnarkRPCResponse',
      callback
    );
    return () => {
      if (this.subscription) {
        this.subscription.remove();
      }
    };
  }

  dispose(): void {
    if (this.subscription) {
      this.subscription.remove();
    }
  }
}
