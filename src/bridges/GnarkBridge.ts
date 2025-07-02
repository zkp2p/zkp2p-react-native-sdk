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
  private activeRequestIds: Set<string>;

  constructor(nativeModule: GnarkModuleSpec) {
    if (!nativeModule) {
      throw new Error(
        '[GnarkBridge] Native module not provided. Make sure the native module is available.'
      );
    }

    this.nativeModule = nativeModule;

    this.eventEmitter = new NativeEventEmitter(nativeModule as any);
    this.responseListeners = new Map();
    this.activeRequestIds = new Set();

    this.eventEmitter.addListener('GnarkRPCResponse', (event) => {
      console.log('[GnarkBridge] Received event:', event.id, event.type);

      const { id, response, error } = event;
      const listener = this.responseListeners.get(id);
      if (listener) {
        listener({ response, error });
        this.responseListeners.delete(id);
        this.activeRequestIds.delete(id);
      } else {
        console.warn('[GnarkBridge] No listener found for request:', id);
      }
    });
  }

  /**
   * Generate a proof using gnark
   * @param witness The witness as a JSON string
   * @param algorithm The encryption algorithm to use (e.g. 'aes-256-ctr', 'aes-128-ctr', 'chacha20')
   * @returns Promise resolving to proof result with request ID
   */
  async prove(
    witness: string,
    algorithm: string
  ): Promise<GnarkProofResult & { requestId: string }> {
    const requestId = Math.random().toString(36).substring(7);

    return new Promise((resolve, reject) => {
      this.activeRequestIds.add(requestId);

      this.responseListeners.set(requestId, ({ response, error }) => {
        console.log('[GnarkBridge] Received response for:', requestId);
        this.activeRequestIds.delete(requestId);

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
            resolve({ ...response, requestId } as GnarkProofResult & {
              requestId: string;
            });
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
          this.activeRequestIds.delete(requestId);
          reject(err);
        });
    });
  }

  /**
   * Cancel an active proof generation
   * @param requestId The request ID of the proof to cancel
   * @returns Promise resolving when cancellation is complete
   */
  async cancelProofGeneration(requestId: string): Promise<void> {
    console.log('[GnarkBridge] Cancelling proof generation for:', requestId);

    // Remove the listener if it exists
    if (this.responseListeners.has(requestId)) {
      this.responseListeners.delete(requestId);
      this.activeRequestIds.delete(requestId);
    }

    try {
      // Call native module to cancel
      await (this.nativeModule as any).cancelProofGeneration(requestId);
    } catch (err) {
      console.error('[GnarkBridge] Error cancelling proof generation:', err);
      throw err;
    }
  }

  /**
   * Cancel all active proof generations
   * @returns Promise resolving when all cancellations are complete
   */
  async cancelAllProofs(): Promise<void> {
    console.log('[GnarkBridge] Cancelling all active proofs');

    const activeIds = Array.from(this.activeRequestIds);

    // Cancel all active requests
    await Promise.all(
      activeIds.map((requestId) => this.cancelProofGeneration(requestId))
    );
  }

  /**
   * Clean up memory and resources
   * @returns Promise resolving when cleanup is complete
   */
  async cleanupMemory(): Promise<void> {
    console.log('[GnarkBridge] Cleaning up memory');

    // Cancel all active proofs first
    await this.cancelAllProofs();

    try {
      // Call native module to clean up memory
      await (this.nativeModule as any).cleanupMemory();
    } catch (err) {
      console.error('[GnarkBridge] Error cleaning up memory:', err);
      throw err;
    }
  }

  /**
   * Get the current request ID for the last proof request
   * @returns The current request ID or null if no active request
   */
  getCurrentRequestId(): string | null {
    const activeIds = Array.from(this.activeRequestIds);
    return activeIds.length > 0 ? activeIds[activeIds.length - 1]! : null;
  }

  dispose(): void {
    // Cancel all active proofs before disposing
    this.cancelAllProofs().catch((err) => {
      console.error(
        '[GnarkBridge] Error cancelling proofs during disposal:',
        err
      );
    });

    this.eventEmitter.removeAllListeners('GnarkRPCResponse');
    this.responseListeners.clear();
    this.activeRequestIds.clear();
  }
}
