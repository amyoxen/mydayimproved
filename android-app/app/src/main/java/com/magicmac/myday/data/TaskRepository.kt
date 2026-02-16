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
        val today = todayKey()

        // Background sync - simple and immediate
        backgroundScope.launch {
            try {
                withAutoRefresh { session ->
                    tasksApi.addTask(
                        apiKey = apiKey,
                        authorization = "Bearer ${session.accessToken}",
                        body = listOf(CreateTaskRequest(userId = session.userId, text = text, completed = false, day = today)),
                    ).first()
                }
                // Reload fresh data and refresh widget
                loadTasks(refreshWidget = true)
            } catch (e: Exception) {
                runCatching { loadTasks(refreshWidget = true) }
            }
        }

        // Return a temporary task for UI (real task will be loaded from server)
        return Task(
            id = "temp-${UUID.randomUUID()}",
            text = text,
            completed = false,
            createdAt = java.time.Instant.now().toString(),
            day = today
        )
    }

    suspend fun toggleTask(taskId: String, completedNow: Boolean) {
        if (getSession() == null) return

        // Everything in background - returns instantly
        backgroundScope.launch {
            // Instant feedback - update cache and refresh
            val currentTasks = widgetCache.getTasks()
            if (currentTasks.isNotEmpty()) {
                val updatedTasks = currentTasks.map { task ->
                    if (task.id == taskId) task.copy(completed = completedNow) else task
                }
                widgetCache.saveWidgetTasksDirect(updatedTasks)
                MyDayWidgetProvider.refreshAll(appContext)
            }

            // Server sync with auto-refresh
            try {
                withAutoRefresh { session ->
                    tasksApi.updateTask(
                        apiKey = apiKey,
                        authorization = "Bearer ${session.accessToken}",
                        idEq = "eq.$taskId",
                        body = UpdateTaskRequest(completed = completedNow),
                    )
                }
                loadTasks(refreshWidget = true)
            } catch (e: Exception) {
                runCatching { loadTasks(refreshWidget = true) }
            }
        }
    }

    suspend fun updateTaskText(taskId: String, newText: String) {
        if (getSession() == null) return

        // Everything in background - returns instantly
        backgroundScope.launch {
            // Instant feedback - update cache and refresh
            val currentTasks = widgetCache.getTasks()
            if (currentTasks.isNotEmpty()) {
                val updatedTasks = currentTasks.map { task ->
                    if (task.id == taskId) task.copy(text = newText) else task
                }
                widgetCache.saveWidgetTasksDirect(updatedTasks)
                MyDayWidgetProvider.refreshAll(appContext)
            }

            // Server sync with auto-refresh
            try {
                withAutoRefresh { session ->
                    tasksApi.updateTaskText(
                        apiKey = apiKey,
                        authorization = "Bearer ${session.accessToken}",
                        idEq = "eq.$taskId",
                        body = UpdateTaskTextRequest(text = newText),
                    )
                }
                loadTasks(refreshWidget = true)
            } catch (e: Exception) {
                runCatching { loadTasks(refreshWidget = true) }
            }
        }
    }

    suspend fun deleteTask(taskId: String) {
        if (getSession() == null) return

        // Everything in background - returns instantly
        backgroundScope.launch {
            // Instant feedback - update cache and refresh
            val currentTasks = widgetCache.getTasks()
            if (currentTasks.isNotEmpty()) {
                val updatedTasks = currentTasks.filter { it.id != taskId }
                widgetCache.saveWidgetTasksDirect(updatedTasks)
                MyDayWidgetProvider.refreshAll(appContext)
            }

            // Server sync with auto-refresh
            try {
                withAutoRefresh { session ->
                    tasksApi.deleteTask(
                        apiKey = apiKey,
                        authorization = "Bearer ${session.accessToken}",
                        idEq = "eq.$taskId",
                    )
                }
                loadTasks(refreshWidget = true)
            } catch (e: Exception) {
                runCatching { loadTasks(refreshWidget = true) }
            }
        }
    }
}
