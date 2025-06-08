# Gnark Proving Setup Guide

This guide explains how to use gnark proving with the zkp2p-react-native-sdk.

## Overview

The SDK supports gnark proving through native FFI bridges on iOS and Android. This allows for faster proof generation compared to snarkjs by using optimized native circuits.

## Architecture

```
React Native App
    ↓
Zkp2pProvider (prover='reclaim_gnark')
    ↓
GnarkBridge
    ↓
Native Module (iOS/Android)
    ↓
Gnark .so Libraries
```

## Setup Instructions

### 1. Install Dependencies

First, ensure you have the zkp2p-react-native-sdk installed:

```bash
yarn add @zkp2p/zkp2p-react-native-sdk
```

### 2. Run Setup Script

Run the setup script to copy gnark libraries to the correct locations:

```bash
yarn setup:gnark
```

This script will:
- Copy iOS libraries to the `ios/` directory
- Copy Android libraries to `android/src/main/jniLibs/`

### 3. iOS Setup

After running the setup script:

```bash
cd ios
pod install
```

If the libraries are not loading properly, you may need to manually add them to your Xcode project:

1. Open your `.xcworkspace` file in Xcode
2. Right-click on your project name in the navigator
3. Select "Add Files to [YourProject]"
4. Navigate to `node_modules/@zkp2p/zkp2p-react-native-sdk/ios/`
5. Select both `darwin-arm64-libprove.so` and `darwin-arm64-libverify.so`
6. Make sure "Copy items if needed" is checked
7. Make sure your app target is selected in "Add to targets"
8. Click "Add"

Alternatively, you can add a custom build phase:
1. Select your project in Xcode
2. Go to "Build Phases"
3. Click "+" and select "New Run Script Phase"
4. Add the following script:
```bash
# Copy gnark libraries to app bundle
SOURCE_DIR="${PODS_ROOT}/../node_modules/@zkp2p/zkp2p-react-native-sdk/ios"
TARGET_DIR="${BUILT_PRODUCTS_DIR}/${PRODUCT_NAME}.app"

if [ -f "${SOURCE_DIR}/darwin-arm64-libprove.so" ]; then
    cp "${SOURCE_DIR}/darwin-arm64-libprove.so" "${TARGET_DIR}/"
fi

if [ -f "${SOURCE_DIR}/darwin-arm64-libverify.so" ]; then
    cp "${SOURCE_DIR}/darwin-arm64-libverify.so" "${TARGET_DIR}/"
fi
```

### 4. Android Setup

The Android setup is automatic after running the setup script. Just rebuild your Android app:

```bash
cd android
./gradlew clean
./gradlew assembleDebug
```

## Usage

To use gnark proving, set the `prover` prop to `'reclaim_gnark'` in your Zkp2pProvider:

```tsx
import { Zkp2pProvider } from '@zkp2p/zkp2p-react-native-sdk';

function App() {
  return (
    <Zkp2pProvider
      prover="reclaim_gnark"  // Enable gnark proving
      witnessUrl="https://witness-proxy.zkp2p.xyz"
      walletClient={walletClient}
      apiKey="your-api-key"
    >
      {/* Your app content */}
    </Zkp2pProvider>
  );
}
```

## How It Works

When `prover="reclaim_gnark"` is set:

1. The provider creates a `GnarkBridge` instance
2. The bridge communicates with native modules via React Native's event system
3. Native modules load the gnark .so files using FFI
4. Proof generation happens natively, with results passed back to JavaScript

## Supported Algorithms

The gnark implementation supports the following encryption algorithms:
- `aes-256-ctr`
- `aes-128-ctr`
- `chacha20`

## Performance

Gnark proving offers significant performance improvements:
- ~5-10x faster proof generation compared to snarkjs
- Lower memory usage
- Better battery efficiency on mobile devices

## Troubleshooting

### iOS Issues

1. **Library not found error**: Ensure the .so files are in the iOS directory and run `pod install`
2. **Build errors**: Clean the build folder and rebuild

### Android Issues

1. **UnsatisfiedLinkError**: Check that the .so files are in the correct JNI directories
2. **Architecture mismatch**: Ensure you have the correct .so files for your device architecture

### Common Issues

1. **Proof generation fails**: Check the console logs for specific error messages
2. **App crashes**: Ensure the native modules are properly registered

## Native Library Details

The gnark libraries are pre-compiled shared objects (.so files) that contain:
- Groth16 proving circuits
- Groth16 verification circuits
- OPRF operations (for future use)

These libraries are architecture-specific:
- iOS: `darwin-arm64-*.so`
- Android ARM64: `linux-arm64-*.so`
- Android x86_64: `linux-x86_64-*.so`

## Security Considerations

- The private key used for proving is hardcoded for development
- In production, implement proper key management
- The .so files should be code-signed for release builds

## Future Enhancements

- Support for custom circuits
- OPRF implementation
- Performance monitoring and metrics
- Circuit caching for faster subsequent proofs 