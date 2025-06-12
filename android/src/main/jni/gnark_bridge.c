#include <jni.h>
#include <string.h>
#include <stdlib.h>
#include <android/log.h>

#define LOG_TAG "GnarkBridge"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

// Go types - matching libgnarkprover.h
typedef long long GoInt64;
typedef GoInt64 GoInt;
typedef unsigned char GoUint8;
typedef struct { void *data; GoInt len; GoInt cap; } GoSlice;

// Define the Prove return type
struct Prove_return {
    void* r0;
    GoInt r1;
};

// Go function declarations
extern GoUint8 InitAlgorithm(GoUint8 algorithmID, GoSlice provingKey, GoSlice r1cs);
extern struct Prove_return Prove(GoSlice params);
extern void Free(void* pointer);

// JNI function for InitAlgorithm
JNIEXPORT jint JNICALL
Java_com_zkp2preactnativesdk_Zkp2pGnarkModule_nativeInitAlgorithm(
    JNIEnv *env,
    jobject thiz,
    jint algorithmId,
    jbyteArray provingKey,
    jbyteArray r1cs) {
    
    // Get array lengths
    jsize pkLen = (*env)->GetArrayLength(env, provingKey);
    jsize r1csLen = (*env)->GetArrayLength(env, r1cs);
    
    // Get pointers to array data
    jbyte *pkData = (*env)->GetByteArrayElements(env, provingKey, NULL);
    jbyte *r1csData = (*env)->GetByteArrayElements(env, r1cs, NULL);
    
    if (!pkData || !r1csData) {
        LOGE("Failed to get byte array elements");
        if (pkData) (*env)->ReleaseByteArrayElements(env, provingKey, pkData, JNI_ABORT);
        if (r1csData) (*env)->ReleaseByteArrayElements(env, r1cs, r1csData, JNI_ABORT);
        return 0;
    }
    
    // Create GoSlices - cast to void* to match iOS implementation
    GoSlice pkSlice;
    pkSlice.data = (void*)pkData;
    pkSlice.len = pkLen;
    pkSlice.cap = pkLen;
    
    GoSlice r1csSlice;
    r1csSlice.data = (void*)r1csData;
    r1csSlice.len = r1csLen;
    r1csSlice.cap = r1csLen;
    
    LOGI("Calling InitAlgorithm with id=%d, pk_len=%d, r1cs_len=%d", 
         (int)algorithmId, (int)pkLen, (int)r1csLen);
    
    // Log first few bytes of data for verification
    if (pkLen >= 8 && r1csLen >= 8) {
        LOGI("PK first 8 bytes: %02x %02x %02x %02x %02x %02x %02x %02x", 
             (unsigned char)pkData[0], (unsigned char)pkData[1], 
             (unsigned char)pkData[2], (unsigned char)pkData[3],
             (unsigned char)pkData[4], (unsigned char)pkData[5],
             (unsigned char)pkData[6], (unsigned char)pkData[7]);
        LOGI("R1CS first 8 bytes: %02x %02x %02x %02x %02x %02x %02x %02x", 
             (unsigned char)r1csData[0], (unsigned char)r1csData[1], 
             (unsigned char)r1csData[2], (unsigned char)r1csData[3],
             (unsigned char)r1csData[4], (unsigned char)r1csData[5],
             (unsigned char)r1csData[6], (unsigned char)r1csData[7]);
    }
    
    // Call Go function
    GoUint8 result = InitAlgorithm((GoUint8)algorithmId, pkSlice, r1csSlice);
    
    LOGI("InitAlgorithm returned: %d for algorithm %d", (int)result, (int)algorithmId);
    
    // Release array data
    (*env)->ReleaseByteArrayElements(env, provingKey, pkData, JNI_ABORT);
    (*env)->ReleaseByteArrayElements(env, r1cs, r1csData, JNI_ABORT);
    
    return (jint)result;
}

// JNI function for Prove
JNIEXPORT jstring JNICALL
Java_com_zkp2preactnativesdk_Zkp2pGnarkModule_nativeProve(
    JNIEnv *env,
    jobject thiz,
    jstring witnessJson) {
    
    // Convert Java string to C string
    const char *witnessStr = (*env)->GetStringUTFChars(env, witnessJson, NULL);
    if (!witnessStr) {
        LOGE("Failed to get witness string");
        return NULL;
    }
    
    jsize len = (*env)->GetStringUTFLength(env, witnessJson);
    
    // Create GoSlice from string
    GoSlice witnessSlice;
    witnessSlice.data = (void*)witnessStr;
    witnessSlice.len = len;
    witnessSlice.cap = len;
    
    LOGI("Calling Prove with witness length=%d", (int)len);
    
    // Call Go Prove function
    struct Prove_return result = Prove(witnessSlice);
    
    LOGI("Prove returned: r0=%p, r1=%lld", result.r0, (long long)result.r1);
    
    // Release Java string
    (*env)->ReleaseStringUTFChars(env, witnessJson, witnessStr);
    
    // Convert result to Java string
    jstring resultStr = NULL;
    if (result.r0 != NULL && result.r1 > 0) {
        // Create a null-terminated string from the result
        char *tempStr = (char*)malloc(result.r1 + 1);
        if (tempStr) {
            memcpy(tempStr, result.r0, result.r1);
            tempStr[result.r1] = '\0';
            
            // Create Java string
            resultStr = (*env)->NewStringUTF(env, tempStr);
            
            // Free temporary string
            free(tempStr);
        }
        
        // Free the memory allocated by Go
        Free(result.r0);
    }
    
    return resultStr;
}