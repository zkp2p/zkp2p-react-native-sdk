import type { Hash, PublicClient, WalletClient } from 'viem';
import { ESCROW_ABI } from '../utils/contracts';
import type { FulfillIntentParams } from '../types';

export async function fulfillIntent(
  walletClient: WalletClient,
  publicClient: PublicClient,
  escrowAddress: string,
  params: FulfillIntentParams
): Promise<Hash> {
  try {
    const { request } = await publicClient.simulateContract({
      address: escrowAddress as `0x${string}`,
      abi: ESCROW_ABI,
      functionName: 'fulfillIntent',
      args: [params.paymentProof, params.intentHash],
      account: walletClient.account,
    });

    const hash = await walletClient.writeContract(request);

    if (params.onSuccess) {
      params.onSuccess({ hash });
    }

    return hash;
  } catch (error) {
    if (params.onError) {
      params.onError(error as Error);
    }
    throw error;
  }
}
