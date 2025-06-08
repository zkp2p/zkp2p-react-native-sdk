package com.zkp2preactnativesdk

import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import kotlinx.coroutines.*
import org.json.JSONObject
import org.json.JSONArray
import java.io.File

class Zkp2pGnarkModule(reactContext: ReactApplicationContext) : 
    ReactContextBaseJavaModule(reactContext) {

    private val gnarkLibraries = mutableMapOf<String, Long>()
    private val coroutineScope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    init {
        loadGnarkLibraries()
    }

    override fun getName(): String = "Zkp2pGnarkModule"

    private fun loadGnarkLibraries() {
        try {
            // Determine architecture
            val arch = when (System.getProperty("os.arch")) {
                "aarch64" -> "arm64"
                "x86_64" -> "x86_64"
                else -> throw Exception("Unsupported architecture: ${System.getProperty("os.arch")}")
            }

            // Load prove library
            val proveLibName = "linux-$arch-libprove"
            System.loadLibrary(proveLibName)
            
            // Load verify library
            val verifyLibName = "linux-$arch-libverify"
            System.loadLibrary(verifyLibName)
            
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    @ReactMethod
    fun executeZkFunction(
        requestId: String,
        functionName: String,
        args: ReadableArray,
        algorithm: String
    ) {
        coroutineScope.launch {
            try {
                val result = when (functionName) {
                    "groth16Prove" -> groth16Prove(args, algorithm)
                    "groth16Verify" -> groth16Verify(args, algorithm)
                    "generateWitness" -> {
                        // Witness generation is handled in JS
                        args.getMap(0)
                    }
                    else -> throw Exception("Unsupported function: $functionName")
                }

                sendEvent(requestId, result, null)
            } catch (e: Exception) {
                sendEvent(requestId, null, e)
            }
        }
    }

    @ReactMethod
    fun executeOprfFunction(
        requestId: String,
        functionName: String,
        args: ReadableArray,
        algorithm: String
    ) {
        coroutineScope.launch {
            try {
                val result = when (functionName) {
                    "generateThresholdKeys" -> generateThresholdKeys(args)
                    "generateOPRFRequestData" -> generateOPRFRequestData(args)
                    "finaliseOPRF" -> finaliseOPRF(args)
                    "evaluateOPRF" -> evaluateOPRF(args)
                    "groth16Prove", "groth16Verify", "generateWitness" -> {
                        // Fallback to ZK functions
                        executeZkFunctionInternal(functionName, args, algorithm)
                    }
                    else -> throw Exception("Unsupported function: $functionName")
                }

                sendEvent(requestId, result, null)
            } catch (e: Exception) {
                sendEvent(requestId, null, e)
            }
        }
    }

    private fun executeZkFunctionInternal(
        functionName: String,
        args: ReadableArray,
        algorithm: String
    ): Any? {
        return when (functionName) {
            "groth16Prove" -> groth16Prove(args, algorithm)
            "groth16Verify" -> groth16Verify(args, algorithm)
            "generateWitness" -> args.getMap(0)
            else -> throw Exception("Unsupported function: $functionName")
        }
    }

    private fun groth16Prove(args: ReadableArray, algorithm: String): WritableMap {
        val witness = args.getMap(0) ?: throw Exception("Invalid witness data")
        
        // Convert witness to JSON
        val witnessJson = JSONObject().apply {
            witness.toHashMap().forEach { (key, value) ->
                put(key, value)
            }
        }.toString()

        // Call native prove function
        val functionName = "prove_${algorithm.replace("-", "_")}"
        val resultJson = nativeProve(functionName, witnessJson)
        
        // Parse result
        val resultObj = JSONObject(resultJson)
        return Arguments.createMap().apply {
            putMap("proof", parseJsonToMap(resultObj.getJSONObject("proof")))
            putArray("publicSignals", parseJsonArray(resultObj.getJSONArray("publicSignals")))
        }
    }

    private fun groth16Verify(args: ReadableArray, algorithm: String): Boolean {
        val publicSignals = args.getArray(0) ?: throw Exception("Invalid public signals")
        val proof = args.getMap(1) ?: throw Exception("Invalid proof")

        // Convert to JSON
        val verifyInput = JSONObject().apply {
            put("publicSignals", JSONArray().apply {
                for (i in 0 until publicSignals.size()) {
                    put(publicSignals.getString(i))
                }
            })
            put("proof", JSONObject().apply {
                proof.toHashMap().forEach { (key, value) ->
                    put(key, value)
                }
            })
        }.toString()

        // Call native verify function
        val functionName = "verify_${algorithm.replace("-", "_")}"
        return nativeVerify(functionName, verifyInput) == 1
    }

    // OPRF function stubs
    private fun generateThresholdKeys(args: ReadableArray): WritableMap {
        return Arguments.createMap().apply {
            putArray("keys", Arguments.createArray())
            putString("publicKey", "")
        }
    }

    private fun generateOPRFRequestData(args: ReadableArray): WritableMap {
        return Arguments.createMap().apply {
            putString("request", "")
            putString("blindingFactor", "")
        }
    }

    private fun finaliseOPRF(args: ReadableArray): WritableMap {
        return Arguments.createMap().apply {
            putString("output", "")
        }
    }

    private fun evaluateOPRF(args: ReadableArray): WritableMap {
        return Arguments.createMap().apply {
            putString("response", "")
        }
    }

    private fun sendEvent(requestId: String, response: Any?, error: Exception?) {
        val params = Arguments.createMap().apply {
            putString("id", requestId)
            
            if (error != null) {
                putNull("response")
                putMap("error", Arguments.createMap().apply {
                    putString("message", error.message ?: "Unknown error")
                    putString("name", error.javaClass.simpleName)
                })
            } else {
                when (response) {
                    is WritableMap -> putMap("response", response)
                    is Boolean -> putBoolean("response", response)
                    is String -> putString("response", response)
                    else -> putNull("response")
                }
                putNull("error")
            }
        }

        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit("GnarkRPCResponse", params)
    }

    private fun parseJsonToMap(json: JSONObject): WritableMap {
        return Arguments.createMap().apply {
            json.keys().forEach { key ->
                when (val value = json.get(key)) {
                    is String -> putString(key, value)
                    is Int -> putInt(key, value)
                    is Double -> putDouble(key, value)
                    is Boolean -> putBoolean(key, value)
                    is JSONObject -> putMap(key, parseJsonToMap(value))
                    is JSONArray -> putArray(key, parseJsonArray(value))
                }
            }
        }
    }

    private fun parseJsonArray(json: JSONArray): WritableArray {
        return Arguments.createArray().apply {
            for (i in 0 until json.length()) {
                when (val value = json.get(i)) {
                    is String -> pushString(value)
                    is Int -> pushInt(value)
                    is Double -> pushDouble(value)
                    is Boolean -> pushBoolean(value)
                    is JSONObject -> pushMap(parseJsonToMap(value))
                    is JSONArray -> pushArray(parseJsonArray(value))
                }
            }
        }
    }

    // Native method declarations
    private external fun nativeProve(functionName: String, witnessJson: String): String
    private external fun nativeVerify(functionName: String, verifyInputJson: String): Int

    companion object {
        init {
            // Ensure native libraries are loaded
            try {
                val arch = when (System.getProperty("os.arch")) {
                    "aarch64" -> "arm64"
                    "x86_64" -> "x86_64"
                    else -> "x86_64"
                }
                System.loadLibrary("linux-$arch-libprove")
                System.loadLibrary("linux-$arch-libverify")
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }
} 