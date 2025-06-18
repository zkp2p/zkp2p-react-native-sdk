# zkp2p-react-native-sdk

React Native SDK for ZKP2P - A peer-to-peer fiat-to-crypto on/off-ramp powered by zero-knowledge proofs.

## Installation

```sh
yarn add @zkp2p/zkp2p-react-native-sdk @react-native-async-storage/async-storage @react-native-cookies/cookies react-native-webview @zkp2p/webview-intercept viem react-native-svg
```

### iOS Setup
```sh
cd ios && pod install
```

## Quick Start

The SDK supports two modes:
- **Full Mode**: Access all features including blockchain operations (requires wallet & API key)
- **Proof-Only Mode**: Generate proofs without wallet or API key

### Full Mode Setup

```tsx
import { Zkp2pProvider, useZkp2p } from '@zkp2p/zkp2p-react-native-sdk';
import { createWalletClient, custom } from 'viem';

// 1. Setup wallet client
const walletClient = createWalletClient({
  chain: base,
  transport: custom(window.ethereum),
});

// 2. Wrap your app with Zkp2pProvider
function App() {
  return (
    <Zkp2pProvider
      walletClient={walletClient}
      apiKey="your-api-key"
      chainId={8453} // Base
      prover="reclaim_gnark" // or "reclaim_snarkjs"
    >
      <YourApp />
    </Zkp2pProvider>
  );
}
```

### Proof-Only Mode Setup

```tsx
// No wallet or API key required!
function App() {
  return (
    <Zkp2pProvider
      chainId={8453} // Base
      prover="reclaim_gnark"
    >
      <YourApp />
    </Zkp2pProvider>
  );
}

// 3. Use the SDK in your components
function PaymentFlow() {
  const {
    flowState,
    initiate,
    authenticate,
    generateProof,
    zkp2pClient, // null in proof-only mode
    proofData,
    metadataList,
  } = useZkp2p();

  // Check mode
  const isProofOnlyMode = !zkp2pClient;
  
  // Your component logic
}
```

## API Reference

### Provider Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `walletClient` | `WalletClient` | Optional | Viem wallet client for blockchain interactions (required for full mode) |
| `apiKey` | `string` | Optional | Your ZKP2P API key (required for full mode) |
| `chainId` | `number` | `8453` | Blockchain chain ID (8453 for Base) |
| `prover` | `'reclaim_snarkjs' \| 'reclaim_gnark'` | `'reclaim_gnark'` | Proof generation method |
| `witnessUrl` | `string` | `'https://witness-proxy.zkp2p.xyz'` | Witness server URL |
| `baseApiUrl` | `string` | `'https://api.zkp2p.xyz/v1'` | ZKP2P API base URL |
| `rpcTimeout` | `number` | `30000` | RPC timeout in milliseconds |

### Core Flow Functions

#### 1. `signalIntent(args)`
Signal your intent to buy/sell crypto. This must be called before initiating the payment flow.

```typescript
const { zkp2pClient } = useZkp2p();

const signalArgs = {
  depositId: '123', // The deposit ID you want to fulfill
  amount: '100', // Amount in USD
  // ... other contract parameters
};

const tx = await zkp2pClient.signalIntent(signalArgs);
```

#### 2. `initiate(platform, actionType, options?)`
Start the payment proof generation flow. Opens payment provider authentication.

```typescript
const { initiate } = useZkp2p();

const provider = await initiate('venmo', 'transfer_venmo', {
  // Optional: Auto-start with payment action
  initialAction: {
    enabled: true,
    urlVariables: {
      recipientId: 'john-doe-123',
      amount: '100.00'
    }
  },
  // Optional: Auto-generate proof after authentication
  autoGenerateProof: {
    intentHash: '0x...', // Your intent hash from signalIntent
    itemIndex: 0, // Which transaction to prove (default: 0)
    onProofGenerated: (proofData) => {
      console.log('Proof generated:', proofData);
    },
    onProofError: (error) => {
      console.error('Proof generation failed:', error);
    }
  }
});
```

#### 3. `generateProof(provider, payload, intentHash, itemIndex?)`
Generate a zero-knowledge proof for a specific transaction.

```typescript
const { generateProof, provider, interceptedPayload } = useZkp2p();

try {
  const proof = await generateProof(
    provider,
    interceptedPayload,
    '0x...', // Intent hash from signalIntent
    0 // Transaction index to prove
  );
  
  console.log('Proof generated:', proof);
} catch (error) {
  console.error('Proof generation failed:', error);
  // Fallback to manual authentication
  await authenticate();
}
```

#### 4. `authenticate(autoGenerateProof?)`
Manually trigger authentication flow. Useful for retry scenarios or fallback.

```typescript
const { authenticate } = useZkp2p();

// Simple authentication without auto-proof
await authenticate();

// Or with auto-proof generation
await authenticate({
  intentHash: '0x...',
  itemIndex: 0,
  onProofGenerated: (proofData) => {
    // Handle generated proof
  }
});
```

#### 5. `fulfillIntent(args)`
Complete the transaction by submitting the proof on-chain.

```typescript
const { zkp2pClient, proofData } = useZkp2p();

const tx = await zkp2pClient.fulfillIntent(fulfillArgs);
```

### Hook Return Values

```typescript
const {
  // State
  flowState,        // Current flow state: 'idle' | 'authenticating' | 'authenticated' | 'proofGenerating' | 'proofGeneratedSuccess' | 'proofGeneratedFailure'
  provider,         // Current provider configuration
  proofData,        // Generated proof data
  metadataList,     // List of transactions from authentication
  authError,        // Authentication error if any
  
  // Methods
  initiate,         // Start the flow
  authenticate,     // Manual authentication
  generateProof,    // Generate proof for transaction
  closeAuthWebView, // Close authentication modal
  
  // Client
  zkp2pClient,      // Direct access to contract methods
} = useZkp2p();
```

### Complete Flow Example

```typescript
function BuyCrypto() {
  const { 
    flowState, 
    initiate, 
    generateProof,
    zkp2pClient,
    proofData,
    provider,
    interceptedPayload 
  } = useZkp2p();
  
  const handleBuy = async () => {
    try {
      const signalTx = await zkp2pClient.signalIntent({
        processorName: 'venmo',
        depositId: '123',
        tokenAmount: '100',
        payeeDetails: '0x1234567890123456789012345678901234567890',
        toAddress: '0x0000000000000000000000000000000000000000',
        currency: 'USD',
      });
      
      const intentHash = signalTx.responseObject.signedIntent;
      
      await initiate('venmo', 'transfer_venmo', {
        initialAction: {
          enabled: true,
          urlVariables: {
            venmoUsername: 'crypto-seller',
            note: 'Cash',
            amount: '100.00'
          }
        },
        // Optional: Auto-generate proof after authentication
        autoGenerateProof: {
          intentHash,
          itemIndex: 0, // Select the latest transaction
          onProofGenerated: async (proof) => {
            const fulfillTx = await zkp2pClient.fulfillIntent({
              paymentProof: proof,
              intentHash,
              onSuccess: (tx) => {
                console.log('Transaction complete:', tx.hash);
              },
              onError: (error) => {
                console.error('Fulfillment failed:', error);
            });
            
            console.log('Transaction complete:', fulfillTx.hash);
          },
          onProofError: async (error) => {
            console.error('Auto-proof failed, trying manual:', error);
            
            // Fallback: Manual proof generation
            if (provider && interceptedPayload) {
              const proof = await generateProof(
                provider,
                interceptedPayload,
                intentHash,
                0
              );
            }
          }
        }
      });
      
    } catch (error) {
      console.error('Buy flow failed:', error);
    }
  };
  
  return (
    <View>
      <Button onPress={handleBuy} title="Buy Crypto" />
      <Text>Status: {flowState}</Text>
    </View>
  );
}
```

### Flow States

- `idle` - No active operation
- `actionStarted` - Payment action initiated (Venmo/CashApp opened)
- `authenticating` - User authenticating with payment provider
- `authenticated` - Authentication complete, transactions available
- `proofGenerating` - Generating zero-knowledge proof
- `proofGeneratedSuccess` - Proof successfully generated
- `proofGeneratedFailure` - Proof generation failed

### Error Handling

```typescript
// Check authentication errors
const { authError } = useZkp2p();
if (authError) {
  console.error('Auth failed:', authError.message);
}
```

## Gnark (WIP)

The SDK includes native gnark proving for optimal performance. Circuit files are stored in the `gnark-circuits/` directory and are automatically loaded on initialization.

### Native Libraries
- iOS: Uses `libgnarkprover.xcframework`
- Android: Uses `libgnarkprover.so`

## Contributing

See the [contributing guide](CONTRIBUTING.md) to learn how to contribute to the repository and the development workflow.

## License

MIT

---

Made with [create-react-native-library](https://github.com/callstack/react-native-builder-bob)
