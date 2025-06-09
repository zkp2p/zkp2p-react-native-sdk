package com.zkp2preactnativesdk

import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import kotlinx.coroutines.*
import org.json.JSONObject
import org.json.JSONArray
import java.io.File
import java.io.InputStream

class Zkp2pGnarkModule(reactContext: ReactApplicationContext) : 
    ReactContextBaseJavaModule(reactContext) {

    private val coroutineScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val initializedAlgorithms = mutableSetOf<String>()
    
    // Algorithm configuration matching iOS
    data class AlgorithmConfig(
        val name: String,
        val id: Int,
        val fileExt: String
    )
    
    companion object {
        const val NAME = "Zkp2pGnarkModule"
        
        // Algorithm IDs must match Go constants
        private val ALGORITHM_CONFIGS = arrayOf(
            AlgorithmConfig("chacha20", 0, "chacha20"),      // CHACHA20 = 0
            AlgorithmConfig("aes-128-ctr", 1, "aes128"),     // AES_128 = 1
            AlgorithmConfig("aes-256-ctr", 2, "aes256")      // AES_256 = 2
        )

        init {
            try {
                // Load the single gnarkprover library
                System.loadLibrary("gnarkprover")
                Log.i(NAME, "Successfully loaded gnarkprover native library.")
            } catch (e: UnsatisfiedLinkError) {
                Log.e(
                    NAME,
                    "FATAL: Failed to load gnarkprover native library. " +
                    "Ensure libgnarkprover.so is in the correct jniLibs directory.",
                    e
                )
                throw e
            }
        }
    }

    init {
        Log.d(NAME, "Zkp2pGnarkModule initialized")
        initializeAllAlgorithms()
    }

    override fun getName(): String = NAME

    override fun invalidate() {
        super.invalidate()
        coroutineScope.cancel()
    }
    
    private fun initializeAllAlgorithms() {
        Log.d(NAME, "Initializing all algorithms...")
        
        for (config in ALGORITHM_CONFIGS) {
            try {
                // Look for circuit files in assets
                val pkFilename = "pk.${config.fileExt}"
                val r1csFilename = "r1cs.${config.fileExt}"
                
                Log.d(NAME, "Loading circuit files for ${config.name}:")
                Log.d(NAME, "  PK: $pkFilename")
                Log.d(NAME, "  R1CS: $r1csFilename")
                
                // Read circuit files from assets
                val pkData = readAssetFile(pkFilename)
                val r1csData = readAssetFile(r1csFilename)
                
                if (pkData == null || r1csData == null) {
                    Log.w(NAME, "WARNING: Circuit files not found for ${config.name}")
                    continue
                }
                
                Log.d(NAME, "  PK size: ${pkData.size} bytes")
                Log.d(NAME, "  R1CS size: ${r1csData.size} bytes")
                
                // Initialize algorithm using native method
                val result = nativeInitAlgorithm(config.id, pkData, r1csData)
                
                if (result == 1) {
                    initializedAlgorithms.add(config.name)
                    Log.d(NAME, "✓ Initialized ${config.name} (id: ${config.id})")
                } else {
                    Log.e(NAME, "✗ Failed to initialize ${config.name} (id: ${config.id})")
                }
                
            } catch (e: Exception) {
                Log.e(NAME, "Error initializing ${config.name}", e)
            }
        }
        
        Log.d(NAME, "Initialization complete. Available algorithms: ${initializedAlgorithms.joinToString(", ")}")
    }
    
    private fun readAssetFile(filename: String): ByteArray? {
        return try {
            reactApplicationContext.assets.open("gnark-circuits/$filename").use { inputStream ->
                inputStream.readBytes()
            }
        } catch (e: Exception) {
            Log.e(NAME, "Failed to read asset file: $filename", e)
            null
        }
    }



    @ReactMethod
    fun executeZkFunction(
        requestId: String,
        functionName: String,
        args: ReadableArray,
        algorithm: String,
        promise: Promise
    ) {
        coroutineScope.launch {
            try {
                when (functionName) {
                    "groth16Prove" -> {
                        Log.d(NAME, "groth16Prove called")
                        Log.d(NAME, "  Algorithm parameter: $algorithm")
                        Log.d(NAME, "  Available algorithms: ${initializedAlgorithms.joinToString(", ")}")
                        
                        if (initializedAlgorithms.isEmpty()) {
                            throw Exception("No algorithms have been initialized. Circuit files may be missing.")
                        }
                        
                        val result = groth16Prove(args)
                        sendResponse(requestId, result, null)
                        promise.resolve(null)
                    }
                    "groth16Verify" -> {
                        // Verification is server-side according to the README
                        throw Exception("Verification is not implemented on the client")
                    }
                    else -> throw Exception("Unsupported ZK function: $functionName")
                }
            } catch (e: Exception) {
                Log.e(NAME, "ZK function execution failed", e)
                sendResponse(requestId, null, e)
                promise.reject("EXECUTION_ERROR", e.message, e)
            }
        }
    }

    private fun groth16Prove(args: ReadableArray): WritableMap {
        val witnessJson = args.getString(0) ?: throw IllegalArgumentException("Witness JSON string is null")
        
        // Log witness preview
        val witnessPreview = if (witnessJson.length > 200) {
            witnessJson.substring(0, 200) + "..."
        } else {
            witnessJson
        }
        Log.d(NAME, "Witness preview: $witnessPreview")
        
        Log.d(NAME, "Calling Prove function...")
        
        val resultJson = nativeProve(witnessJson)
        
        Log.d(NAME, "Prove result length: ${resultJson.length}")
        
        // Parse the result JSON
        return try {
            val resultObj = JSONObject(resultJson)
            
            // The response format should match what the RPC system expects
            Arguments.createMap().apply {
                putString("proof", resultObj.optString("proof", ""))
                putString("publicSignals", resultObj.optString("publicSignals", ""))
            }
        } catch (e: Exception) {
            // The result is not valid JSON, treat it as an error message
            Log.e(NAME, "ERROR from gnark: $resultJson")
            throw Exception("Failed to parse proof result")
        }
    }

    private fun sendResponse(requestId: String, response: WritableMap?, error: Exception?) {
        val body = Arguments.createMap().apply {
            putString("id", requestId)
            putString("type", if (error != null) "error" else "response")

            if (error != null) {
                putMap("error", Arguments.createMap().apply {
                    putString("message", error.message ?: "Unknown error")
                })
            } else if (response != null) {
                putMap("response", response)
            }
        }

        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit("GnarkRPCResponse", body)
    }

    // Native method declarations
    private external fun nativeInitAlgorithm(algorithmId: Int, provingKey: ByteArray, r1cs: ByteArray): Int
    private external fun nativeProve(witnessJson: String): String

    // Event emitter methods
    @ReactMethod
    fun addListener(eventName: String) {
        // Keep track of listeners if needed
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Remove listeners if needed
    }
} 