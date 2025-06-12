import { ethers, utils } from 'ethers';
import canonicalize from 'canonicalize';

export interface ReclaimProof {
  claimInfo: ClaimInfo;
  signedClaim: SignedClaim;
  isAppclipProof: boolean;
}

export interface ClaimInfo {
  provider: string;
  parameters: string;
  context: string;
}

export interface CompleteClaimData {
  identifier: string;
  owner: string;
  timestampS: bigint;
  epoch: bigint;
}

export interface SignedClaim {
  claim: CompleteClaimData;
  signatures: string[];
}

export const parseReclaimProxyProof = (proofObject: any) => {
  return {
    claimInfo: {
      provider: proofObject.claimData.provider,
      parameters: proofObject.claimData.parameters,
      context: proofObject.claimData.context,
    },
    signedClaim: {
      claim: {
        identifier: proofObject.claimData.identifier,
        owner: proofObject.claimData.owner,
        timestampS: BigInt(proofObject.claimData.timestampS),
        epoch: BigInt(proofObject.claimData.epoch),
      },
      signatures: proofObject.signatures,
    },
    isAppclipProof: false,
  } as ReclaimProof;
};

const PROOF_ENCODING_STRING =
  '(tuple(string provider, string parameters, string context) claimInfo, tuple(tuple(bytes32 identifier, address owner, uint32 timestampS, uint32 epoch) claim, bytes[] signatures) signedClaim, bool isAppclipProof)';

export const encodeProofAsBytes = (proof: ReclaimProof) => {
  return ethers.utils.defaultAbiCoder.encode([PROOF_ENCODING_STRING], [proof]);
};

export const encodeProofAndPaymentMethodAsBytes = (
  proof: ReclaimProof,
  paymentMethod: number
) => {
  return ethers.utils.defaultAbiCoder.encode(
    [PROOF_ENCODING_STRING, 'uint8'],
    [proof, paymentMethod]
  );
};

/**
 * Creates the standard string to sign for a claim.
 * This data is what the witness will sign when it successfully
 * verifies a claim.
 */
export function createSignDataForClaim(data: CompleteClaimData) {
  const identifier =
    'identifier' in data ? data.identifier : getIdentifierFromClaimInfo(data);
  const lines = [
    identifier,
    // we lowercase the owner to ensure that the
    // ETH addresses always serialize the same way
    data.owner.toLowerCase(),
    data.timestampS.toString(),
    data.epoch.toString(),
  ];

  return lines.join('\n');
}

/**
 * Generates a unique identifier for given claim info
 * @param info
 * @returns
 */
export function getIdentifierFromClaimInfo(info: ClaimInfo): string {
  //re-canonicalize context if it's not empty
  if (info.context?.length > 0) {
    try {
      const ctx = JSON.parse(info.context);
      info.context = canonicalize(ctx)!;
    } catch (e) {
      throw new Error('unable to parse non-empty context. Must be JSON');
    }
  }

  const str = `${info.provider}\n${info.parameters}\n${info.context || ''}`;

  return utils.keccak256(new TextEncoder().encode(str)).toLowerCase();
}
