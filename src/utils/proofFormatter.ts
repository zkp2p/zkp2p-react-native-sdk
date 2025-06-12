/**
 * Utility functions for formatting proof data for verification
 */

/**
 * Convert a base64 string to an array of numbers (uint8 array representation)
 * This is needed because the Go verifier expects []uint8 in JSON
 */
export function base64ToUint8Array(base64: string): number[] {
  // Decode base64 to binary string
  const binaryString = atob(base64);

  // Convert to array of numbers
  const uint8Array = new Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    uint8Array[i] = binaryString.charCodeAt(i);
  }

  return uint8Array;
}

/**
 * Format proof data for Go verification
 * Converts base64 strings to uint8 arrays as expected by the Go verifier
 */
export function formatProofForVerification(
  proof: string,
  publicSignals: string
) {
  return {
    proof: base64ToUint8Array(proof),
    publicSignals: base64ToUint8Array(publicSignals),
  };
}

/**
 * Format verification parameters for the Go verifier
 * @param cipher The cipher algorithm (e.g., 'chacha20', 'aes-128-ctr', 'aes-256-ctr')
 * @param proof Base64-encoded proof string
 * @param publicSignals Base64-encoded public signals string
 */
export function formatVerificationParams(
  cipher: string,
  proof: string,
  publicSignals: string
) {
  const formatted = formatProofForVerification(proof, publicSignals);

  return {
    cipher,
    proof: formatted.proof,
    publicSignals: formatted.publicSignals,
  };
}
