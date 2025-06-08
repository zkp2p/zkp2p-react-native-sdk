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
#ifdef RCT_NEW_ARCH_ENABLED
<NativeZkp2pGnarkModuleSpec>
#endif
@end

@implementation Zkp2pGnarkModule {
    void *_proveHandle;
    void *_verifyHandle;
    GnarkProveFunction _proveFunction;
    GnarkVerifyFunction _verifyFunction;
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
        [self loadGnarkLibraries];
    }
    return self;
}

- (void)dealloc
{
    if (_proveHandle) {
        dlclose(_proveHandle);
    }
    if (_verifyHandle) {
        dlclose(_verifyHandle);
    }
}

- (void)loadGnarkLibraries
{
    NSBundle *bundle = [NSBundle mainBundle];
    
    // Load prove library
    NSString *provePath = [bundle pathForResource:@"darwin-arm64-libprove" ofType:@"so" inDirectory:@"Frameworks"];
    if (!provePath) {
        NSLog(@"[Zkp2pGnarkModule] Could not find darwin-arm64-libprove.so in Frameworks directory");
        return;
    }
    
    _proveHandle = dlopen([provePath UTF8String], RTLD_LAZY);
    if (!_proveHandle) {
        NSLog(@"[Zkp2pGnarkModule] Failed to load prove library: %s", dlerror());
        return;
    }
    
    _proveFunction = (GnarkProveFunction)dlsym(_proveHandle, "Prove");
    if (!_proveFunction) {
        NSLog(@"[Zkp2pGnarkModule] Failed to find Prove function: %s", dlerror());
    }
    
    // Load verify library
    NSString *verifyPath = [bundle pathForResource:@"darwin-arm64-libverify" ofType:@"so" inDirectory:@"Frameworks"];
    if (!verifyPath) {
        NSLog(@"[Zkp2pGnarkModule] Could not find darwin-arm64-libverify.so in Frameworks directory");
        return;
    }
    
    _verifyHandle = dlopen([verifyPath UTF8String], RTLD_LAZY);
    if (!_verifyHandle) {
        NSLog(@"[Zkp2pGnarkModule] Failed to load verify library: %s", dlerror());
        return;
    }
    
    _verifyFunction = (GnarkVerifyFunction)dlsym(_verifyHandle, "Verify");
    if (!_verifyFunction) {
        NSLog(@"[Zkp2pGnarkModule] Failed to find Verify function: %s", dlerror());
    }
    
    NSLog(@"[Zkp2pGnarkModule] Successfully loaded gnark libraries");
}

// Will be called when this module's first listener is added
- (void)startObserving
{
    hasListeners = YES;
}

// Will be called when this module's last listener is removed, or on dealloc
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
            // For now, we'll implement a simple example
            // In a real implementation, you would process the args and call the appropriate function
            
            if ([functionName isEqualToString:@"prove"] && self->_proveFunction) {
                // Example: Convert args to JSON string
                NSError *jsonError;
                NSData *jsonData = [NSJSONSerialization dataWithJSONObject:args options:0 error:&jsonError];
                if (jsonError) {
                    [self sendResponse:requestId type:@"error" response:nil error:@{@"message": jsonError.localizedDescription}];
                    reject(@"JSON_ERROR", jsonError.localizedDescription, jsonError);
                    return;
                }
                
                NSString *argsString = [[NSString alloc] initWithData:jsonData encoding:NSUTF8StringEncoding];
                const char *result = self->_proveFunction([argsString UTF8String], [algorithm UTF8String]);
                
                if (result) {
                    NSString *resultString = [NSString stringWithUTF8String:result];
                    [self sendResponse:requestId type:@"response" response:@{@"result": resultString} error:nil];
                    resolve(nil);
                } else {
                    [self sendResponse:requestId type:@"error" response:nil error:@{@"message": @"Prove function returned null"}];
                    reject(@"PROVE_ERROR", @"Prove function returned null", nil);
                }
            } else {
                NSString *errorMsg = [NSString stringWithFormat:@"Unknown function: %@", functionName];
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
    // Similar implementation to executeZkFunction
    // For now, just return an error
    NSString *errorMsg = @"OPRF functions not yet implemented";
    [self sendResponse:requestId type:@"error" response:nil error:@{@"message": errorMsg}];
    reject(@"NOT_IMPLEMENTED", errorMsg, nil);
}

@end 