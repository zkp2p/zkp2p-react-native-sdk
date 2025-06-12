#import "Zkp2pGnarkModule.h"
#import <React/RCTBridgeModule.h>
#import <React/RCTUtils.h>
#import "libgnarkprover.h"

#ifdef RCT_NEW_ARCH_ENABLED
#import <ReactCommon/RCTTurboModule.h>
#import <FBReactNativeSpec/FBReactNativeSpec.h>

@protocol NativeZkp2pGnarkModuleSpec <RCTBridgeModule, RCTTurboModule>

- (void)executeZkFunction:(NSString *)requestId
              functionName:(NSString *)functionName
                     args:(NSArray<NSString *> *)args
                algorithm:(NSString *)algorithm
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject;

@end
#endif

// Algorithm configuration
typedef struct {
    NSString *name;
    NSUInteger id;
    NSString *fileExt;
} AlgorithmConfig;

// Algorithm IDs must match Go constants
static const AlgorithmConfig ALGORITHM_CONFIGS[] = {
    {@"chacha20", 0, @"chacha20"},      // CHACHA20 = 0
    {@"aes-128-ctr", 1, @"aes128"},     // AES_128 = 1
    {@"aes-256-ctr", 2, @"aes256"},     // AES_256 = 2
};
static const NSUInteger ALGORITHM_COUNT = 3;

@interface Zkp2pGnarkModule ()
@property (nonatomic, strong) NSMutableSet<NSString *> *initializedAlgorithms;
@property (nonatomic, strong) NSMutableDictionary<NSString *, NSNumber *> *algorithmIdMap;
@end

@implementation Zkp2pGnarkModule {
    bool hasListeners;
}

RCT_EXPORT_MODULE(Zkp2pGnarkModule)

+ (BOOL)requiresMainQueueSetup
{
    return NO;
}

- (instancetype)init
{
    if (self = [super init]) {
        NSLog(@"[Zkp2pGnarkModule] Initialized");
        self.initializedAlgorithms = [NSMutableSet set];
        self.algorithmIdMap = [NSMutableDictionary dictionary];
        
        // Initialize gnark binding
        enforce_binding();
        
        // Build algorithm ID map
        for (NSUInteger i = 0; i < ALGORITHM_COUNT; i++) {
            AlgorithmConfig config = ALGORITHM_CONFIGS[i];
            self.algorithmIdMap[config.name] = @(config.id);
        }
        
        // Initialize all algorithms on startup
        [self initializeAllAlgorithms];
    }
    return self;
}

- (void)initializeAllAlgorithms
{
    NSLog(@"[Zkp2pGnarkModule] Initializing all algorithms...");
    
    NSBundle *mainBundle = [NSBundle mainBundle];
    
    for (NSUInteger i = 0; i < ALGORITHM_COUNT; i++) {
        AlgorithmConfig config = ALGORITHM_CONFIGS[i];
        
        // Look for circuit files in main bundle (copied from gnark-circuits/)
        NSString *pkFilename = [NSString stringWithFormat:@"pk.%@", config.fileExt];
        NSString *r1csFilename = [NSString stringWithFormat:@"r1cs.%@", config.fileExt];
        
        // The files are now in the root of the bundle, not in a subdirectory
        NSString *pkPath = [mainBundle pathForResource:pkFilename ofType:nil];
        NSString *r1csPath = [mainBundle pathForResource:r1csFilename ofType:nil];
        
        if (!pkPath || !r1csPath) {
            NSLog(@"[Zkp2pGnarkModule] WARNING: Circuit files not found for %@", config.name);
            NSLog(@"  Looking for: %@ and %@", pkFilename, r1csFilename);
            NSLog(@"  Bundle resource path: %@", [mainBundle resourcePath]);
            continue;
        }
        
        NSLog(@"[Zkp2pGnarkModule] Found circuit files for %@:", config.name);
        NSLog(@"  PK: %@", pkPath);
        NSLog(@"  R1CS: %@", r1csPath);
        
        NSError *error;
        NSData *pkData = [NSData dataWithContentsOfFile:pkPath options:0 error:&error];
        if (error) {
            NSLog(@"[Zkp2pGnarkModule] ERROR: Failed to load %@: %@", pkFilename, error);
            continue;
        }
        
        NSData *r1csData = [NSData dataWithContentsOfFile:r1csPath options:0 error:&error];
        if (error) {
            NSLog(@"[Zkp2pGnarkModule] ERROR: Failed to load %@: %@", r1csFilename, error);
            continue;
        }
        
        // Create GoSlices
        GoSlice pkSlice;
        pkSlice.data = (void *)[pkData bytes];
        pkSlice.len = [pkData length];
        pkSlice.cap = [pkData length];
        
        GoSlice r1csSlice;
        r1csSlice.data = (void *)[r1csData bytes];
        r1csSlice.len = [r1csData length];
        r1csSlice.cap = [r1csData length];
        
        // Initialize algorithm
        GoUint8 result = InitAlgorithm(config.id, pkSlice, r1csSlice);
        
        if (result == 1) {
            [self.initializedAlgorithms addObject:config.name];
            NSLog(@"[Zkp2pGnarkModule] ✓ Initialized %@ (id: %lu)", config.name, (unsigned long)config.id);
        } else {
            NSLog(@"[Zkp2pGnarkModule] ✗ Failed to initialize %@ (id: %lu)", config.name, (unsigned long)config.id);
            NSLog(@"  Algorithm ID: %lu", (unsigned long)config.id);
            NSLog(@"  PK size: %lu bytes", (unsigned long)[pkData length]);
            NSLog(@"  R1CS size: %lu bytes", (unsigned long)[r1csData length]);
        }
    }
    
    NSLog(@"[Zkp2pGnarkModule] Initialization complete. Available algorithms: %@", 
          [[self.initializedAlgorithms allObjects] componentsJoinedByString:@", "]);
}

- (void)startObserving
{
    hasListeners = YES;
}

- (void)stopObserving
{
    hasListeners = NO;
}

- (NSArray<NSString *> *)supportedEvents
{
    return @[@"GnarkRPCResponse"];
}

- (void)sendResponse:(NSString *)requestId response:(NSDictionary *)response error:(NSDictionary *)error
{
    if (hasListeners) {
        NSMutableDictionary *event = [NSMutableDictionary dictionary];
        event[@"id"] = requestId;
        event[@"type"] = error ? @"error" : @"response";
        
        if (response) {
            event[@"response"] = response;
        }
        if (error) {
            event[@"error"] = error;
        }
        
        [self sendEventWithName:@"GnarkRPCResponse" body:event];
    }
}



RCT_EXPORT_METHOD(executeZkFunction:(NSString *)requestId
                  functionName:(NSString *)functionName
                  args:(NSArray<NSString *> *)args
                  algorithm:(NSString *)algorithm
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
    dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
        @try {
            if ([functionName isEqualToString:@"groth16Prove"] && args.count > 0) {
                NSLog(@"[Zkp2pGnarkModule] groth16Prove called");
                NSLog(@"  Algorithm parameter: %@", algorithm);
                NSLog(@"  Available algorithms: %@", [self.initializedAlgorithms allObjects]);
                
                // The witness comes as a JSON string
                NSString *witnessJson = args[0];
                
                // IMPORTANT: For gnark, we need at least one initialized algorithm
                if (self.initializedAlgorithms.count == 0) {
                    NSString *errorMsg = @"No algorithms have been initialized. Circuit files may be missing.";
                    [self sendResponse:requestId response:nil error:@{@"message": errorMsg}];
                    reject(@"NO_ALGORITHMS", errorMsg, nil);
                    return;
                }
                
                // Convert to data for gnark
                NSData *witnessData = [witnessJson dataUsingEncoding:NSUTF8StringEncoding];
                
                // Create a copy of the bytes to ensure they remain valid during the Go call
                NSUInteger witnessLength = [witnessData length];
                void *witnessCopy = malloc(witnessLength);
                memcpy(witnessCopy, [witnessData bytes], witnessLength);
                
                // Create GoSlice from copied data
                GoSlice witnessSlice;
                witnessSlice.data = witnessCopy;
                witnessSlice.len = witnessLength;
                witnessSlice.cap = witnessLength;
                
                NSLog(@"[Zkp2pGnarkModule] Calling Prove function...");
                NSLog(@"[Zkp2pGnarkModule] Witness data length: %lu", (unsigned long)witnessLength);
                
                // Call the Prove function
                struct Prove_return result = Prove(witnessSlice);
                
                // Free our witness copy
                free(witnessCopy);
                
                NSLog(@"[Zkp2pGnarkModule] Prove returned: r0=%p, r1=%lld", result.r0, result.r1);
                
                if (result.r0 && result.r1 > 0) {
                    // First create NSData to ensure bytes are copied before freeing
                    NSData *resultData = [NSData dataWithBytes:result.r0 length:(NSUInteger)result.r1];
                    
                    // Free the memory allocated by Go immediately after copying
                    Free(result.r0);
                    
                    // Now convert to string from our copied data
                    NSString *resultJson = [[NSString alloc] initWithData:resultData 
                                                                  encoding:NSUTF8StringEncoding];
                    
                    NSLog(@"[Zkp2pGnarkModule] Prove result length: %lu", (unsigned long)[resultJson length]);
                    
                    // Parse JSON result
                    NSError *jsonError;
                    NSData *jsonData = [resultJson dataUsingEncoding:NSUTF8StringEncoding];
                    NSDictionary *jsonDict = [NSJSONSerialization JSONObjectWithData:jsonData 
                                                                            options:0 
                                                                              error:&jsonError];
                    
                    if (jsonError) {
                        NSString *errorMsg = [NSString stringWithFormat:@"Failed to parse result: %@", jsonError.localizedDescription];
                        NSLog(@"[Zkp2pGnarkModule] ERROR: %@", errorMsg);
                        [self sendResponse:requestId response:nil error:@{@"message": errorMsg}];
                        reject(@"JSON_ERROR", errorMsg, jsonError);
                        return;
                    }
                    
                    NSLog(@"[Zkp2pGnarkModule] Success! Proof generated with keys: %@", [jsonDict allKeys]);
                    
                    // Log detailed proof structure for debugging
                    NSString *proofValue = jsonDict[@"proof"];
                    NSString *publicSignalsValue = jsonDict[@"publicSignals"];
                    NSLog(@"[Zkp2pGnarkModule] === PROOF DETAILS ===");
                    NSLog(@"  Proof type: %@", NSStringFromClass([proofValue class]));
                    NSLog(@"  Proof length: %lu", (unsigned long)[proofValue length]);
                    NSLog(@"  Proof preview: %@", [proofValue substringToIndex:MIN(100, [proofValue length])]);
                    NSLog(@"  PublicSignals type: %@", NSStringFromClass([publicSignalsValue class]));
                    NSLog(@"  PublicSignals length: %lu", (unsigned long)[publicSignalsValue length]);
                    NSLog(@"  PublicSignals preview: %@", [publicSignalsValue substringToIndex:MIN(100, [publicSignalsValue length])]);
                    
                    // Decode and examine the proof bytes
                    NSData *proofData = [[NSData alloc] initWithBase64EncodedString:proofValue options:0];
                    if (proofData) {
                        NSLog(@"  Decoded proof length: %lu bytes", (unsigned long)[proofData length]);
                        const uint8_t *bytes = (const uint8_t *)[proofData bytes];
                        NSLog(@"  First 16 bytes: %02x %02x %02x %02x %02x %02x %02x %02x %02x %02x %02x %02x %02x %02x %02x %02x",
                              bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6], bytes[7],
                              bytes[8], bytes[9], bytes[10], bytes[11], bytes[12], bytes[13], bytes[14], bytes[15]);
                        
                        // Check if it looks like it might be little-endian when it should be big-endian
                        NSUInteger proofLen = [proofData length];
                        if (proofLen >= 32) {
                            NSLog(@"  Last 16 bytes: %02x %02x %02x %02x %02x %02x %02x %02x %02x %02x %02x %02x %02x %02x %02x %02x",
                                  bytes[proofLen-16], bytes[proofLen-15], bytes[proofLen-14], bytes[proofLen-13],
                                  bytes[proofLen-12], bytes[proofLen-11], bytes[proofLen-10], bytes[proofLen-9],
                                  bytes[proofLen-8], bytes[proofLen-7], bytes[proofLen-6], bytes[proofLen-5],
                                  bytes[proofLen-4], bytes[proofLen-3], bytes[proofLen-2], bytes[proofLen-1]);
                        }
                    }
                    
                    NSLog(@"[Zkp2pGnarkModule] ==================");
                    
                    // groth16Prove should return the proof and publicSignals as-is
                    // The witness SDK will handle any further processing
                    [self sendResponse:requestId response:jsonDict error:nil];
                    resolve(nil);
                } else {
                    NSString *errorMsg = @"Prove function failed: returned null or empty result";
                    NSLog(@"[Zkp2pGnarkModule] ERROR: %@", errorMsg);
                    [self sendResponse:requestId response:nil error:@{@"message": errorMsg}];
                    reject(@"PROVE_ERROR", errorMsg, nil);
                }
                
            } else {
                NSString *errorMsg = [NSString stringWithFormat:@"Unknown function: %@", functionName];
                [self sendResponse:requestId response:nil error:@{@"message": errorMsg}];
                reject(@"UNKNOWN_FUNCTION", errorMsg, nil);
            }
        } @catch (NSException *exception) {
            NSString *errorMsg = [NSString stringWithFormat:@"Exception: %@", exception.reason];
            NSLog(@"[Zkp2pGnarkModule] EXCEPTION: %@", errorMsg);
            [self sendResponse:requestId response:nil error:@{@"message": errorMsg}];
            reject(@"EXCEPTION", errorMsg, nil);
        }
    });
}

@end 