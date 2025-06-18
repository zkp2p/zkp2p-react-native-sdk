# ZKP2P SDK Usage Modes

The ZKP2P React Native SDK supports two distinct usage modes:

## 1. Full Mode

Full mode provides access to all SDK features including blockchain operations and proof generation.

### Requirements:
- Wallet Client (for signing transactions)
- API Key (for accessing protected endpoints)

### Example Usage:

```tsx
import { Zkp2pProvider } from '@zkp2p/zkp2p-react-native-sdk';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

// Create wallet client
const account = privateKeyToAccount('0x...');
const walletClient = createWalletClient({
  account,
  chain: base,
  transport: http(),
});

// Initialize provider with all options
<Zkp2pProvider
  walletClient={walletClient}
  apiKey="your-api-key"
  chainId={8453}
  prover="reclaim_gnark"
>
  <App />
</Zkp2pProvider>
```

### Available Features:
- ✅ Proof generation
- ✅ Create deposits
- ✅ Signal intents
- ✅ Fulfill intents
- ✅ Withdraw deposits
- ✅ Cancel intents
- ✅ Query blockchain data

## 2. Proof-Only Mode

Proof-only mode allows you to generate proofs without requiring a wallet or API key.

### Requirements:
- None! 🎉

### Example Usage:

```tsx
import { Zkp2pProvider } from '@zkp2p/zkp2p-react-native-sdk';

// Initialize provider without wallet or API key
<Zkp2pProvider
  chainId={8453}
  prover="reclaim_gnark"
>
  <App />
</Zkp2pProvider>
```

### Available Features:
- ✅ Proof generation
- ✅ Authentication flows
- ✅ Public API queries (e.g., getQuote)
- ❌ Blockchain write operations
- ❌ Protected API endpoints

## Using the SDK in Your App

### Check Current Mode

```tsx
import { useZkp2p } from '@zkp2p/zkp2p-react-native-sdk';

function MyComponent() {
  const { zkp2pClient } = useZkp2p();
  
  const isProofOnlyMode = !zkp2pClient;
  
  if (isProofOnlyMode) {
    // Show proof generation features only
  } else {
    // Show all features
  }
}
```

### Proof Generation (Works in Both Modes)

```tsx
const { initiate, generateProof } = useZkp2p();

// Start authentication flow
await initiate('venmo', 'send');

// Generate proof after authentication
const proofResult = await generateProof(
  providerConfig,
  interceptedPayload,
  intentHash,
  itemIndex
);
```

### Blockchain Operations (Full Mode Only)

```tsx
const { zkp2pClient } = useZkp2p();

if (zkp2pClient) {
  // Create a deposit
  await zkp2pClient.createDeposit({
    token: usdcAddress,
    amount: parseUnits('100', 6),
    // ... other params
  });
  
  // Signal an intent
  await zkp2pClient.signalIntent({
    processorName: 'venmo',
    depositId: '123',
    // ... other params
  });
}
```

## Migration Guide

If you're updating from a version that required wallet and API key:

1. Update your `Zkp2pProvider` props to make `walletClient` and `apiKey` optional
2. Add conditional checks before using `zkp2pClient`
3. Consider offering both modes to your users for maximum flexibility

## Best Practices

1. **Check for zkp2pClient availability** before calling blockchain operations
2. **Provide clear UI feedback** about which mode is active
3. **Handle null zkp2pClient gracefully** in proof-only mode
4. **Use TypeScript** to catch potential null reference errors at compile time