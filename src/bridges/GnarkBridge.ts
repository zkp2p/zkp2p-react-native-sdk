import { NativeEventEmitter } from 'react-native';
import NativeZkp2pGnarkModule from '../NativeZkp2pGnarkModule';

export interface GnarkWitness {
  cipher: string;
  key?: string;
  nonce: string;
  counter: number;
  input: string;
  toprf?: any;
}

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

  constructor() {
    console.log('[GnarkBridge] Initializing. Checking for native module...');
    console.log(
      '[GnarkBridge] NativeZkp2pGnarkModule is:',
      NativeZkp2pGnarkModule
    );

    if (!NativeZkp2pGnarkModule) {
      throw new Error(
        '[GnarkBridge] Native module Zkp2pGnarkModule not available. Make sure you have rebuilt the app.'
      );
    }

    console.log('[GnarkBridge] Native module loaded successfully');

    // Create event emitter with the native module
    this.eventEmitter = new NativeEventEmitter(NativeZkp2pGnarkModule as any);
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
   * @param witness The witness object or Uint8Array containing cipher, key, nonce, counter, input
   * @returns Promise resolving to proof and public signals
   */
  async prove(witness: GnarkWitness | Uint8Array): Promise<GnarkProofResult> {
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

      // Handle witness format
      let witnessJson: string;
      if (witness instanceof Uint8Array) {
        // If it's a Uint8Array, assume it's already JSON stringified
        witnessJson = new TextDecoder().decode(witness);
      } else {
        // Convert witness object to JSON string
        witnessJson = JSON.stringify(witness);
      }

      // Extract cipher from witness for the algorithm parameter
      let cipher = 'aes-256-ctr'; // default
      try {
        const parsed = JSON.parse(witnessJson);
        if (parsed.cipher) {
          cipher = parsed.cipher;
        }
      } catch (e) {
        // If parsing fails, use default
      }

      // Call native method
      NativeZkp2pGnarkModule.executeZkFunction(
        requestId,
        'groth16Prove',
        [witnessJson],
        cipher
      ).catch((err: Error) => {
        this.responseListeners.delete(requestId);
        reject(err);
      });
    });
  }

  /**
   * Verify a proof using gnark
   * @param cipher The cipher algorithm used
   * @param proof The proof to verify (base64 string)
   * @param publicSignals The public signals (base64 string)
   * @returns Promise resolving to boolean indicating if proof is valid
   */
  async verify(
    cipher: string,
    proof: string,
    publicSignals: string
  ): Promise<boolean> {
    const requestId = Math.random().toString(36).substring(7);

    return new Promise((resolve, reject) => {
      // Set up response listener
      this.responseListeners.set(requestId, ({ response, error }) => {
        if (error) {
          reject(new Error(error.message || 'Verification failed'));
        } else {
          resolve(response.valid === true);
        }
      });

      // Format verification parameters
      const verifyParams = JSON.stringify({
        cipher,
        proof,
        publicSignals,
      });

      // Call native method
      NativeZkp2pGnarkModule.executeZkFunction(
        requestId,
        'groth16Verify',
        [verifyParams],
        cipher
      ).catch((err: Error) => {
        this.responseListeners.delete(requestId);
        reject(err);
      });
    });
  }

  /**
   * Helper method to convert Uint8Array to base64
   */
  static toBase64(data: Uint8Array): string {
    return btoa(String.fromCharCode(...data));
  }

  /**
   * Helper method to convert base64 to Uint8Array
   */
  static fromBase64(data: string): Uint8Array {
    return new Uint8Array(
      atob(data)
        .split('')
        .map((c) => c.charCodeAt(0))
    );
  }

  dispose(): void {
    this.eventEmitter.removeAllListeners('GnarkRPCResponse');
    this.responseListeners.clear();
  }
}
