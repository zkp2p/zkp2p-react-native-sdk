#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

#ifdef RCT_NEW_ARCH_ENABLED
#import <ReactCommon/RCTTurboModule.h>
#endif

NS_ASSUME_NONNULL_BEGIN

@interface Zkp2pGnarkModule : RCTEventEmitter <RCTBridgeModule
#ifdef RCT_NEW_ARCH_ENABLED
  , RCTTurboModule
#endif
>

// Function pointer types for gnark operations
typedef const char* (*GnarkProveFunction)(const char* witness, const char* algorithm);
typedef const char* (*GnarkVerifyFunction)(const char* publicSignals, const char* proof);
typedef const char* (*GnarkOprfFunction)(const char* input, const char* key);

@end

NS_ASSUME_NONNULL_END 