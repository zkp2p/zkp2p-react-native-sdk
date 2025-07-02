package com.zkp2preactnativesdk

import android.util.Log
import android.util.Base64
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
    private val activeProofJobs = mutableMapOf<String, Job>()
    private val cancelledTasks = mutableSetOf<String>()
    
    data class AlgorithmConfig(
        val name: String,
        val id: Int,
        val fileExt: String
    )
    
    companion object {
        const val NAME = "Zkp2pGnarkModule"
        
        private val ALGORITHM_CONFIGS = arrayOf(
            AlgorithmConfig("chacha20", 0, "chacha20"),
            AlgorithmConfig("aes-128-ctr", 1, "aes128"),
            AlgorithmConfig("aes-256-ctr", 2, "aes256")
        )

        init {
            try {
                System.loadLibrary("gnarkprover")
                System.loadLibrary("gnark_bridge")
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
        for (config in ALGORITHM_CONFIGS) {
            algorithmIdMap[config.name] = config.id
        }
        initializeAllAlgorithms()
    }

    override fun getName(): String = NAME

    override fun invalidate() {
        super.invalidate()
        coroutineScope.cancel()
    }
    
    private fun initializeAllAlgorithms() {
        
        for (config in ALGORITHM_CONFIGS) {
            try {
                val pkFilename = "pk.${config.fileExt}"
                val r1csFilename = "r1cs.${config.fileExt}"
                
                val pkData = readAssetFile(pkFilename)
                val r1csData = readAssetFile(r1csFilename)
                
                if (pkData == null || r1csData == null) {
                    Log.e(NAME, "[Zkp2pGnarkModule] ERROR: Circuit files not found for ${config.name}")
                    continue
                }
                
                try {
                    val result = nativeInitAlgorithm(config.id, pkData, r1csData)
                    
                    if (result == 1) {
                        initializedAlgorithms.add(config.name)
                    } else {
                        Log.e(NAME, "[Zkp2pGnarkModule] ERROR: Failed to initialize ${config.name} (id: ${config.id})")
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
        
    }
    
    private fun readAssetFile(filename: String): ByteArray? {
        return try {
            val assetPath = "gnark-circuits/$filename"
            reactApplicationContext.assets.open(assetPath).use { inputStream ->
                inputStream.readBytes()
            }
        } catch (e: Exception) {
            Log.e(NAME, "[Zkp2pGnarkModule] Failed to read asset file: $filename", e)
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
        // Check if task was already cancelled
        if (cancelledTasks.contains(requestId)) {
            cancelledTasks.remove(requestId)
            val errorMsg = "Proof generation was cancelled"
            sendResponse(requestId, null, Exception(errorMsg))
            promise.reject("CANCELLED", errorMsg)
            return
        }
        
        val job = coroutineScope.launch {
            try {
                when (functionName) {
                    "groth16Prove" -> {
                        Log.d(NAME, "[Zkp2pGnarkModule] groth16Prove called with algorithm: $algorithm")
                        
                        if (initializedAlgorithms.isEmpty()) {
                            throw Exception("No algorithms have been initialized. Circuit files may be missing.")
                        }
                        
                        // Check cancellation before starting
                        if (cancelledTasks.contains(requestId)) {
                            cancelledTasks.remove(requestId)
                            throw CancellationException("Proof generation was cancelled")
                        }
                        
                        val result = groth16Prove(args, requestId)
                        
                        // Check cancellation after proof generation
                        if (cancelledTasks.contains(requestId)) {
                            cancelledTasks.remove(requestId)
                            throw CancellationException("Proof generation was cancelled")
                        }
                        
                        sendResponse(requestId, result, null)
                        promise.resolve(null)
                    }
                    else -> throw Exception("Unsupported ZK function: $functionName")
                }
            } catch (e: CancellationException) {
                Log.d(NAME, "Proof generation cancelled for request: $requestId")
                sendResponse(requestId, null, Exception("Proof generation was cancelled"))
                promise.reject("CANCELLED", e.message)
            } catch (e: Exception) {
                Log.e(NAME, "ZK function execution failed", e)
                sendResponse(requestId, null, e)
                promise.reject("EXECUTION_ERROR", e.message, e)
            } finally {
                activeProofJobs.remove(requestId)
            }
        }
        
        activeProofJobs[requestId] = job
    }

    private fun groth16Prove(args: ReadableArray, requestId: String): WritableMap {
        // Periodically check for cancellation
        if (cancelledTasks.contains(requestId)) {
            throw CancellationException("Proof generation was cancelled")
        }
        
        val argString = args.getString(0) ?: throw IllegalArgumentException("Witness argument is null")
        
        val base64Value = try {
            val argObject = JSONObject(argString)
            argObject.optString("value") ?: argString
        } catch (e: Exception) {
            argString
        }
        
        val witnessBytes = try {
            Base64.decode(base64Value, Base64.DEFAULT)
        } catch (e: Exception) {
            throw IllegalArgumentException("Failed to decode base64 witness data: ${e.message}")
        }
        
        val witnessJson = String(witnessBytes, Charsets.UTF_8)
        
        if (initializedAlgorithms.isEmpty()) {
            throw Exception("No algorithms have been initialized. Circuit files may be missing.")
        }
        
        try {
            val witnessObj = JSONObject(witnessJson)
            val cipher = witnessObj.optString("cipher", "unknown")
            
            if (!initializedAlgorithms.contains(cipher)) {
                Log.w(NAME, "[Zkp2pGnarkModule] WARNING: Cipher '$cipher' not found in initialized algorithms: $initializedAlgorithms")
            }
        } catch (e: Exception) {
            // Ignore if witness is not JSON
        }
        
        // Check cancellation before calling native prove
        if (cancelledTasks.contains(requestId)) {
            throw CancellationException("Proof generation was cancelled")
        }
        
        Log.d(NAME, "[Zkp2pGnarkModule] Calling Prove function")
        
        val resultJson = nativeProve(witnessJson)
        
        return try {
            val resultObj = JSONObject(resultJson)
            
            val proofValue = resultObj.optString("proof", "")
            val publicSignalsValue = resultObj.optString("publicSignals", "")
            
            if (proofValue.isEmpty() || publicSignalsValue.isEmpty()) {
                throw Exception("Missing proof or publicSignals in result")
            }
            
            Log.d(NAME, "[Zkp2pGnarkModule] Proof generated successfully")
            
            Arguments.createMap().apply {
                putString("proof", proofValue)
                putString("publicSignals", publicSignalsValue)
            }
        } catch (e: Exception) {
            if (!resultJson.startsWith("{") && !resultJson.startsWith("[")) {
                Log.e(NAME, "[Zkp2pGnarkModule] Native error: $resultJson")
                throw Exception(resultJson)
            } else {
                val errorMsg = "Failed to parse result: ${e.message}"
                Log.e(NAME, "[Zkp2pGnarkModule] ERROR: $errorMsg")
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

    private external fun nativeInitAlgorithm(algorithmId: Int, provingKey: ByteArray, r1cs: ByteArray): Int
    private external fun nativeProve(witnessJson: String): String

    @ReactMethod
    fun addListener(eventName: String) {
        hasListeners = true
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        hasListeners = false
    }
    
    fun supportedEvents(): Array<String> {
        return arrayOf("GnarkRPCResponse")
    }
    
    @ReactMethod
    fun cancelProofGeneration(requestId: String, promise: Promise) {
        Log.d(NAME, "[Zkp2pGnarkModule] Cancelling proof generation for request: $requestId")
        
        // Mark as cancelled
        cancelledTasks.add(requestId)
        
        // Cancel the coroutine job if it exists
        activeProofJobs[requestId]?.let { job ->
            job.cancel()
            activeProofJobs.remove(requestId)
        }
        
        promise.resolve(Arguments.createMap().apply {
            putBoolean("success", true)
        })
    }
    
    @ReactMethod
    fun cleanupMemory(promise: Promise) {
        Log.d(NAME, "[Zkp2pGnarkModule] Cleaning up memory and cancelling all active tasks")
        
        // Cancel all active jobs
        activeProofJobs.forEach { (requestId, job) ->
            cancelledTasks.add(requestId)
            job.cancel()
        }
        activeProofJobs.clear()
        cancelledTasks.clear()
        
        // Suggest garbage collection (note: this is just a hint to the system)
        System.gc()
        
        promise.resolve(Arguments.createMap().apply {
            putBoolean("success", true)
        })
    }
    
    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        Log.d(NAME, "[Zkp2pGnarkModule] Catalyst instance destroying, cleaning up resources")
        
        // Cancel all active jobs
        activeProofJobs.forEach { (requestId, job) ->
            cancelledTasks.add(requestId)
            job.cancel()
        }
        activeProofJobs.clear()
        cancelledTasks.clear()
        
        // Cancel the coroutine scope
        coroutineScope.cancel()
    }
} 