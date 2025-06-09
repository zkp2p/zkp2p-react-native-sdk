# Quick Setup: Where to Put Gnark Circuit Files

## Simple Setup

The easiest way to get gnark working is to add the circuit files directly to your Xcode project:

1. **Copy the circuit files** to the example app:
   ```bash
   cp ios/gnark-circuits/*.{aes256,aes128,chacha20} example/ios/Zkp2pReactNativeSdkExample/
   ```

2. **Add files to Xcode**:
   - Open `example/ios/Zkp2pReactNativeSdkExample.xcworkspace`
   - Right-click on `Zkp2pReactNativeSdkExample` folder
   - Select "Add Files to Zkp2pReactNativeSdkExample"
   - Select all 6 circuit files:
     - `pk.aes256`, `r1cs.aes256`
     - `pk.aes128`, `r1cs.aes128` 
     - `pk.chacha20`, `r1cs.chacha20`
   - ✅ Check "Copy items if needed"
   - ✅ Make sure your app target is selected

3. **Clean and rebuild**:
   - Product → Clean Build Folder (⇧⌘K)
   - Build and run

## Verifying It Works

Check the Xcode console when the app starts. You should see:

✅ Success:
```
[Zkp2pGnarkModule] ✓ Initialized aes-256-ctr (id: 0)
[Zkp2pGnarkModule] ✓ Initialized aes-128-ctr (id: 1)
[Zkp2pGnarkModule] ✓ Initialized chacha20 (id: 2)
[Zkp2pGnarkModule] Initialization complete. Available algorithms: aes-256-ctr, aes-128-ctr, chacha20
```

❌ If files are missing:
```
[Zkp2pGnarkModule] WARNING: Circuit files not found for aes-256-ctr
[Zkp2pGnarkModule]   Looking for: pk.aes256 and r1cs.aes256
```

## Troubleshooting

- **Files not showing in Xcode**: Make sure they're added to the app target
- **Still not found**: Check Product → Scheme → Edit Scheme → Build → Pre-actions isn't cleaning resources
- **Algorithm mismatch**: The RPC might be using a different algorithm than expected. Check console logs for "[GnarkBridge] Using algorithm:" 