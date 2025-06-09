# Gnark Circuit Files Setup

This document explains how to set up the gnark proving key and R1CS files for the zkp2p React Native SDK.

## Overview

The gnark prover requires circuit-specific proving keys (`.pk`) and R1CS constraint system files (`.r1cs`) to generate zero-knowledge proofs. These files must be bundled with the iOS app.

## File Structure

Place your circuit files in `ios/gnark-circuits/`:

```
ios/gnark-circuits/
├── pk.aes256       # Proving key for AES-256-CTR
├── r1cs.aes256     # R1CS for AES-256-CTR
├── pk.aes128       # Proving key for AES-128-CTR
├── r1cs.aes128     # R1CS for AES-128-CTR
├── pk.chacha20     # Proving key for ChaCha20
└── r1cs.chacha20   # R1CS for ChaCha20
```

## Automatic Initialization

The native module automatically loads and initializes all circuit files on startup. When the app launches, you'll see logs like:

```
[Zkp2pGnarkModule] Initializing all algorithms...
[Zkp2pGnarkModule] Successfully initialized aes-256-ctr (id: 0) with pk size: XXX, r1cs size: XXX
[Zkp2pGnarkModule] Successfully initialized aes-128-ctr (id: 1) with pk size: XXX, r1cs size: XXX
[Zkp2pGnarkModule] Successfully initialized chacha20 (id: 2) with pk size: XXX, r1cs size: XXX
```

If circuit files are missing, you'll see warnings:

```
[Zkp2pGnarkModule] WARNING: Circuit files not found for aes-256-ctr. Expected files: pk.aes256 and r1cs.aes256
```

## Algorithm Mapping

The SDK uses the following algorithm mappings:

| Algorithm Name | ID | File Extension |
|----------------|----|--------------------|
| aes-256-ctr    | 0  | aes256            |
| aes-128-ctr    | 1  | aes128            |
| chacha20       | 2  | chacha20          |

## Deployment

1. Place your circuit files in `ios/gnark-circuits/`
2. Run `pod install` in your example app
3. The files will be bundled as resources in the iOS app

## Testing

After adding the circuit files and rebuilding:

1. Check Xcode console for initialization logs
2. Attempt to generate a proof - it should now work without "data format" errors
3. If you see "Algorithm 'xxx' has not been initialized", check that the circuit files are present

## Troubleshooting

- **Files not found**: Ensure files are in `ios/gnark-circuits/` with exact names
- **Initialization failed**: Check file format - they should be binary gnark circuit files
- **Wrong algorithm**: Ensure the algorithm name matches exactly (e.g., "aes-256-ctr" not "aes256") 