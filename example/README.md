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

## Setup

1. Install dependencies:
```bash
cd example
yarn install
```

2. Run the app:
```bash
# For iOS
cd ios
pod install
cd ..
yarn ios

# For Android
yarn android
```

## Troubleshooting

If you encounter any issues:

1. Check the console logs for error messages
2. Ensure the RPC server is running
3. Verify your network connection
4. Check that the provider configuration is accessible

## Contributing

Feel free to submit issues and enhancement requests!
