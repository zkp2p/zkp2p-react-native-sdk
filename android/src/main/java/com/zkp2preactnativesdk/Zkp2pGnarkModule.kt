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
    private val algorithmIdMap = mutableMapOf<String, Int>()
    private var hasListeners = false
    
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
                // First load the gnarkprover library
                System.loadLibrary("gnarkprover")
                Log.i(NAME, "Successfully loaded gnarkprover native library.")
                
                // Then load our JNI bridge
                System.loadLibrary("gnark_bridge")
                Log.i(NAME, "Successfully loaded gnark_bridge native library.")
            } catch (e: UnsatisfiedLinkError) {
                Log.e(
                    NAME,
                    "FATAL: Failed to load native libraries. " +
                    "Ensure both libgnarkprover.so and libgnark_bridge.so are available.",
                    e
                )
                throw e
            }
        }
    }

    init {
        Log.d(NAME, "[Zkp2pGnarkModule] Initialized")
        
        // Build algorithm ID map (matching iOS)
        for (config in ALGORITHM_CONFIGS) {
            algorithmIdMap[config.name] = config.id
        }
        
        // Initialize all algorithms on startup
        initializeAllAlgorithms()
    }

    override fun getName(): String = NAME

    override fun invalidate() {
        super.invalidate()
        coroutineScope.cancel()
    }
    
    private fun initializeAllAlgorithms() {
        Log.d(NAME, "[Zkp2pGnarkModule] Initializing all algorithms...")
        
        for (config in ALGORITHM_CONFIGS) {
            try {
                // Look for circuit files in assets/gnark-circuits
                val pkFilename = "pk.${config.fileExt}"
                val r1csFilename = "r1cs.${config.fileExt}"
                
                Log.d(NAME, "[Zkp2pGnarkModule] Loading circuit files for ${config.name}:")
                Log.d(NAME, "  Looking for: $pkFilename and $r1csFilename")
                
                // Read circuit files from assets
                val pkData = readAssetFile(pkFilename)
                val r1csData = readAssetFile(r1csFilename)
                
                if (pkData == null || r1csData == null) {
                    Log.d(NAME, "[Zkp2pGnarkModule] WARNING: Circuit files not found for ${config.name}")
                    Log.d(NAME, "  Looking for: $pkFilename and $r1csFilename")
                    continue
                }
                
                Log.d(NAME, "[Zkp2pGnarkModule] Found circuit files for ${config.name}:")
                Log.d(NAME, "  PK size: ${pkData.size} bytes")
                Log.d(NAME, "  R1CS size: ${r1csData.size} bytes")
                
                // Initialize algorithm using native method
                try {
                    Log.d(NAME, "[Zkp2pGnarkModule] Calling nativeInitAlgorithm for ${config.name} (id: ${config.id})")
                    val result = nativeInitAlgorithm(config.id, pkData, r1csData)
                    Log.d(NAME, "[Zkp2pGnarkModule] nativeInitAlgorithm returned: $result")
                    
                    if (result == 1) {
                        initializedAlgorithms.add(config.name)
                        Log.d(NAME, "[Zkp2pGnarkModule] ✓ Initialized ${config.name} (id: ${config.id})")
                    } else {
                        Log.e(NAME, "[Zkp2pGnarkModule] ✗ Failed to initialize ${config.name} (id: ${config.id})")
                        Log.e(NAME, "  Algorithm ID: ${config.id}")
                        Log.e(NAME, "  PK size: ${pkData.size} bytes")
                        Log.e(NAME, "  R1CS size: ${r1csData.size} bytes")
                    }
                } catch (e: Exception) {
                    Log.e(NAME, "[Zkp2pGnarkModule] Exception calling nativeInitAlgorithm for ${config.name}", e)
                } catch (e: UnsatisfiedLinkError) {
                    Log.e(NAME, "[Zkp2pGnarkModule] Native method not found for ${config.name}", e)
                } catch (e: Error) {
                    Log.e(NAME, "[Zkp2pGnarkModule] Error calling nativeInitAlgorithm for ${config.name}", e)
                }
                
            } catch (e: Exception) {
                Log.e(NAME, "[Zkp2pGnarkModule] Error initializing ${config.name}", e)
            }
        }
        
        Log.d(NAME, "[Zkp2pGnarkModule] Initialization complete. Available algorithms: ${initializedAlgorithms.joinToString(", ")}")
    }
    
    private fun readAssetFile(filename: String): ByteArray? {
        return try {
            // Look for files in gnark-circuits folder (matching iOS bundle structure)
            val assetPath = "gnark-circuits/$filename"
            Log.d(NAME, "[Zkp2pGnarkModule] Reading asset: $assetPath")
            reactApplicationContext.assets.open(assetPath).use { inputStream ->
                inputStream.readBytes()
            }
        } catch (e: Exception) {
            Log.e(NAME, "[Zkp2pGnarkModule] Failed to read asset file: $filename", e)
            
            // List available assets for debugging
            try {
                Log.e(NAME, "[Zkp2pGnarkModule] Available assets in gnark-circuits:")
                val assets = reactApplicationContext.assets.list("gnark-circuits")
                if (assets != null && assets.isNotEmpty()) {
                    assets.forEach { asset ->
                        Log.e(NAME, "  - $asset")
                    }
                } else {
                    Log.e(NAME, "  (directory is empty or doesn't exist)")
                }
            } catch (listError: Exception) {
                Log.e(NAME, "[Zkp2pGnarkModule] Could not list assets: ${listError.message}")
            }
            
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
        // The witness comes as a JSON string
        val witnessJson = args.getString(0) ?: throw IllegalArgumentException("Witness JSON string is null")
        
        // IMPORTANT: For gnark, we need at least one initialized algorithm (matching iOS check)
        if (initializedAlgorithms.isEmpty()) {
            throw Exception("No algorithms have been initialized. Circuit files may be missing.")
        }
        
        // Log witness preview for debugging
        val witnessPreview = if (witnessJson.length > 200) {
            witnessJson.substring(0, 200) + "..."
        } else {
            witnessJson
        }
        Log.d(NAME, "[Zkp2pGnarkModule] Witness preview: $witnessPreview")
        
        // Extract cipher from witness to verify it's supported
        try {
            val witnessObj = JSONObject(witnessJson)
            val cipher = witnessObj.optString("cipher", "unknown")
            Log.d(NAME, "[Zkp2pGnarkModule] Cipher from witness: $cipher")
            Log.d(NAME, "[Zkp2pGnarkModule] Initialized algorithms: $initializedAlgorithms")
            
            // Check if we have this algorithm initialized
            if (!initializedAlgorithms.contains(cipher)) {
                Log.w(NAME, "[Zkp2pGnarkModule] WARNING: Cipher '$cipher' not found in initialized algorithms")
                Log.w(NAME, "[Zkp2pGnarkModule] Available algorithms: $initializedAlgorithms")
            }
        } catch (e: Exception) {
            Log.e(NAME, "[Zkp2pGnarkModule] Failed to parse witness JSON: ${e.message}")
        }
        
        Log.d(NAME, "[Zkp2pGnarkModule] Calling Prove function...")
        
        // Call the native Prove function
        val resultJson = nativeProve(witnessJson)
        
        Log.d(NAME, "[Zkp2pGnarkModule] Prove result length: ${resultJson.length}")
        
        // Parse the result JSON
        return try {
            val resultObj = JSONObject(resultJson)
            
            val proofValue = resultObj.optString("proof", "")
            val publicSignalsValue = resultObj.optString("publicSignals", "")
            
            Log.d(NAME, "[Zkp2pGnarkModule] Success! Proof generated with keys: ${resultObj.keys()}")
            
            // Log detailed proof structure for debugging (matching iOS)
            Log.d(NAME, "[Zkp2pGnarkModule] === PROOF DETAILS ===")
            Log.d(NAME, "  Proof type: ${proofValue.javaClass.simpleName}")
            Log.d(NAME, "  Proof length: ${proofValue.length}")
            Log.d(NAME, "  Proof preview: ${proofValue.take(100)}")
            Log.d(NAME, "  PublicSignals type: ${publicSignalsValue.javaClass.simpleName}")
            Log.d(NAME, "  PublicSignals length: ${publicSignalsValue.length}")
            Log.d(NAME, "  PublicSignals preview: ${publicSignalsValue.take(100)}")
            Log.d(NAME, "[Zkp2pGnarkModule] ==================")
            
            // The response format should match what the RPC bridge expects
            Arguments.createMap().apply {
                putString("proof", proofValue)
                putString("publicSignals", publicSignalsValue)
            }
        } catch (e: Exception) {
            // If parsing fails, the result might be an error message
            // Check if the raw result looks like an error message (not JSON)
            if (!resultJson.startsWith("{") && !resultJson.startsWith("[")) {
                // The native code returned an error string directly
                Log.e(NAME, "[Zkp2pGnarkModule] Native error: $resultJson")
                throw Exception(resultJson)
            } else {
                // JSON parsing error
                val errorMsg = "Failed to parse result: ${e.message}"
                Log.e(NAME, "[Zkp2pGnarkModule] ERROR: $errorMsg")
                Log.e(NAME, "[Zkp2pGnarkModule] Raw result: $resultJson")
                throw Exception(errorMsg)
            }
        }
    }

    private fun sendResponse(requestId: String, response: WritableMap?, error: Exception?) {
        if (hasListeners) {
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
    }

    // Native method declarations
    private external fun nativeInitAlgorithm(algorithmId: Int, provingKey: ByteArray, r1cs: ByteArray): Int
    private external fun nativeProve(witnessJson: String): String

    // Event emitter methods (matching iOS)
    @ReactMethod
    fun addListener(eventName: String) {
        hasListeners = true
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        hasListeners = false
    }
    
    // Define supported events
    fun supportedEvents(): Array<String> {
        return arrayOf("GnarkRPCResponse")
    }
} 