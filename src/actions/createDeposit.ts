import type { Hash, PublicClient, WalletClient } from 'viem';
import { ESCROW_ABI, ERC20_ABI } from '../utils/contracts';
import type {
  CreateDepositParams,
  PostDepositDetailsRequest,
  DepositVerifierData,
  Currency,
} from '../types';
import { apiPostDepositDetails } from '../adapters/api';
import { DEPLOYED_ADDRESSES } from '../utils/constants';
import { ethers } from 'ethers';
import { currencyInfo } from '../utils/currency';

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
    // Check allowance first
    if (!walletClient.account) {
      throw new Error('Wallet account is required');
    }

    const currentAllowance = (await publicClient.readContract({
      address: params.token as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [walletClient.account.address, escrowAddress as `0x${string}`],
    })) as bigint;

    // If allowance is insufficient, approve
    if (currentAllowance < params.amount) {
      const { request: approveRequest } = await publicClient.simulateContract({
        address: params.token as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [escrowAddress as `0x${string}`, params.amount],
        account: walletClient.account,
      });

      const approveHash = await walletClient.writeContract(approveRequest);

      await publicClient.waitForTransactionReceipt({ hash: approveHash });
    }

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

    const verifierAddresses = params.processorNames.map((processorName) => {
      if (!DEPLOYED_ADDRESSES?.[chainId]?.[processorName]) {
        throw new Error(`Processor name ${processorName} not found`);
      }
      return DEPLOYED_ADDRESSES?.[chainId]?.[processorName];
    });

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

    // Extra verification data is the zkp2p witness signer address
    const witnessData = ethers.utils.defaultAbiCoder.encode(
      ['address[]'],
      [[DEPLOYED_ADDRESSES?.[chainId]?.zkp2pWitnessSigner]]
    );

    const verifierData: DepositVerifierData[] = hashedOnchainIds.map(
      (hashedOnchainId) => {
        return {
          payeeDetails: hashedOnchainId as string,
          intentGatingService: DEPLOYED_ADDRESSES?.[chainId]
            ?.gatingService as `0x${string}`,
          data: witnessData as `0x${string}`,
        };
      }
    );

    const currencies: Currency[][] = params.conversionRates.map(
      (conversionRate) => {
        const currencyCodeHash =
          currencyInfo[conversionRate.currency]?.currencyCodeHash;
        if (!currencyCodeHash) {
          throw new Error(`Currency ${conversionRate.currency} not found`);
        }
        return [
          {
            code: currencyCodeHash as `0x${string}`,
            conversionRate: BigInt(conversionRate.conversionRate),
          },
        ];
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
        verifierAddresses,
        verifierData,
        currencies,
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

    return { depositDetails, hash };
  } catch (error) {
    if (params.onError) {
      params.onError(error as Error);
    }
    throw error;
  }
}
