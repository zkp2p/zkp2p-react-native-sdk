import type { Hash, PublicClient, WalletClient } from 'viem';
import { ESCROW_ABI } from '../utils/contracts';
import type { CancelIntentParams } from '../types';

export async function cancelIntent(
  walletClient: WalletClient,
  publicClient: PublicClient,
  escrowAddress: string,
  params: CancelIntentParams
): Promise<Hash> {
  try {
    const { request } = await publicClient.simulateContract({
      address: escrowAddress as `0x${string}`,
      abi: ESCROW_ABI,
      functionName: 'cancelIntent',
      args: [params.intentHash],
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
