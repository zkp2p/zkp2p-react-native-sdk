import type { Hash, PublicClient, WalletClient } from 'viem';
import { ESCROW_ABI } from '../utils/contracts';
import type { FulfillIntentParams } from '../types';
import {
  encodeProofAndPaymentMethodAsBytes,
  encodeProofAsBytes,
} from '../utils/reclaimProof';

export async function fulfillIntent(
  walletClient: WalletClient,
  publicClient: PublicClient,
  escrowAddress: string,
  params: FulfillIntentParams
): Promise<Hash> {
  try {
    const proof = params.paymentProof.proof;

    let proofBytes: `0x${string}`;
    if (params.paymentMethod) {
      proofBytes = encodeProofAndPaymentMethodAsBytes(
        proof,
        params.paymentMethod
      ) as `0x${string}`;
    } else {
      proofBytes = encodeProofAsBytes(proof) as `0x${string}`;
    }

    const { request } = await publicClient.simulateContract({
      address: escrowAddress as `0x${string}`,
      abi: ESCROW_ABI,
      functionName: 'fulfillIntent',
      args: [proofBytes, params.intentHash],
      account: walletClient.account,
    });

    const hash = await walletClient.writeContract(request);

    if (params.onSuccess) {
      params.onSuccess({ hash });
    }

    if (params.onMined) {
      await publicClient.waitForTransactionReceipt({ hash });
      params.onMined({ hash });
    }

    return hash;
  } catch (error) {
    if (params.onError) {
      params.onError(error as Error);
    }
    throw error;
  }
}
