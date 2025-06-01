# zkp2p-react-native-sdk

React Native SDK for ZKP2P

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


## Contributing

See the [contributing guide](CONTRIBUTING.md) to learn how to contribute to the repository and the development workflow.

## License

MIT

---

Made with [create-react-native-library](https://github.com/callstack/react-native-builder-bob)
