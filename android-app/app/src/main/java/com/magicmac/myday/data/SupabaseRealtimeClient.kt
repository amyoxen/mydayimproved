package com.magicmac.myday.data

import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import kotlin.math.min

class SupabaseRealtimeClient(
    private val baseUrl: String,
    private val apiKey: String,
    private val onTasksChanged: () -> Unit,
) {
    private val TAG = "SupabaseRealtime"

    private val client = OkHttpClient.Builder()
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .pingInterval(30, TimeUnit.SECONDS)
        .build()

    private var webSocket: WebSocket? = null
    private var heartbeatJob: Job? = null
    private var reconnectJob: Job? = null
    private var debounceJob: Job? = null
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val refCounter = AtomicInteger(0)

    private var currentAccessToken: String? = null
    private var currentUserId: String? = null
    private var isConnecting = false
    private var isConnected = false

    // Reconnect backoff
    private var reconnectAttempt = 0
    private val maxReconnectDelay = 30_000L

    // Self-change suppression
    @Volatile
    private var suppressUntil = 0L

    fun connect(accessToken: String, userId: String) {
        if (isConnected || isConnecting) return
        isConnecting = true
        currentAccessToken = accessToken
        currentUserId = userId

        val wsUrl = baseUrl
            .replace("https://", "wss://")
            .replace("http://", "ws://")
            .trimEnd('/')
        val url = "$wsUrl/realtime/v1/websocket?apikey=$apiKey&vsn=1.0.0"

        val request = Request.Builder().url(url).build()
        webSocket = client.newWebSocket(request, RealtimeWebSocketListener())
        Log.d(TAG, "Connecting to Supabase Realtime...")
    }

    fun disconnect() {
        isConnecting = false
        isConnected = false
        heartbeatJob?.cancel()
        heartbeatJob = null
        reconnectJob?.cancel()
        reconnectJob = null
        debounceJob?.cancel()
        debounceJob = null
        reconnectAttempt = 0
        webSocket?.close(1000, "Client disconnect")
        webSocket = null
        Log.d(TAG, "Disconnected")
    }

    fun suppressChanges(durationMs: Long = 2000) {
        suppressUntil = System.currentTimeMillis() + durationMs
    }

    fun updateToken(newAccessToken: String) {
        currentAccessToken = newAccessToken
        if (isConnected) {
            val topic = channelTopic() ?: return
            val payload = JSONObject().apply {
                put("access_token", newAccessToken)
            }
            sendMessage(null, nextRef(), topic, "access_token", payload)
            Log.d(TAG, "Token updated on WebSocket")
        }
    }

    private fun channelTopic(): String? {
        val userId = currentUserId ?: return null
        return "realtime:tasks-$userId"
    }

    private fun nextRef(): String = refCounter.getAndIncrement().toString()

    private fun sendMessage(
        joinRef: String?,
        ref: String,
        topic: String,
        event: String,
        payload: JSONObject,
    ) {
        val msg = JSONArray().apply {
            put(joinRef ?: JSONObject.NULL)
            put(ref)
            put(topic)
            put(event)
            put(payload)
        }
        webSocket?.send(msg.toString())
    }

    private fun joinChannel() {
        val topic = channelTopic() ?: return
        val token = currentAccessToken ?: return
        val joinRef = nextRef()

        val postgresConfig = JSONObject().apply {
            put("event", "*")
            put("schema", "public")
            put("table", "tasks")
            put("filter", "user_id=eq.$currentUserId")
        }

        val config = JSONObject().apply {
            put("broadcast", JSONObject().put("self", false))
            put("presence", JSONObject().put("key", ""))
            put("postgres_changes", JSONArray().put(postgresConfig))
        }

        val payload = JSONObject().apply {
            put("config", config)
            put("access_token", token)
        }

        sendMessage(joinRef, joinRef, topic, "phx_join", payload)
        Log.d(TAG, "Joining channel: $topic")
    }

    private fun startHeartbeat() {
        heartbeatJob?.cancel()
        heartbeatJob = scope.launch {
            while (true) {
                delay(30_000)
                sendMessage(null, nextRef(), "phoenix", "heartbeat", JSONObject())
            }
        }
    }

    private fun onChangeReceived() {
        if (System.currentTimeMillis() < suppressUntil) {
            Log.d(TAG, "Change suppressed (self-change)")
            return
        }
        debounceJob?.cancel()
        debounceJob = scope.launch {
            delay(500)
            Log.d(TAG, "Realtime change detected, reloading tasks")
            onTasksChanged()
        }
    }

    private fun scheduleReconnect() {
        if (reconnectJob?.isActive == true) return
        val delayMs = min(1000L * (1L shl min(reconnectAttempt, 5)), maxReconnectDelay)
        reconnectAttempt++
        Log.d(TAG, "Scheduling reconnect in ${delayMs}ms (attempt $reconnectAttempt)")

        reconnectJob = scope.launch {
            delay(delayMs)
            val token = currentAccessToken
            val userId = currentUserId
            if (token != null && userId != null) {
                isConnecting = false
                isConnected = false
                webSocket = null
                connect(token, userId)
            }
        }
    }

    private inner class RealtimeWebSocketListener : WebSocketListener() {
        override fun onOpen(webSocket: WebSocket, response: Response) {
            Log.d(TAG, "WebSocket opened")
            isConnecting = false
            joinChannel()
            startHeartbeat()
        }

        override fun onMessage(webSocket: WebSocket, text: String) {
            Log.d(TAG, "WS message: $text")
            try {
                val msg = JSONArray(text)
                val event = msg.optString(3)
                val payload = msg.optJSONObject(4)

                when (event) {
                    "phx_reply" -> {
                        val status = payload?.optString("status")
                        Log.d(TAG, "phx_reply status=$status")
                        if (status == "ok") {
                            val response = payload?.optJSONObject("response")
                            val pgChanges = response?.optJSONArray("postgres_changes")
                            if (pgChanges != null) {
                                // This is a successful join reply
                                isConnected = true
                                reconnectAttempt = 0
                                Log.d(TAG, "Channel joined successfully, postgres_changes: $pgChanges")
                            }
                        } else if (status == "error") {
                            Log.e(TAG, "Channel error: $payload")
                            isConnected = false
                            scheduleReconnect()
                        }
                    }
                    "postgres_changes" -> {
                        Log.d(TAG, "postgres_changes event received")
                        onChangeReceived()
                    }
                    "phx_error" -> {
                        Log.e(TAG, "Phoenix error: $payload")
                        isConnected = false
                        scheduleReconnect()
                    }
                    "phx_close" -> {
                        Log.d(TAG, "Phoenix close")
                        isConnected = false
                        scheduleReconnect()
                    }
                    "system" -> {
                        Log.d(TAG, "System message: $payload")
                    }
                    else -> {
                        Log.d(TAG, "Unhandled event: $event")
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error parsing message: $text", e)
            }
        }

        override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
            Log.e(TAG, "WebSocket failure: ${t.message}")
            isConnecting = false
            isConnected = false
            heartbeatJob?.cancel()
            scheduleReconnect()
        }

        override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
            Log.d(TAG, "WebSocket closed: $code $reason")
            isConnecting = false
            isConnected = false
            heartbeatJob?.cancel()
            // Don't reconnect if we deliberately closed
            if (code != 1000) {
                scheduleReconnect()
            }
        }
    }
}
