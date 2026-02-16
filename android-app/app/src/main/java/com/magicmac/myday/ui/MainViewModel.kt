package com.magicmac.myday.ui

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.magicmac.myday.data.TaskRepository
import com.magicmac.myday.data.WidgetTaskCache
import com.magicmac.myday.data.todayKey
import com.magicmac.myday.model.AuthSession
import com.magicmac.myday.model.Task
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class MainUiState(
    val loading: Boolean = true,
    val session: AuthSession? = null,
    val tasks: List<Task> = emptyList(),
    val emailInput: String = "",
    val passwordInput: String = "",
    val taskInput: String = "",
    val error: String? = null,
)

class MainViewModel(
    private val repository: TaskRepository,
    private val context: Context
) : ViewModel() {
    private val _uiState = MutableStateFlow(MainUiState())
    val uiState: StateFlow<MainUiState> = _uiState.asStateFlow()
    private val widgetCache = WidgetTaskCache(context)

    init {
        viewModelScope.launch {
            val initialSession = repository.getSession()
            val tasks = if (initialSession != null) {
                runCatching { repository.loadTasks() }.getOrDefault(emptyList())
            } else {
                emptyList()
            }
            // Re-check session after attempting to load - it might have been cleared due to 401
            val currentSession = repository.getSession()
            _uiState.value = MainUiState(loading = false, session = currentSession, tasks = tasks)
        }
    }

    fun onEmailChanged(value: String) = _uiState.update { it.copy(emailInput = value) }
    fun onPasswordChanged(value: String) = _uiState.update { it.copy(passwordInput = value) }
    fun onTaskChanged(value: String) = _uiState.update { it.copy(taskInput = value) }

    fun signIn() {
        val state = _uiState.value
        if (state.emailInput.isBlank() || state.passwordInput.isBlank()) return

        viewModelScope.launch {
            _uiState.update { it.copy(loading = true, error = null) }
            runCatching {
                val session = repository.signIn(state.emailInput.trim(), state.passwordInput)
                val tasks = repository.loadTasks()
                _uiState.update {
                    it.copy(
                        loading = false,
                        session = session,
                        tasks = tasks,
                        passwordInput = "",
                        error = null,
                    )
                }
            }.onFailure { throwable ->
                _uiState.update {
                    it.copy(loading = false, error = throwable.message ?: "Sign in failed")
                }
            }
        }
    }

    fun signOut() {
        viewModelScope.launch {
            repository.signOut()
            _uiState.value = MainUiState(loading = false)
        }
    }

    fun refresh() {
        viewModelScope.launch {
            runCatching { repository.loadTasks() }
                .onSuccess { tasks -> _uiState.update { it.copy(tasks = tasks, error = null) } }
                .onFailure { e -> _uiState.update { it.copy(error = e.message ?: "Failed to refresh") } }
        }
    }

    fun addTask() {
        val text = _uiState.value.taskInput.trim()
        if (text.isBlank()) return

        // Optimistic update - add task to UI immediately
        viewModelScope.launch {
            val optimisticTask = repository.addTask(text)
            val updatedTasks = _uiState.value.tasks + optimisticTask
            _uiState.update { it.copy(taskInput = "", tasks = updatedTasks, error = null) }

            // Background sync will happen automatically in repository
            // Refresh after a moment to get the real task from server
            kotlinx.coroutines.delay(500)
            runCatching { repository.loadTasks() }
                .onSuccess { tasks -> _uiState.update { it.copy(tasks = tasks) } }
        }
    }

    fun toggleTask(task: Task) {
        // Optimistic update - toggle immediately in UI
        val updatedTasks = _uiState.value.tasks.map {
            if (it.id == task.id) it.copy(completed = !it.completed) else it
        }
        _uiState.update { it.copy(tasks = updatedTasks, error = null) }

        // Sync in background
        viewModelScope.launch {
            repository.toggleTask(task.id, !task.completed)
        }
    }

    fun deleteTask(task: Task) {
        // Optimistic update - remove from UI immediately
        val updatedTasks = _uiState.value.tasks.filter { it.id != task.id }
        _uiState.update { it.copy(tasks = updatedTasks, error = null) }

        // Sync in background
        viewModelScope.launch {
            repository.deleteTask(task.id)
        }
    }

    fun myDayTasks(): List<Task> {
        val todayTasks = _uiState.value.tasks.filter { it.day == todayKey() }

        return try {
            // Get sort orders from widget cache
            val widgetTasks = widgetCache.getTasks()
            val sortOrderMap = widgetTasks.associate { it.id to it.sortOrder }

            todayTasks.sortedWith(
                compareBy<Task> { it.completed }
                    .thenBy { task ->
                        if (!task.completed) sortOrderMap[task.id] ?: Int.MAX_VALUE
                        else 0
                    }
                    .thenByDescending { it.createdAt }
            )
        } catch (e: Exception) {
            // Fallback to simple sorting if widget cache fails
            todayTasks.sortedWith(
                compareBy<Task> { it.completed }.thenByDescending { it.createdAt }
            )
        }
    }

    fun archivedTasks(): Map<String, List<Task>> = _uiState.value.tasks.filter { it.day != todayKey() }.groupBy { it.day }
}

class MainViewModelFactory(
    private val repository: TaskRepository,
    private val context: Context
) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        return MainViewModel(repository, context) as T
    }
}
