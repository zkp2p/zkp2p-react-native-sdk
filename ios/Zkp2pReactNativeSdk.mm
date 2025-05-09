#import "Zkp2pReactNativeSdk.h"

@implementation Zkp2pReactNativeSdk
RCT_EXPORT_MODULE()

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
    return std::make_shared<facebook::react::NativeZkp2pReactNativeSdkSpecJSI>(params);
}

@end
