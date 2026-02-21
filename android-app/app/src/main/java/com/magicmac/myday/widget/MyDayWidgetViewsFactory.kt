package com.magicmac.myday.widget

import android.content.Context
import android.content.Intent
import android.graphics.Paint
import android.widget.RemoteViews
import android.widget.RemoteViewsService
import com.magicmac.myday.R
import com.magicmac.myday.data.WidgetTask
import com.magicmac.myday.data.WidgetTaskCache

class MyDayWidgetViewsFactory(private val context: Context) : RemoteViewsService.RemoteViewsFactory {
    private val cache = WidgetTaskCache(context)
    private var tasks: List<WidgetTask> = emptyList()

    override fun onCreate() {
        tasks = loadAndSort()
    }

    override fun onDataSetChanged() {
        tasks = loadAndSort()
    }

    private fun loadAndSort(): List<WidgetTask> {
        return cache.getTasks().sortedWith(
            compareBy<WidgetTask> { it.completed }
                .thenBy { if (!it.completed) it.sortOrder else 0 }
                .thenByDescending { it.createdAt }
        )
    }

    override fun onDestroy() {
        tasks = emptyList()
    }

    override fun getCount(): Int = tasks.size

    override fun getViewAt(position: Int): RemoteViews {
        val task = tasks[position]
        return RemoteViews(context.packageName, R.layout.widget_my_day_item).apply {
            setTextViewText(R.id.widget_item_text, task.text)

            // Apply strikethrough to completed tasks
            setInt(
                R.id.widget_item_text,
                "setPaintFlags",
                if (task.completed) Paint.STRIKE_THRU_TEXT_FLAG or Paint.ANTI_ALIAS_FLAG
                else Paint.ANTI_ALIAS_FLAG
            )

            setImageViewResource(
                R.id.widget_item_check,
                if (task.completed) R.drawable.widget_checkbox_checked else R.drawable.widget_checkbox_unchecked,
            )

            val toggleIntent = Intent().apply {
                action = MyDayWidgetProvider.ACTION_TOGGLE_TASK
                putExtra(MyDayWidgetProvider.EXTRA_TASK_ID, task.id)
                putExtra(MyDayWidgetProvider.EXTRA_TASK_COMPLETED, task.completed)
            }
            setOnClickFillInIntent(R.id.widget_item_check, toggleIntent)

            val editIntent = Intent().apply {
                action = MyDayWidgetProvider.ACTION_EDIT_TASK
                putExtra(MyDayWidgetProvider.EXTRA_TASK_ID, task.id)
                putExtra(MyDayWidgetProvider.EXTRA_TASK_TEXT, task.text)
                putExtra(MyDayWidgetProvider.EXTRA_TASK_COMPLETED, task.completed)
            }
            setOnClickFillInIntent(R.id.widget_item_text, editIntent)
        }
    }

    override fun getLoadingView(): RemoteViews? = null

    override fun getViewTypeCount(): Int = 1

    override fun getItemId(position: Int): Long = tasks[position].id.hashCode().toLong()

    override fun hasStableIds(): Boolean = true
}
