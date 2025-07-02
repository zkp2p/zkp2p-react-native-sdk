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

static const AlgorithmConfig ALGORITHM_CONFIGS[] = {
    {@"chacha20", 0, @"chacha20"},
    {@"aes-128-ctr", 1, @"aes128"},
    {@"aes-256-ctr", 2, @"aes256"},
};
static const NSUInteger ALGORITHM_COUNT = 3;

@interface Zkp2pGnarkModule ()
@property (nonatomic, strong) NSMutableSet<NSString *> *initializedAlgorithms;
@property (nonatomic, strong) NSMutableDictionary<NSString *, NSNumber *> *algorithmIdMap;
@property (nonatomic, strong) NSMutableSet<NSString *> *cancelledRequests;
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
        self.initializedAlgorithms = [NSMutableSet set];
        self.algorithmIdMap = [NSMutableDictionary dictionary];
        self.cancelledRequests = [NSMutableSet set];
        
        // Initialize gnark binding
        enforce_binding();
        
        for (NSUInteger i = 0; i < ALGORITHM_COUNT; i++) {
            AlgorithmConfig config = ALGORITHM_CONFIGS[i];
            self.algorithmIdMap[config.name] = @(config.id);
        }
        
        [self initializeAllAlgorithms];
    }
    return self;
}

- (void)initializeAllAlgorithms
{
    
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
            NSLog(@"[Zkp2pGnarkModule] ERROR: Circuit files not found for %@", config.name);
            NSLog(@"  Looking for: %@ and %@", pkFilename, r1csFilename);
            continue;
        }
        
        
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
        } else {
            NSLog(@"[Zkp2pGnarkModule] ERROR: Failed to initialize %@ (id: %lu)", config.name, (unsigned long)config.id);
        }
    }
    
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
            // Check if cancelled
            if ([self.cancelledRequests containsObject:requestId]) {
                [self.cancelledRequests removeObject:requestId];
                NSString *errorMsg = @"Proof generation was cancelled";
                [self sendResponse:requestId response:nil error:@{@"message": errorMsg}];
                reject(@"CANCELLED", errorMsg, nil);
                return;
            }
            
            if ([functionName isEqualToString:@"groth16Prove"] && args.count > 0) {
                
                NSString *argString = args[0];
                
                NSError *jsonError;
                NSData *argData = [argString dataUsingEncoding:NSUTF8StringEncoding];
                NSDictionary *argDict = [NSJSONSerialization JSONObjectWithData:argData options:0 error:&jsonError];
                
                NSString *base64Value;
                if (jsonError || ![argDict isKindOfClass:[NSDictionary class]]) {
                    base64Value = argString;
                } else {
                    base64Value = argDict[@"value"];
                }
                
                if (!base64Value) {
                    NSString *errorMsg = @"No base64 value found in argument";
                    [self sendResponse:requestId response:nil error:@{@"message": errorMsg}];
                    reject(@"INVALID_ARGS", errorMsg, nil);
                    return;
                }
                
                NSData *witnessData = [[NSData alloc] initWithBase64EncodedString:base64Value options:0];
                if (!witnessData) {
                    NSString *errorMsg = @"Failed to decode base64 witness data";
                    [self sendResponse:requestId response:nil error:@{@"message": errorMsg}];
                    reject(@"DECODE_ERROR", errorMsg, nil);
                    return;
                }
                
                if (self.initializedAlgorithms.count == 0) {
                    NSString *errorMsg = @"No algorithms have been initialized. Circuit files may be missing.";
                    [self sendResponse:requestId response:nil error:@{@"message": errorMsg}];
                    reject(@"NO_ALGORITHMS", errorMsg, nil);
                    return;
                }
                
                NSString *witnessString = [[NSString alloc] initWithData:witnessData encoding:NSUTF8StringEncoding];
                if (!witnessString) {
                    NSString *errorMsg = @"Failed to convert witness data to string";
                    [self sendResponse:requestId response:nil error:@{@"message": errorMsg}];
                    reject(@"DECODE_ERROR", errorMsg, nil);
                    return;
                }
                
                NSError *witnessJsonError;
                NSDictionary *witnessDict = [NSJSONSerialization JSONObjectWithData:witnessData options:0 error:&witnessJsonError];
                if (!witnessJsonError) {
                    NSString *cipher = witnessDict[@"cipher"];
                    if (cipher && ![self.initializedAlgorithms containsObject:cipher]) {
                        NSLog(@"[Zkp2pGnarkModule] WARNING: Cipher '%@' not in initialized algorithms: %@", 
                              cipher, self.initializedAlgorithms);
                    }
                }
                
                NSUInteger witnessLength = [witnessData length];
                void *witnessCopy = malloc(witnessLength);
                memcpy(witnessCopy, [witnessData bytes], witnessLength);
                
                // Check if cancelled before proving
                if ([self.cancelledRequests containsObject:requestId]) {
                    free(witnessCopy);
                    [self.cancelledRequests removeObject:requestId];
                    NSString *errorMsg = @"Proof generation was cancelled";
                    [self sendResponse:requestId response:nil error:@{@"message": errorMsg}];
                    reject(@"CANCELLED", errorMsg, nil);
                    return;
                }
                
                GoSlice witnessSlice;
                witnessSlice.data = witnessCopy;
                witnessSlice.len = witnessLength;
                witnessSlice.cap = witnessLength;
                
                
                NSLog(@"[Zkp2pGnarkModule] Calling Prove function");
                
                struct Prove_return result = Prove(witnessSlice);
                
                free(witnessCopy);
                
                // Check if cancelled after proving
                if ([self.cancelledRequests containsObject:requestId]) {
                    [self.cancelledRequests removeObject:requestId];
                    if (result.r0) {
                        Free(result.r0);
                    }
                    NSString *errorMsg = @"Proof generation was cancelled";
                    [self sendResponse:requestId response:nil error:@{@"message": errorMsg}];
                    reject(@"CANCELLED", errorMsg, nil);
                    return;
                }
                
                if (result.r0 && result.r1 > 0) {
                    NSData *resultData = [NSData dataWithBytes:result.r0 length:(NSUInteger)result.r1];
                    
                    Free(result.r0);
                    
                    NSString *resultJson = [[NSString alloc] initWithData:resultData 
                                                                  encoding:NSUTF8StringEncoding];
                    
                    NSError *parseError;
                    NSData *rawData = [resultJson dataUsingEncoding:NSUTF8StringEncoding];
                    NSDictionary *rawDict = [NSJSONSerialization JSONObjectWithData:rawData 
                                                                            options:0 
                                                                              error:&parseError];
                    
                    if (parseError || !rawDict[@"proof"] || !rawDict[@"publicSignals"]) {
                        NSString *errorMsg = [NSString stringWithFormat:@"Failed to parse result: %@", 
                                             parseError ? parseError.localizedDescription : @"Missing proof or publicSignals"];
                        NSLog(@"[Zkp2pGnarkModule] ERROR: %@", errorMsg);
                        [self sendResponse:requestId response:nil error:@{@"message": errorMsg}];
                        reject(@"JSON_ERROR", errorMsg, parseError);
                        return;
                    }
                    
                    NSString *proofValue = rawDict[@"proof"];
                    NSString *publicSignalsValue = rawDict[@"publicSignals"];
                    
                    NSLog(@"[Zkp2pGnarkModule] Proof generated successfully");
                    
                    NSDictionary *response = @{
                        @"proof": proofValue,
                        @"publicSignals": publicSignalsValue
                    };
                    
                    [self sendResponse:requestId response:response error:nil];
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

RCT_EXPORT_METHOD(cancelProofGeneration:(NSString *)requestId
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
    NSLog(@"[Zkp2pGnarkModule] Cancelling proof generation for request: %@", requestId);
    
    // Mark as cancelled
    [self.cancelledRequests addObject:requestId];
    
    resolve(@{@"success": @YES});
}

RCT_EXPORT_METHOD(cleanupMemory:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
    NSLog(@"[Zkp2pGnarkModule] Cleaning up memory");
    
    // Clear cancelled requests
    [self.cancelledRequests removeAllObjects];
    
    // Force garbage collection (note: this is just a hint to the system)
    dispatch_async(dispatch_get_main_queue(), ^{
        // This helps trigger memory cleanup
        [[NSURLCache sharedURLCache] removeAllCachedResponses];
    });
    
    resolve(@{@"success": @YES});
}

@end