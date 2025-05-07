package com.zkp2preactnativesdk

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule

@ReactModule(name = Zkp2pReactNativeSdkModule.NAME)
class Zkp2pReactNativeSdkModule(reactContext: ReactApplicationContext) :
  NativeZkp2pReactNativeSdkSpec(reactContext) {

  override fun getName(): String {
    return NAME
  }

  // Example method
  // See https://reactnative.dev/docs/native-modules-android
  override fun multiply(a: Double, b: Double): Double {
    return a * b
  }

  companion object {
    const val NAME = "Zkp2pReactNativeSdk"
  }
}
