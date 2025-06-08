# Android JNI Libraries

The gnark .so files should be placed in the appropriate architecture folders:

- `arm64-v8a/` - For ARM 64-bit devices
- `x86_64/` - For x86 64-bit emulators

The files will be automatically loaded by the Android system when the app starts.

## Required files:
- `liblinux-arm64-libprove.so` (for arm64-v8a)
- `liblinux-arm64-libverify.so` (for arm64-v8a)
- `liblinux-x86_64-libprove.so` (for x86_64)
- `liblinux-x86_64-libverify.so` (for x86_64) 