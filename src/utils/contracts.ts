export const ESCROW_ABI = [
  {
    inputs: [
      {
        internalType: 'address',
        name: '_owner',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: '_chainId',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: '_intentExpirationPeriod',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: '_sustainabilityFee',
        type: 'uint256',
      },
      {
        internalType: 'address',
        name: '_sustainabilityFeeRecipient',
        type: 'address',
      },
    ],
    stateMutability: 'nonpayable',
    type: 'constructor',
  },
  {
    inputs: [
      {
        internalType: 'bytes',
        name: '_paymentProof',
        type: 'bytes',
      },
      {
        internalType: 'bytes32',
        name: '_intentHash',
        type: 'bytes32',
      },
    ],
    name: 'fulfillIntent',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '_depositId',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: '_amount',
        type: 'uint256',
      },
      {
        internalType: 'address',
        name: '_to',
        type: 'address',
      },
      {
        internalType: 'address',
        name: '_verifier',
        type: 'address',
      },
      {
        internalType: 'bytes32',
        name: '_fiatCurrency',
        type: 'bytes32',
      },
      {
        internalType: 'bytes',
        name: '_gatingServiceSignature',
        type: 'bytes',
      },
    ],
    name: 'signalIntent',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'contract IERC20',
        name: '_token',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: '_amount',
        type: 'uint256',
      },
      {
        components: [
          {
            internalType: 'uint256',
            name: 'min',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'max',
            type: 'uint256',
          },
        ],
        internalType: 'struct IEscrow.Range',
        name: '_intentAmountRange',
        type: 'tuple',
      },
      {
        internalType: 'address[]',
        name: '_verifiers',
        type: 'address[]',
      },
      {
        components: [
          {
            internalType: 'address',
            name: 'intentGatingService',
            type: 'address',
          },
          {
            internalType: 'string',
            name: 'payeeDetails',
            type: 'string',
          },
          {
            internalType: 'bytes',
            name: 'data',
            type: 'bytes',
          },
        ],
        internalType: 'struct IEscrow.DepositVerifierData[]',
        name: '_verifierData',
        type: 'tuple[]',
      },
      {
        components: [
          {
            internalType: 'bytes32',
            name: 'code',
            type: 'bytes32',
          },
          {
            internalType: 'uint256',
            name: 'conversionRate',
            type: 'uint256',
          },
        ],
        internalType: 'struct IEscrow.Currency[][]',
        name: '_currencies',
        type: 'tuple[][]',
      },
    ],
    name: 'createDeposit',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '_depositId',
        type: 'uint256',
      },
    ],
    name: 'getDeposit',
    outputs: [
      {
        components: [
          {
            internalType: 'uint256',
            name: 'depositId',
            type: 'uint256',
          },
          {
            components: [
              {
                internalType: 'address',
                name: 'depositor',
                type: 'address',
              },
              {
                internalType: 'contract IERC20',
                name: 'token',
                type: 'address',
              },
              {
                internalType: 'uint256',
                name: 'amount',
                type: 'uint256',
              },
              {
                components: [
                  {
                    internalType: 'uint256',
                    name: 'min',
                    type: 'uint256',
                  },
                  {
                    internalType: 'uint256',
                    name: 'max',
                    type: 'uint256',
                  },
                ],
                internalType: 'struct IEscrow.Range',
                name: 'intentAmountRange',
                type: 'tuple',
              },
              {
                internalType: 'bool',
                name: 'acceptingIntents',
                type: 'bool',
              },
              {
                internalType: 'uint256',
                name: 'remainingDeposits',
                type: 'uint256',
              },
              {
                internalType: 'uint256',
                name: 'outstandingIntentAmount',
                type: 'uint256',
              },
              {
                internalType: 'bytes32[]',
                name: 'intentHashes',
                type: 'bytes32[]',
              },
            ],
            internalType: 'struct IEscrow.Deposit',
            name: 'deposit',
            type: 'tuple',
          },
          {
            internalType: 'uint256',
            name: 'availableLiquidity',
            type: 'uint256',
          },
          {
            components: [
              {
                internalType: 'address',
                name: 'verifier',
                type: 'address',
              },
              {
                components: [
                  {
                    internalType: 'address',
                    name: 'intentGatingService',
                    type: 'address',
                  },
                  {
                    internalType: 'string',
                    name: 'payeeDetails',
                    type: 'string',
                  },
                  {
                    internalType: 'bytes',
                    name: 'data',
                    type: 'bytes',
                  },
                ],
                internalType: 'struct IEscrow.DepositVerifierData',
                name: 'verificationData',
                type: 'tuple',
              },
              {
                components: [
                  {
                    internalType: 'bytes32',
                    name: 'code',
                    type: 'bytes32',
                  },
                  {
                    internalType: 'uint256',
                    name: 'conversionRate',
                    type: 'uint256',
                  },
                ],
                internalType: 'struct IEscrow.Currency[]',
                name: 'currencies',
                type: 'tuple[]',
              },
            ],
            internalType: 'struct IEscrow.VerifierDataView[]',
            name: 'verifiers',
            type: 'tuple[]',
          },
        ],
        internalType: 'struct IEscrow.DepositView',
        name: 'depositView',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'bytes32',
        name: '_intentHash',
        type: 'bytes32',
      },
    ],
    name: 'getIntent',
    outputs: [
      {
        components: [
          {
            internalType: 'bytes32',
            name: 'intentHash',
            type: 'bytes32',
          },
          {
            components: [
              {
                internalType: 'address',
                name: 'owner',
                type: 'address',
              },
              {
                internalType: 'address',
                name: 'to',
                type: 'address',
              },
              {
                internalType: 'uint256',
                name: 'depositId',
                type: 'uint256',
              },
              {
                internalType: 'uint256',
                name: 'amount',
                type: 'uint256',
              },
              {
                internalType: 'uint256',
                name: 'timestamp',
                type: 'uint256',
              },
              {
                internalType: 'address',
                name: 'paymentVerifier',
                type: 'address',
              },
              {
                internalType: 'bytes32',
                name: 'fiatCurrency',
                type: 'bytes32',
              },
              {
                internalType: 'uint256',
                name: 'conversionRate',
                type: 'uint256',
              },
            ],
            internalType: 'struct IEscrow.Intent',
            name: 'intent',
            type: 'tuple',
          },
          {
            components: [
              {
                internalType: 'uint256',
                name: 'depositId',
                type: 'uint256',
              },
              {
                components: [
                  {
                    internalType: 'address',
                    name: 'depositor',
                    type: 'address',
                  },
                  {
                    internalType: 'contract IERC20',
                    name: 'token',
                    type: 'address',
                  },
                  {
                    internalType: 'uint256',
                    name: 'amount',
                    type: 'uint256',
                  },
                  {
                    components: [
                      {
                        internalType: 'uint256',
                        name: 'min',
                        type: 'uint256',
                      },
                      {
                        internalType: 'uint256',
                        name: 'max',
                        type: 'uint256',
                      },
                    ],
                    internalType: 'struct IEscrow.Range',
                    name: 'intentAmountRange',
                    type: 'tuple',
                  },
                  {
                    internalType: 'bool',
                    name: 'acceptingIntents',
                    type: 'bool',
                  },
                  {
                    internalType: 'uint256',
                    name: 'remainingDeposits',
                    type: 'uint256',
                  },
                  {
                    internalType: 'uint256',
                    name: 'outstandingIntentAmount',
                    type: 'uint256',
                  },
                  {
                    internalType: 'bytes32[]',
                    name: 'intentHashes',
                    type: 'bytes32[]',
                  },
                ],
                internalType: 'struct IEscrow.Deposit',
                name: 'deposit',
                type: 'tuple',
              },
              {
                internalType: 'uint256',
                name: 'availableLiquidity',
                type: 'uint256',
              },
              {
                components: [
                  {
                    internalType: 'address',
                    name: 'verifier',
                    type: 'address',
                  },
                  {
                    components: [
                      {
                        internalType: 'address',
                        name: 'intentGatingService',
                        type: 'address',
                      },
                      {
                        internalType: 'string',
                        name: 'payeeDetails',
                        type: 'string',
                      },
                      {
                        internalType: 'bytes',
                        name: 'data',
                        type: 'bytes',
                      },
                    ],
                    internalType: 'struct IEscrow.DepositVerifierData',
                    name: 'verificationData',
                    type: 'tuple',
                  },
                  {
                    components: [
                      {
                        internalType: 'bytes32',
                        name: 'code',
                        type: 'bytes32',
                      },
                      {
                        internalType: 'uint256',
                        name: 'conversionRate',
                        type: 'uint256',
                      },
                    ],
                    internalType: 'struct IEscrow.Currency[]',
                    name: 'currencies',
                    type: 'tuple[]',
                  },
                ],
                internalType: 'struct IEscrow.VerifierDataView[]',
                name: 'verifiers',
                type: 'tuple[]',
              },
            ],
            internalType: 'struct IEscrow.DepositView',
            name: 'deposit',
            type: 'tuple',
          },
        ],
        internalType: 'struct IEscrow.IntentView',
        name: 'intentView',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;
