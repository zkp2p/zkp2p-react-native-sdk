package com.zkp2preactnativesdk

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.WritableNativeArray
import com.facebook.react.bridge.WritableNativeMap
import com.facebook.react.module.annotations.ReactModule

@ReactModule(name = Zkp2pReactNativeSdkModule.NAME)
class Zkp2pReactNativeSdkModule(reactContext: ReactApplicationContext) :
  NativeZkp2pReactNativeSdkSpec(reactContext) {

  override fun getName(): String {
    return NAME
  }

  override fun startAuthentication(provider: ReadableMap, promise: Promise) {
    promise.resolve(null)
  }

  override fun handleSuccess(provider: ReadableMap, promise: Promise) {
    promise.resolve(null)
  }

  override fun handleError(errorMessage: String, promise: Promise) {
    promise.resolve(null)
  }

  override fun generateProof(
    provider: ReadableMap,
    transaction: ReadableMap,
    interceptedPayload: ReadableMap,
    intentHash: String,
    promise: Promise
  ) {
    val result = WritableNativeMap()
    promise.resolve(result)
  }

  override fun handleIntercept(event: ReadableMap, promise: Promise) {
    promise.resolve(null)
  }

  override fun extractTransactionsData(
    provider: ReadableMap,
    jsonResponseBody: String,
    promise: Promise
  ) {
    val result = WritableNativeArray()
    promise.resolve(result)
  }

  companion object {
    const val NAME = "Zkp2pReactNativeSdk"
  }
}
