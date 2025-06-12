# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
```bash
# Install dependencies
yarn install

# Type checking
yarn typecheck

# Linting
yarn lint

# Run tests
yarn test

# Setup Gnark circuits (required for native proof generation)
yarn setup:gnark

# Clean build artifacts
yarn clean

# Build the library
yarn prepare
```

### Example App Development
```bash
# Navigate to example directory
cd example

# Install iOS dependencies
cd ios && pod install && cd ..

# Run on Android
yarn android

# Run on iOS
yarn ios

# Start Metro bundler
yarn start
```

## Architecture Overview

This is a React Native SDK that provides zero-knowledge proof capabilities for peer-to-peer transactions. The architecture consists of:

### Native Module Integration
- **Gnark Bridge**: Factory pattern that abstracts native proof generation across iOS (Objective-C++) and Android (Kotlin)
- Native libraries (`libgnarkprover`) handle computationally intensive proof generation
- Supports three proof algorithms: ChaCha20, AES-128-CTR, and AES-256-CTR

### Core Architecture Patterns
1. **Provider Pattern**: `Zkp2pProvider` manages global state and wraps the app
2. **Client Pattern**: `Zkp2pClient` encapsulates all API and blockchain interactions
3. **Hook-based API**: `useZkp2p()` provides a clean interface to all SDK functionality
4. **Action Modules**: Separate modules for each blockchain operation (signal, fulfill, deposit, withdraw)

### WebView Integration
- `RPCWebView` component handles secure communication with proof generation endpoints
- `InterceptWebView` captures network traffic for authentication flows
- Message passing between React Native and WebView uses `postMessage` and `onMessage`

### Key Dependencies
- **viem**: Primary Ethereum interaction library
- **@zkp2p/react-native-webview-intercept**: Custom WebView for intercepting requests
- **react-native-webview**: Base WebView implementation
- Circuit files in `/gnark-circuits/` are loaded dynamically based on proof algorithm

### Testing
Tests use Jest with Viem mocks. Focus testing on:
- Client initialization with different configurations
- Provider utility functions
- Native module bridge functionality
- WebView message passing (especially Android issues)