import type { Address, Hash } from 'viem';

export type Range = {
  min: bigint;
  max: bigint;
};

export type DepositVerifierData = {
  intentGatingService: Address;
  payeeDetails: string;
  data: Hash;
};

export type Currency = {
  code: Hash;
  conversionRate: bigint;
};

export type Deposit = {
  depositor: Address;
  token: Address;
  amount: bigint;
  intentAmountRange: Range;
  acceptingIntents: boolean;
  remainingDeposits: bigint;
  outstandingIntentAmount: bigint;
  intentHashes: readonly Hash[];
};

export type Intent = {
  owner: Address;
  to: Address;
  depositId: bigint;
  amount: bigint;
  timestamp: bigint;
  paymentVerifier: Address;
  fiatCurrency: Hash;
  conversionRate: bigint;
};

export type VerifierDataView = {
  verifier: Address;
  verificationData: DepositVerifierData;
  currencies: readonly Currency[];
};

export type DepositView = {
  depositId: bigint;
  deposit: Deposit;
  availableLiquidity: bigint;
  verifiers: readonly VerifierDataView[];
};

export type IntentView = {
  intentHash: Hash;
  intent: Intent;
  deposit: DepositView;
};
