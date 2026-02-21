package com.magicmac.myday.data

import android.content.Context
import com.magicmac.myday.BuildConfig
import com.magicmac.myday.model.AuthSession
import com.magicmac.myday.model.Task
import com.magicmac.myday.widget.MyDayWidgetProvider
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import java.util.UUID

class TaskRepository(context: Context) {
    private val appContext = context.applicationContext
    private val baseUrl = BuildConfig.SUPABASE_URL.ifBlank { "" }
    private val apiKey = BuildConfig.SUPABASE_ANON_KEY.ifBlank { "" }
    private val sessionStore = SessionStore(appContext)
    private val widgetCache = WidgetTaskCache(appContext)
    private val backgroundScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private val _tasksFlow = MutableSharedFlow<List<Task>>(extraBufferCapacity = 1)
    val tasksFlow: SharedFlow<List<Task>> = _tasksFlow

    private val realtimeClient by lazy {
        SupabaseRealtimeClient(
            baseUrl = baseUrl,
            apiKey = apiKey,
            onTasksChanged = {
                backgroundScope.launch {
                    runCatching { loadTasks(refreshWidget = true) }
                        .onSuccess { tasks -> _tasksFlow.tryEmit(tasks) }
                }
            },
        )
    }

    private val retrofit: Retrofit by lazy {
        val logger = HttpLoggingInterceptor().apply { level = HttpLoggingInterceptor.Level.BASIC }
        val client = OkHttpClient.Builder().addInterceptor(logger).build()
        Retrofit.Builder()
            .baseUrl(if (baseUrl.endsWith("/")) baseUrl else "$baseUrl/")
            .client(client)
            .addConverterFactory(
                MoshiConverterFactory.create(
                    Moshi.Builder()
                        .add(KotlinJsonAdapterFactory())
                        .build()
                )
            )
            .build()
    }

    private val authApi: SupabaseAuthApi by lazy { retrofit.create(SupabaseAuthApi::class.java) }
    private val tasksApi: SupabaseTasksApi by lazy { retrofit.create(SupabaseTasksApi::class.java) }

    suspend fun getSession(): AuthSession? = sessionStore.sessionFlow.first()

    suspend fun connectRealtime() {
        val session = getSession() ?: return
        realtimeClient.connect(session.accessToken, session.userId)
    }

    fun disconnectRealtime() {
        realtimeClient.disconnect()
    }

    /**
     * Refreshes the access token using the stored refresh token.
     * Returns the new session if successful, null if refresh failed.
     */
    private suspend fun refreshSession(): AuthSession? {
        val session = getSession() ?: return null
        return try {
            val response = authApi.refreshToken(
                apiKey = apiKey,
                body = RefreshTokenRequest(refreshToken = session.refreshToken),
            )
            val newSession = AuthSession(
                accessToken = response.accessToken,
                refreshToken = response.refreshToken,
                userId = response.user.id,
                email = response.user.email,
            )
            sessionStore.save(newSession)
            realtimeClient.updateToken(newSession.accessToken)
            newSession
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Wraps an API call with automatic token refresh on 401.
     * If the call fails with 401, refreshes the token and retries once.
     * If refresh fails, signs out.
     */
    private suspend fun <T> withAutoRefresh(
        call: suspend (session: AuthSession) -> T
    ): T {
        val session = getSession() ?: error("Not signed in")
        return try {
            call(session)
        } catch (e: retrofit2.HttpException) {
            if (e.code() == 401) {
                // Try refreshing the token
                val newSession = refreshSession()
                if (newSession != null) {
                    // Retry with new token
                    call(newSession)
                } else {
                    // Refresh failed - sign out
                    signOut()
                    throw e
                }
            } else {
                throw e
            }
        }
    }

    suspend fun signIn(email: String, password: String): AuthSession {
        require(baseUrl.isNotBlank() && apiKey.isNotBlank()) {
            "Set SUPABASE_URL and SUPABASE_ANON_KEY in android-app/gradle.properties."
        }
        val response = authApi.login(apiKey = apiKey, body = LoginRequest(email = email, password = password))
        val session = AuthSession(
            accessToken = response.accessToken,
            refreshToken = response.refreshToken,
            userId = response.user.id,
            email = response.user.email,
        )
        sessionStore.save(session)
        return session
    }

    suspend fun signOut() {
        disconnectRealtime()
        sessionStore.clear()
        widgetCache.saveTasks(emptyList<Task>())
        MyDayWidgetProvider.refreshAll(appContext)
    }

    suspend fun loadTasks(refreshWidget: Boolean = true): List<Task> {
        if (getSession() == null) return emptyList()
        val tasks = withAutoRefresh { session ->
            tasksApi.getTasks(
                apiKey = apiKey,
                authorization = "Bearer ${session.accessToken}",
                userIdEq = "eq.${session.userId}",
            )
        }
        // Update cache
        widgetCache.saveTasks(tasks.filter { it.day == todayKey() })
        // Only refresh widget if requested
        if (refreshWidget) {
            MyDayWidgetProvider.refreshAll(appContext)
        }
        return tasks
    }

    suspend fun addTask(text: String): Task {
        if (getSession() == null) error("Not signed in")
        realtimeClient.suppressChanges()
        val today = todayKey()
        val tempId = "temp-${UUID.randomUUID()}"
        val now = java.time.Instant.now().toString()

        // Optimistic update - add to widget cache immediately
        val currentTasks = widgetCache.getTasks()
        val maxSortOrder = currentTasks.filter { !it.completed }.maxOfOrNull { it.sortOrder } ?: -1
        val tempWidgetTask = WidgetTask(
            id = tempId,
            text = text,
            completed = false,
            createdAt = now,
            sortOrder = maxSortOrder + 1,
        )
        widgetCache.saveWidgetTasksDirect(currentTasks + tempWidgetTask)
        MyDayWidgetProvider.refreshAll(appContext)

        // Background sync
        backgroundScope.launch {
            try {
                withAutoRefresh { session ->
                    tasksApi.addTask(
                        apiKey = apiKey,
                        authorization = "Bearer ${session.accessToken}",
                        body = listOf(CreateTaskRequest(userId = session.userId, text = text, completed = false, day = today)),
                    ).first()
                }
                // Reload fresh data (quietly update cache, no visible widget refresh)
                loadTasks(refreshWidget = true)
            } catch (e: Exception) {
                // On error, reload from server to roll back optimistic update
                runCatching { loadTasks(refreshWidget = true) }
            }
        }

        // Return a temporary task for in-app UI
        return Task(
            id = tempId,
            text = text,
            completed = false,
            createdAt = now,
            day = today
        )
    }

    suspend fun toggleTask(taskId: String, completedNow: Boolean) {
        if (getSession() == null) return
        realtimeClient.suppressChanges()

        // Instant feedback - update cache and refresh before background sync
        val currentTasks = widgetCache.getTasks()
        if (currentTasks.isNotEmpty()) {
            val updatedTasks = currentTasks.map { task ->
                if (task.id == taskId) task.copy(completed = completedNow) else task
            }
            widgetCache.saveWidgetTasksDirect(updatedTasks)
            MyDayWidgetProvider.refreshAll(appContext)
        }

        // Server sync in background
        backgroundScope.launch {
            try {
                withAutoRefresh { session ->
                    tasksApi.updateTask(
                        apiKey = apiKey,
                        authorization = "Bearer ${session.accessToken}",
                        idEq = "eq.$taskId",
                        body = UpdateTaskRequest(completed = completedNow),
                    )
                }
                loadTasks(refreshWidget = false)
            } catch (e: Exception) {
                // On error, reload and refresh widget to roll back
                runCatching { loadTasks(refreshWidget = true) }
            }
        }
    }

    suspend fun updateTaskText(taskId: String, newText: String) {
        if (getSession() == null) return
        realtimeClient.suppressChanges()

        // Instant feedback - update cache and refresh before background sync
        val currentTasks = widgetCache.getTasks()
        if (currentTasks.isNotEmpty()) {
            val updatedTasks = currentTasks.map { task ->
                if (task.id == taskId) task.copy(text = newText) else task
            }
            widgetCache.saveWidgetTasksDirect(updatedTasks)
            MyDayWidgetProvider.refreshAll(appContext)
        }

        // Server sync in background
        backgroundScope.launch {
            try {
                withAutoRefresh { session ->
                    tasksApi.updateTaskText(
                        apiKey = apiKey,
                        authorization = "Bearer ${session.accessToken}",
                        idEq = "eq.$taskId",
                        body = UpdateTaskTextRequest(text = newText),
                    )
                }
                loadTasks(refreshWidget = false)
            } catch (e: Exception) {
                // On error, reload and refresh widget to roll back
                runCatching { loadTasks(refreshWidget = true) }
            }
        }
    }

    suspend fun deleteTask(taskId: String) {
        if (getSession() == null) return
        realtimeClient.suppressChanges()

        // Instant feedback - update cache and refresh before background sync
        val currentTasks = widgetCache.getTasks()
        if (currentTasks.isNotEmpty()) {
            val updatedTasks = currentTasks.filter { it.id != taskId }
            widgetCache.saveWidgetTasksDirect(updatedTasks)
            MyDayWidgetProvider.refreshAll(appContext)
        }

        // Server sync in background
        backgroundScope.launch {
            try {
                withAutoRefresh { session ->
                    tasksApi.deleteTask(
                        apiKey = apiKey,
                        authorization = "Bearer ${session.accessToken}",
                        idEq = "eq.$taskId",
                    )
                }
                loadTasks(refreshWidget = false)
            } catch (e: Exception) {
                // On error, reload and refresh widget to roll back
                runCatching { loadTasks(refreshWidget = true) }
            }
        }
    }
}
