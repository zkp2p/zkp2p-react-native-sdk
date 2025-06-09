# zkp2p-react-native-sdk

React Native SDK for ZKP2P with support for gnark proving

## Installation

```sh
yarn add @zkp2p/zkp2p-react-native-sdk

yarn add @react-native-async-storage/async-storage @react-native-cookies/cookies react-native-webview @zkp2p/webview-intercept
```

## Usage

```js
import { Zkp2pProvider, useZkp2p } from 'zkp2p-react-native-sdk';

const {
  provider: zkp2pProviderConfig,
  flowState,
  interceptedPayload,
  startAction,
  startAuthentication,
  itemsList,
  generateProof,
  proofData,
  zkp2pClient,
} = useZkp2p();

<Zkp2pProvider
  walletClient={ephemeralWalletClient as any}
  apiKey={ZKP2P_API_KEY}
>
  <App />
</Zkp2pProvider>
```

## Gnark Setup

The SDK includes native gnark proving for optimal performance. Circuit files are stored in the `gnark-circuits/` directory and are automatically loaded on initialization.

### Supported Algorithms
- ChaCha20 (id: 0)
- AES-128-CTR (id: 1)
- AES-256-CTR (id: 2)

### Native Libraries
- iOS: Uses `libgnarkprover.xcframework`
- Android: Uses `libgnarkprover.so`

For detailed setup instructions, see [docs/GNARK_SETUP.md](docs/GNARK_SETUP.md).

## Contributing

See the [contributing guide](CONTRIBUTING.md) to learn how to contribute to the repository and the development workflow.

## License

MIT

---

Made with [create-react-native-library](https://github.com/callstack/react-native-builder-bob)
