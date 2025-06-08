#import "Zkp2pGnarkModule.h"
#import <React/RCTBridgeModule.h>
#import <React/RCTUtils.h>
#import <dlfcn.h>

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

- (void)executeOprfFunction:(NSString *)requestId
                functionName:(NSString *)functionName
                       args:(NSArray<NSString *> *)args
                  algorithm:(NSString *)algorithm
                    resolve:(RCTPromiseResolveBlock)resolve
                    reject:(RCTPromiseRejectBlock)reject;

@end
#endif

@interface Zkp2pGnarkModule ()
@end

@implementation Zkp2pGnarkModule {
    void *_proveHandle;
    void *_verifyHandle;
    GnarkProveFunction _proveFunction;
    GnarkVerifyFunction _verifyFunction;
    GnarkFreeFunction _freeFunction;
    GnarkFreeFunction _vfreeFunction;
    bool hasListeners;
}

RCT_EXPORT_MODULE(Zkp2pGnarkModule)

+ (BOOL)requiresMainQueueSetup
{
    return NO;
}

- (instancetype)init
{
    NSLog(@"[Zkp2pGnarkModule] Starting init...");
    if (self = [super init]) {
        NSLog(@"[Zkp2pGnarkModule] super init successful. Calling loadGnarkLibraries.");
        [self loadGnarkLibraries];
    }
    NSLog(@"[Zkp2pGnarkModule] Finished init.");
    return self;
}

- (void)dealloc
{
    NSLog(@"[Zkp2pGnarkModule] Deallocating.");
    if (_proveHandle) {
        dlclose(_proveHandle);
    }
    if (_verifyHandle) {
        dlclose(_verifyHandle);
    }
}

- (void)loadGnarkLibraries
{
    NSLog(@"[Zkp2pGnarkModule] Attempting to load gnark libraries...");
    NSBundle *bundle = [NSBundle mainBundle];
    
    NSString *provePath = [bundle pathForResource:@"darwin-arm64-libprove" ofType:@"so" inDirectory:@"Frameworks"];
    if (!provePath) {
        NSLog(@"[Zkp2pGnarkModule] FATAL: Could not find darwin-arm64-libprove.so in Frameworks directory. Path is nil.");
        return;
    }
    NSLog(@"[Zkp2pGnarkModule] Found prove library at path: %@", provePath);
    
    _proveHandle = dlopen([provePath UTF8String], RTLD_LAZY);
    if (!_proveHandle) {
        NSLog(@"[Zkp2pGnarkModule] FATAL: Failed to load prove library: %s", dlerror());
        return;
    }
    NSLog(@"[Zkp2pGnarkModule] Successfully loaded prove library handle.");
    
    _proveFunction = (GnarkProveFunction)dlsym(_proveHandle, "Prove");
    if (!_proveFunction) {
        NSLog(@"[Zkp2pGnarkModule] FATAL: Failed to find 'Prove' function in library: %s", dlerror());
    } else {
        NSLog(@"[Zkp2pGnarkModule] Successfully linked 'Prove' function.");
    }
    
    _freeFunction = (GnarkFreeFunction)dlsym(_proveHandle, "Free");
    if (!_freeFunction) {
        NSLog(@"[Zkp2pGnarkModule] WARNING: Failed to find 'Free' function in prove library: %s", dlerror());
    }
    
    NSString *verifyPath = [bundle pathForResource:@"darwin-arm64-libverify" ofType:@"so" inDirectory:@"Frameworks"];
    if (!verifyPath) {
        NSLog(@"[Zkp2pGnarkModule] FATAL: Could not find darwin-arm64-libverify.so in Frameworks directory. Path is nil.");
        return;
    }
    NSLog(@"[Zkp2pGnarkModule] Found verify library at path: %@", verifyPath);
    
    _verifyHandle = dlopen([verifyPath UTF8String], RTLD_LAZY);
    if (!_verifyHandle) {
        NSLog(@"[Zkp2pGnarkModule] FATAL: Failed to load verify library: %s", dlerror());
        return;
    }
    NSLog(@"[Zkp2pGnarkModule] Successfully loaded verify library handle.");
    
    _verifyFunction = (GnarkVerifyFunction)dlsym(_verifyHandle, "Verify");
    if (!_verifyFunction) {
        NSLog(@"[Zkp2pGnarkModule] FATAL: Failed to find 'Verify' function in library: %s", dlerror());
    } else {
        NSLog(@"[Zkp2pGnarkModule] Successfully linked 'Verify' function.");
    }
    
    _vfreeFunction = (GnarkFreeFunction)dlsym(_verifyHandle, "VFree");
    if (!_vfreeFunction) {
        NSLog(@"[Zkp2pGnarkModule] WARNING: Failed to find 'VFree' function in verify library: %s", dlerror());
    }
    
    NSLog(@"[Zkp2pGnarkModule] Finished loading gnark libraries.");
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

- (void)sendResponse:(NSString *)requestId type:(NSString *)type response:(NSDictionary *)response error:(NSDictionary *)error
{
    if (hasListeners) {
        NSMutableDictionary *event = [NSMutableDictionary dictionary];
        event[@"id"] = requestId;
        event[@"type"] = type;
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
            if ([functionName isEqualToString:@"groth16Prove"] && self->_proveFunction && args.count > 0) {
                NSString *witnessJson = args[0];
                NSData *witnessData = [witnessJson dataUsingEncoding:NSUTF8StringEncoding];
                
                // Create GoSlice from witness data
                GoSlice witnessSlice;
                witnessSlice.data = (void *)[witnessData bytes];
                witnessSlice.len = [witnessData length];
                witnessSlice.cap = [witnessData length];
                
                // Call Prove function
                ProveReturn result = self->_proveFunction(witnessSlice);
                
                if (result.r0 && result.r1 > 0) {
                    // Convert result to string
                    NSString *resultJson = [[NSString alloc] initWithBytes:result.r0 
                                                                    length:result.r1 
                                                                  encoding:NSUTF8StringEncoding];
                    
                    // Free the memory
                    if (self->_freeFunction) {
                        self->_freeFunction(result.r0);
                    }
                    
                    // Parse JSON result
                    NSError *jsonError;
                    NSData *jsonData = [resultJson dataUsingEncoding:NSUTF8StringEncoding];
                    NSDictionary *jsonDict = [NSJSONSerialization JSONObjectWithData:jsonData 
                                                                            options:0 
                                                                              error:&jsonError];
                    
                    if (jsonError) {
                        [self sendResponse:requestId type:@"error" response:nil 
                                     error:@{@"message": jsonError.localizedDescription}];
                        reject(@"JSON_ERROR", jsonError.localizedDescription, jsonError);
                        return;
                    }
                    
                    [self sendResponse:requestId type:@"response" response:jsonDict error:nil];
                    resolve(nil);
                } else {
                    [self sendResponse:requestId type:@"error" response:nil 
                                 error:@{@"message": @"Prove function returned null"}];
                    reject(@"PROVE_ERROR", @"Prove function returned null", nil);
                }
                
            } else if ([functionName isEqualToString:@"groth16Verify"] && self->_verifyFunction && args.count > 0) {
                NSString *verifyJson = args[0];
                NSData *verifyData = [verifyJson dataUsingEncoding:NSUTF8StringEncoding];
                
                // Create GoSlice from verify data
                GoSlice verifySlice;
                verifySlice.data = (void *)[verifyData bytes];
                verifySlice.len = [verifyData length];
                verifySlice.cap = [verifyData length];
                
                // Call Verify function
                unsigned char result = self->_verifyFunction(verifySlice);
                
                [self sendResponse:requestId type:@"response" 
                          response:@{@"valid": @(result == 1)} error:nil];
                resolve(nil);
                
            } else {
                NSString *errorMsg = [NSString stringWithFormat:@"Unknown or unimplemented function: %@", functionName];
                [self sendResponse:requestId type:@"error" response:nil error:@{@"message": errorMsg}];
                reject(@"UNKNOWN_FUNCTION", errorMsg, nil);
            }
        } @catch (NSException *exception) {
            [self sendResponse:requestId type:@"error" response:nil error:@{@"message": exception.reason}];
            reject(@"EXCEPTION", exception.reason, nil);
        }
    });
}

RCT_EXPORT_METHOD(executeOprfFunction:(NSString *)requestId
                  functionName:(NSString *)functionName
                  args:(NSArray<NSString *> *)args
                  algorithm:(NSString *)algorithm
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
    NSString *errorMsg = @"OPRF functions not yet implemented";
    [self sendResponse:requestId type:@"error" response:nil error:@{@"message": errorMsg}];
    reject(@"NOT_IMPLEMENTED", errorMsg, nil);
}

@end 