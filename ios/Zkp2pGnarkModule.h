#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

NS_ASSUME_NONNULL_BEGIN

@interface Zkp2pGnarkModule : RCTEventEmitter <RCTBridgeModule>

// GoSlice struct to match Go's slice type
typedef struct {
    void *data;
    long long len;
    long long cap;
} GoSlice;

// Return struct for Prove function
typedef struct {
    void *r0;
    long long r1;
} ProveReturn;

// Function pointer types for gnark operations
typedef ProveReturn (*GnarkProveFunction)(GoSlice witness);
typedef unsigned char (*GnarkVerifyFunction)(GoSlice params);
typedef unsigned char (*GnarkInitAlgorithmFunction)(unsigned char id, GoSlice pk, GoSlice r1cs);
typedef void (*GnarkFreeFunction)(void *ptr);

@end

NS_ASSUME_NONNULL_END 