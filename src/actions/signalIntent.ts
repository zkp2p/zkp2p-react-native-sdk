import type { Hash, PublicClient, WalletClient } from 'viem';
import { ESCROW_ABI } from '../utils/contracts';
import type {
  IntentSignalRequest,
  SignalIntentParams,
  SignalIntentResponse,
} from '../types';
import { apiSignalIntent } from '../adapters/api';
import { currencyInfo } from '../utils/currency';

export async function signalIntent(
  walletClient: WalletClient,
  publicClient: PublicClient,
  escrowAddress: string,
  chainId: number,
  params: SignalIntentParams,
  apiKey: string,
  baseApiUrl: string
): Promise<SignalIntentResponse & { txHash?: Hash }> {
  try {
    const currencyCodeHash = currencyInfo[params.currency]?.currencyCodeHash;
    if (!currencyCodeHash) {
      throw new Error(`Currency code ${params.currency} not found`);
    }
    // First, call the API to verify and get signed intent
    const apiRequest: IntentSignalRequest = {
      processorName: params.processorName,
      depositId: params.depositId,
      tokenAmount: params.tokenAmount,
      payeeDetails: params.payeeDetails,
      toAddress: params.toAddress,
      fiatCurrencyCode: currencyCodeHash,
      chainId: chainId.toString(),
    };
    const apiResponse = await apiSignalIntent(apiRequest, apiKey, baseApiUrl);
    if (!apiResponse.success) {
      throw new Error(apiResponse.message);
    }

    const intentData = apiResponse.responseObject.intentData;

    // Then, call the escrow contract
    const { request } = await publicClient.simulateContract({
      address: escrowAddress as `0x${string}`,
      abi: ESCROW_ABI,
      functionName: 'signalIntent',
      args: [
        BigInt(intentData.depositId),
        BigInt(intentData.tokenAmount),
        intentData.recipientAddress as `0x${string}`,
        intentData.verifierAddress as `0x${string}`,
        intentData.currencyCodeHash as `0x${string}`,
        intentData.gatingServiceSignature as `0x${string}`,
      ],
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

    return { ...apiResponse, txHash: hash };
  } catch (error) {
    if (params.onError) {
      params.onError(error as Error);
    }
    throw error;
  }
}
