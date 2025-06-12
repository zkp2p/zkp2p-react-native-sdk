import { NativeEventEmitter } from 'react-native';
import type { Spec as GnarkModuleSpec } from '../NativeZkp2pGnarkModule';

export interface GnarkProofResult {
  proof: string;
  publicSignals: string;
}

/**
 * Bridge for gnark proving operations.
 * Handles communication with native gnark libraries.
 */
export class GnarkBridge {
  private eventEmitter: NativeEventEmitter;
  private responseListeners: Map<string, (data: any) => void>;
  private nativeModule: GnarkModuleSpec;

  constructor(nativeModule: GnarkModuleSpec) {
    if (!nativeModule) {
      throw new Error(
        '[GnarkBridge] Native module not provided. Make sure the native module is available.'
      );
    }

    this.nativeModule = nativeModule;

    // Create event emitter with the native module
    this.eventEmitter = new NativeEventEmitter(nativeModule as any);
    this.responseListeners = new Map();

    // Set up global event listener
    this.eventEmitter.addListener('GnarkRPCResponse', (event) => {
      const { id, response, error } = event;
      const listener = this.responseListeners.get(id);
      if (listener) {
        listener({ response, error });
        this.responseListeners.delete(id);
      }
    });
  }

  /**
   * Generate a proof using gnark
   * @param witness The witness as a JSON string
   * @param algorithm The encryption algorithm to use (e.g. 'aes-256-ctr', 'aes-128-ctr', 'chacha20')
   * @returns Promise resolving to proof and public signals
   */
  async prove(witness: string, algorithm: string): Promise<GnarkProofResult> {
    const requestId = Math.random().toString(36).substring(7);

    return new Promise((resolve, reject) => {
      // Set up response listener
      this.responseListeners.set(requestId, ({ response, error }) => {
        if (error) {
          reject(new Error(error.message || 'Proof generation failed'));
        } else {
          resolve(response as GnarkProofResult);
        }
      });

      this.nativeModule
        .executeZkFunction(requestId, 'groth16Prove', [witness], algorithm)
        .catch((err: Error) => {
          this.responseListeners.delete(requestId);
          reject(err);
        });
    });
  }

  dispose(): void {
    this.eventEmitter.removeAllListeners('GnarkRPCResponse');
    this.responseListeners.clear();
  }
}
