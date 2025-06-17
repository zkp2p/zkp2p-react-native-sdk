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

    this.eventEmitter = new NativeEventEmitter(nativeModule as any);
    this.responseListeners = new Map();

    this.eventEmitter.addListener('GnarkRPCResponse', (event) => {
      console.log('[GnarkBridge] Received event:', event.id, event.type);

      const { id, response, error } = event;
      const listener = this.responseListeners.get(id);
      if (listener) {
        listener({ response, error });
        this.responseListeners.delete(id);
      } else {
        console.warn('[GnarkBridge] No listener found for request:', id);
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
      this.responseListeners.set(requestId, ({ response, error }) => {
        console.log('[GnarkBridge] Received response for:', requestId);

        if (error) {
          reject(new Error(error.message || 'Proof generation failed'));
        } else {
          if (!response || !response.proof || !response.publicSignals) {
            console.error(
              '[GnarkBridge] Invalid response structure:',
              response
            );
            reject(
              new Error(
                'Invalid proof response: missing proof or publicSignals'
              )
            );
          } else {
            resolve(response as GnarkProofResult);
          }
        }
      });

      console.log(
        '[GnarkBridge] Calling native groth16Prove with algorithm:',
        algorithm
      );

      this.nativeModule
        .executeZkFunction(requestId, 'groth16Prove', [witness], algorithm)
        .catch((err: Error) => {
          console.error('[GnarkBridge] Native module error:', err);
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
