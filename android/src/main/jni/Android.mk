LOCAL_PATH := $(call my-dir)

# Build our JNI wrapper  
include $(CLEAR_VARS)
LOCAL_MODULE := gnark_bridge
LOCAL_SRC_FILES := gnark_bridge.c
LOCAL_LDLIBS := -llog -L$(LOCAL_PATH)/../jniLibs/$(TARGET_ARCH_ABI) -lgnarkprover
include $(BUILD_SHARED_LIBRARY)