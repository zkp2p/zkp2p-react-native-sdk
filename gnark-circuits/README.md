# Gnark Circuit Files

This directory contains the pre-compiled gnark circuit files used by both iOS and Android implementations of the ZKP2P React Native SDK.

## Files

- `pk.chacha20` - Proving key for ChaCha20 algorithm
- `r1cs.chacha20` - R1CS constraint system for ChaCha20
- `pk.aes128` - Proving key for AES-128-CTR algorithm  
- `r1cs.aes128` - R1CS constraint system for AES-128-CTR
- `pk.aes256` - Proving key for AES-256-CTR algorithm
- `r1cs.aes256` - R1CS constraint system for AES-256-CTR

## Algorithm IDs

The algorithms are identified by the following IDs (matching Go constants):
- ChaCha20: 0
- AES-128-CTR: 1
- AES-256-CTR: 2

## Platform Integration

### iOS
The circuit files are included via the podspec:
```ruby
s.resources = "gnark-circuits/*"
```
They are copied to the main bundle and loaded at runtime.

### Android
The circuit files are copied to the assets directory during build:
```gradle
task copyGnarkCircuits(type: Copy) {
  from "${rootDir}/../gnark-circuits"
  into "src/main/assets/gnark-circuits"
}
```
They are loaded from assets at runtime.

## Updating Circuit Files

To update the circuit files:
1. Replace the files in this directory with new versions
2. Ensure the file naming convention is maintained (pk.{algorithm} and r1cs.{algorithm})
3. Test on both iOS and Android platforms 