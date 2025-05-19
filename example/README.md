# ZKP2P React Native SDK Example

This example app demonstrates the usage of the ZKP2P React Native SDK, showcasing all major features including authentication, transaction extraction, and proof generation.

## Features Demonstrated

1. **Authentication**
   - Provider configuration fetching
   - Authentication flow
   - Stored authentication handling

2. **Transaction Extraction**
   - Extracting transactions from intercepted payloads
   - Displaying transaction details
   - Transaction selection for proof generation

3. **Proof Generation**
   - RPC communication
   - Proof generation with selected transaction
   - Error handling and loading states
4. **Wallet Connection**
   - Connects to external wallets using WalletConnect

## Setup

1. Install dependencies:
```bash
cd example
npm install
```

2. Start the Metro bundler:
```bash
npm start
```

3. Run the app:
```bash
# For iOS
npm run ios

# For Android
npm run android
```

## Usage

1. **Authentication**
   - Tap "Start Authentication" to begin the authentication flow
   - The app will check for stored authentication data
   - If no stored data exists, it will fetch the provider configuration

2. **Transaction Selection**
   - After successful authentication, transactions will be displayed
   - Tap on a transaction to select it for proof generation
   - Selected transaction will be highlighted

3. **Proof Generation**
   - With a transaction selected, tap "Generate Proof"
   - The app will communicate with the RPC WebView
   - Progress and results will be displayed

## Notes

- The example uses Binance as the default platform
- Make sure the RPC server is running at `http://localhost:8001`
- The app includes error handling and loading states
- All network requests are logged to the console for debugging

## Troubleshooting

If you encounter any issues:

1. Check the console logs for error messages
2. Ensure the RPC server is running
3. Verify your network connection
4. Check that the provider configuration is accessible

## Contributing

Feel free to submit issues and enhancement requests!
