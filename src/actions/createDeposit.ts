import type { Hash, PublicClient, WalletClient } from 'viem';
import { ESCROW_ABI } from '../utils/contracts';
import type {
  CreateDepositParams,
  PostDepositDetailsRequest,
  DepositVerifierData,
} from '../types';
import { apiPostDepositDetails } from '../adapters/api';
import { DEPLOYED_ADDRESSES } from '../utils/constants';

export async function createDeposit(
  walletClient: WalletClient,
  publicClient: PublicClient,
  escrowAddress: string,
  chainId: number,
  params: CreateDepositParams,
  apiKey: string,
  baseApiUrl: string
): Promise<{ depositDetails: PostDepositDetailsRequest[]; hash: Hash }> {
  try {
    // First, call the API to create deposit details
    const apiResponses = await Promise.all(
      params.processorNames.map((processorName, index) => {
        if (!params.depositData[index]) {
          throw new Error(
            'depositData must have the same length as processorNames'
          );
        }
        return apiPostDepositDetails(
          {
            depositData: params.depositData[index] || {},
            processorName,
          },
          apiKey,
          baseApiUrl
        );
      })
    );
    if (!apiResponses.every((response) => response.success)) {
      throw new Error(
        apiResponses.find((response) => !response.success)?.message ||
          'Failed to create deposit details'
      );
    }

    const hashedOnchainIds = apiResponses.map(
      (response) => response.responseObject.hashedOnchainId
    );
    const depositDetails: PostDepositDetailsRequest[] = params.depositData.map(
      (depositData, index) => {
        const processorName = params.processorNames[index];
        if (!processorName) {
          throw new Error('processorName is required for each deposit data');
        }
        return {
          depositData: depositData || {},
          processorName,
        };
      }
    );

    const verifierData: DepositVerifierData[] = params.extraVerifierData.map(
      (data, index) => {
        if (!hashedOnchainIds[index]) {
          throw new Error(
            'hashedOnchainIds must have the same length as extraVerifierData'
          );
        }
        return {
          payeeDetails: hashedOnchainIds[index] as string,
          intentGatingService: DEPLOYED_ADDRESSES?.[chainId]
            ?.gatingService as `0x${string}`,
          data: data as `0x${string}`,
        };
      }
    );

    // Then, call the escrow contract
    const { request } = await publicClient.simulateContract({
      address: escrowAddress as `0x${string}`,
      abi: ESCROW_ABI,
      functionName: 'createDeposit',
      args: [
        params.token,
        params.amount,
        params.intentAmountRange,
        params.verifiers,
        verifierData,
        params.currencies,
      ],
      account: walletClient.account,
    });

    const hash = await walletClient.writeContract(request);

    if (params.onSuccess) {
      params.onSuccess({ hash });
    }

    return { depositDetails, hash };
  } catch (error) {
    if (params.onError) {
      params.onError(error as Error);
    }
    throw error;
  }
}
