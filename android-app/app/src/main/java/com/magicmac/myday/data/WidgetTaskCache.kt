package com.magicmac.myday.data

import android.content.Context
import com.magicmac.myday.model.Task
import com.squareup.moshi.Moshi
import com.squareup.moshi.Types
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory

private const val PREFS_NAME = "my_day_widget"
private const val KEY_TASKS = "tasks"

class WidgetTaskCache(context: Context) {
    private val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    private val adapter = Moshi.Builder()
        .add(KotlinJsonAdapterFactory())
        .build()
        .adapter<List<WidgetTask>>(
        Types.newParameterizedType(List::class.java, WidgetTask::class.java)
    )

    fun saveTasks(tasks: List<Task>) {
        // Preserve existing sort order when refreshing from server
        val existingTasks = getTasks()
        val existingOrder = existingTasks.associate { it.id to it.sortOrder }

        val payload = tasks.mapIndexed { index, task ->
            val sortOrder = existingOrder[task.id] ?: index
            WidgetTask(task.id, task.text, task.completed, task.createdAt, sortOrder)
        }
        saveWidgetTasksDirect(payload)
    }

    fun saveWidgetTasksDirect(tasks: List<WidgetTask>) {
        prefs.edit().putString(KEY_TASKS, adapter.toJson(tasks)).apply()
    }

    fun getTasks(): List<WidgetTask> {
        val json = prefs.getString(KEY_TASKS, null) ?: return emptyList()
        return try {
            adapter.fromJson(json).orEmpty()
        } catch (e: Exception) {
            // Don't clear cache on error - just return empty and let next refresh fix it
            // This prevents losing tasks during optimistic updates
            emptyList()
        }
    }
}

data class WidgetTask(
    val id: String,
    val text: String,
    val completed: Boolean,
    val createdAt: String = "",
    val sortOrder: Int = 0,
)
