import { BigNumber } from 'ethers';

/*
  struct Range {
    uint256 min;
    uint256 max;
  }
*/
export interface EscrowRange {
  min: BigNumber;
  max: BigNumber;
}

/*
  struct Deposit {
    address depositor;                          // Address of depositor
    IERC20 token;                               // Address of deposit token
    uint256 amount;                             // Amount of deposit token
    Range intentAmountRange;                    // Range of take amount per intent
    bool acceptingIntents;                      // State: True if the deposit is accepting intents, False otherwise
    uint256 remainingDeposits;                  // State: Amount of remaining deposited liquidity
    uint256 outstandingIntentAmount;            // State: Amount of outstanding intents (may include expired intents)
    bytes32[] intentHashes;                     // State: Array of hashes of all open intents (may include some expired if not pruned)
  }
*/
export interface EscrowDeposit {
  depositor: string;
  token: string;
  depositAmount: BigNumber;
  intentAmountRange: EscrowRange;
  acceptingIntents: boolean;
  remainingDepositAmount: BigNumber;
  outstandingIntentAmount: BigNumber;
  intentHashes: string[];
}

/*
  struct Intent {
    address owner;
    address to;
    uint256 depositId;
    uint256 amount;
    uint256 timestamp;
    address paymentVerifier;
    bytes32 fiatCurrency;
    uint256 conversionRate;
  }
*/
export interface EscrowIntent {
  owner: string;
  to: string;
  depositId: BigNumber;
  amount: BigNumber;
  timestamp: BigNumber;
  paymentVerifier: string;
  fiatCurrency: string;
  conversionRate: BigNumber;
}

/*
  struct Currency {
    bytes32 code;
    uint256 conversionRate;
  }
*/
export interface EscrowCurrency {
  code: string;
  conversionRate: BigNumber;
}

/*
  struct DepositVerifierData {
    address intentGatingService;
    string payeeDetails;
    bytes data;
  }
*/
export interface EscrowDepositVerifierData {
  intentGatingService: string;
  payeeDetails: string;
  data: string;
}

/*
  struct VerifierDataView {
    address verifier;
    DepositVerifierData verificationData;
    Currency[] currencies;
  }
*/
export interface EscrowVerifierDataView {
  verifier: string;
  verificationData: EscrowDepositVerifierData;
  currencies: EscrowCurrency[];
}

/*
  struct DepositView {
    uint256 depositId;
    Deposit deposit;
    uint256 availableLiquidity;
    VerifierDataView[] verifiers;
  }
*/
export interface EscrowDepositView {
  depositId: BigNumber;
  deposit: EscrowDeposit;
  availableLiquidity: BigNumber;
  verifiers: EscrowVerifierDataView[];
}

/*
  struct IntentView {
    bytes32 intentHash;
    Intent intent;
    DepositView deposit;
  }
*/
export interface EscrowIntentView {
  intentHash: string;
  intent: EscrowIntent;
  deposit: EscrowDepositView;
}
