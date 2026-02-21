package com.magicmac.myday.widget

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import com.magicmac.myday.MainActivity
import com.magicmac.myday.R
import com.magicmac.myday.data.TaskRepository
import com.magicmac.myday.data.WidgetTaskCache
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Calendar

class MyDayWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        appWidgetIds.forEach { appWidgetId ->
            updateWidget(context, appWidgetManager, appWidgetId)
        }
        scheduleMidnightRefresh(context)
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        when (intent.action) {
            ACTION_MIDNIGHT_REFRESH -> {
                // Midnight crossed - reload tasks for the new day
                val pendingResult = goAsync()
                CoroutineScope(Dispatchers.IO).launch {
                    runCatching {
                        val repository = TaskRepository(context.applicationContext)
                        repository.loadTasks(refreshWidget = true)
                    }
                    pendingResult.finish()
                }
                // Schedule the next midnight alarm
                scheduleMidnightRefresh(context)
            }
            ACTION_TOGGLE_TASK -> {
                val taskId = intent.getStringExtra(EXTRA_TASK_ID) ?: return
                val currentCompleted = intent.getBooleanExtra(EXTRA_TASK_COMPLETED, false)
                val pendingResult = goAsync()
                CoroutineScope(Dispatchers.IO).launch {
                    runCatching {
                        val repository = TaskRepository(context.applicationContext)
                        repository.toggleTask(taskId, !currentCompleted)
                    }
                    pendingResult.finish()
                }
            }
            ACTION_EDIT_TASK -> {
                val taskId = intent.getStringExtra(EXTRA_TASK_ID) ?: return
                val taskText = intent.getStringExtra(EXTRA_TASK_TEXT) ?: return
                val taskCompleted = intent.getBooleanExtra(EXTRA_TASK_COMPLETED, false)

                val editIntent = Intent(context, WidgetTaskEditActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    putExtra(WidgetTaskEditActivity.EXTRA_TASK_ID, taskId)
                    putExtra(WidgetTaskEditActivity.EXTRA_TASK_TEXT, taskText)
                    putExtra(WidgetTaskEditActivity.EXTRA_TASK_COMPLETED, taskCompleted)
                }
                context.startActivity(editIntent)
            }
        }
    }

    companion object {
        const val ACTION_TOGGLE_TASK = "com.magicmac.myday.widget.ACTION_TOGGLE_TASK"
        const val ACTION_EDIT_TASK = "com.magicmac.myday.widget.ACTION_EDIT_TASK"
        const val ACTION_MIDNIGHT_REFRESH = "com.magicmac.myday.widget.ACTION_MIDNIGHT_REFRESH"
        const val EXTRA_TASK_ID = "extra_task_id"
        const val EXTRA_TASK_TEXT = "extra_task_text"
        const val EXTRA_TASK_COMPLETED = "extra_task_completed"

        fun scheduleMidnightRefresh(context: Context) {
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val intent = Intent(context, MyDayWidgetProvider::class.java).apply {
                action = ACTION_MIDNIGHT_REFRESH
            }
            val pendingIntent = PendingIntent.getBroadcast(
                context, 0, intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
            // Schedule for next midnight + 5 seconds buffer
            val midnight = Calendar.getInstance().apply {
                add(Calendar.DAY_OF_YEAR, 1)
                set(Calendar.HOUR_OF_DAY, 0)
                set(Calendar.MINUTE, 0)
                set(Calendar.SECOND, 5)
                set(Calendar.MILLISECOND, 0)
            }
            alarmManager.set(AlarmManager.RTC_WAKEUP, midnight.timeInMillis, pendingIntent)
        }

        fun refreshAll(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val component = ComponentName(context, MyDayWidgetProvider::class.java)
            val ids = manager.getAppWidgetIds(component)
            ids.forEach { id -> updateWidget(context, manager, id, notifyDataChanged = false) }
            // Notify data changed once for all widgets to reduce flickering
            manager.notifyAppWidgetViewDataChanged(ids, R.id.widget_list)
        }

        private fun updateWidget(
            context: Context,
            manager: AppWidgetManager,
            appWidgetId: Int,
            notifyDataChanged: Boolean = true
        ) {
            val views = RemoteViews(context.packageName, R.layout.widget_my_day)

            // Set task completion count
            val cache = WidgetTaskCache(context.applicationContext)
            val tasks = cache.getTasks()
            val completed = tasks.count { it.completed }
            views.setTextViewText(R.id.widget_task_count, "$completed of ${tasks.size} tasks completed")

            val serviceIntent = Intent(context, MyDayWidgetRemoteViewsService::class.java).apply {
                putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
                data = android.net.Uri.parse(toUri(Intent.URI_INTENT_SCHEME))
            }
            views.setRemoteAdapter(R.id.widget_list, serviceIntent)
            views.setEmptyView(R.id.widget_list, R.id.widget_empty)

            val addIntent = Intent(context, WidgetTaskInputActivity::class.java)
            val addPendingIntent = PendingIntent.getActivity(
                context,
                5000 + appWidgetId,
                addIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
            views.setOnClickPendingIntent(R.id.widget_add_button, addPendingIntent)

            val reorderIntent = Intent(context, WidgetReorderActivity::class.java)
            val reorderPendingIntent = PendingIntent.getActivity(
                context,
                6000 + appWidgetId,
                reorderIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
            views.setOnClickPendingIntent(R.id.widget_reorder_button, reorderPendingIntent)

            val templateIntent = Intent(context, MyDayWidgetProvider::class.java)
            val templatePendingIntent = PendingIntent.getBroadcast(
                context,
                4000 + appWidgetId,
                templateIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE,
            )
            views.setPendingIntentTemplate(R.id.widget_list, templatePendingIntent)

            manager.updateAppWidget(appWidgetId, views)

            // Only notify data changed if requested (avoid double notifications)
            if (notifyDataChanged) {
                manager.notifyAppWidgetViewDataChanged(appWidgetId, R.id.widget_list)
            }
        }
    }
}
