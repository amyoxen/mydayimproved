package com.magicmac.myday.widget

import android.app.Activity
import android.app.AlertDialog
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.ItemTouchHelper
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.magicmac.myday.R
import com.magicmac.myday.data.WidgetTask
import com.magicmac.myday.data.WidgetTaskCache
import java.util.Collections

class WidgetReorderActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        showReorderDialog()
    }

    private fun showReorderDialog() {
        val cache = WidgetTaskCache(this)
        val tasks = cache.getTasks()
        val incompleteTasks = tasks.filter { !it.completed }.toMutableList()

        if (incompleteTasks.isEmpty()) {
            finish()
            return
        }

        val recyclerView = RecyclerView(this).apply {
            layoutManager = LinearLayoutManager(this@WidgetReorderActivity)
            adapter = ReorderAdapter(incompleteTasks)
        }

        val itemTouchHelper = ItemTouchHelper(object : ItemTouchHelper.SimpleCallback(
            ItemTouchHelper.UP or ItemTouchHelper.DOWN,
            0
        ) {
            override fun onMove(
                recyclerView: RecyclerView,
                viewHolder: RecyclerView.ViewHolder,
                target: RecyclerView.ViewHolder
            ): Boolean {
                val fromPosition = viewHolder.adapterPosition
                val toPosition = target.adapterPosition
                Collections.swap(incompleteTasks, fromPosition, toPosition)
                recyclerView.adapter?.notifyItemMoved(fromPosition, toPosition)
                // Update position numbers
                recyclerView.adapter?.notifyItemRangeChanged(
                    minOf(fromPosition, toPosition),
                    kotlin.math.abs(fromPosition - toPosition) + 1
                )
                return true
            }

            override fun onSwiped(viewHolder: RecyclerView.ViewHolder, direction: Int) {}

            override fun onSelectedChanged(viewHolder: RecyclerView.ViewHolder?, actionState: Int) {
                super.onSelectedChanged(viewHolder, actionState)
                if (actionState == ItemTouchHelper.ACTION_STATE_DRAG) {
                    viewHolder?.itemView?.apply {
                        scaleX = 1.15f
                        scaleY = 1.15f
                        elevation = 8f
                        setBackgroundColor(getColor(R.color.widget_fab))
                    }
                }
            }

            override fun clearView(recyclerView: RecyclerView, viewHolder: RecyclerView.ViewHolder) {
                super.clearView(recyclerView, viewHolder)
                viewHolder.itemView.apply {
                    scaleX = 1.0f
                    scaleY = 1.0f
                    elevation = 0f
                    setBackgroundColor(android.graphics.Color.TRANSPARENT)
                }
            }
        })

        itemTouchHelper.attachToRecyclerView(recyclerView)

        val dialog = AlertDialog.Builder(this, R.style.WidgetDialogTheme)
            .setTitle("Set Your Priority")
            .setView(recyclerView)
            .setPositiveButton("Save") { _, _ ->
                saveNewOrder(cache, tasks, incompleteTasks)
            }
            .setNegativeButton("Cancel") { _, _ -> finish() }
            .setOnCancelListener { finish() }
            .create()

        dialog.window?.setBackgroundDrawableResource(R.color.widget_dialog_background)
        dialog.show()
    }

    private fun saveNewOrder(
        cache: WidgetTaskCache,
        allTasks: List<WidgetTask>,
        reorderedIncompleteTasks: List<WidgetTask>
    ) {
        val updatedTasks = allTasks.map { task ->
            if (!task.completed) {
                val newOrder = reorderedIncompleteTasks.indexOfFirst { it.id == task.id }
                if (newOrder >= 0) task.copy(sortOrder = newOrder) else task
            } else {
                task
            }
        }
        cache.saveWidgetTasksDirect(updatedTasks)
        MyDayWidgetProvider.refreshAll(applicationContext)
        finish()
    }
}

class ReorderAdapter(private val tasks: MutableList<WidgetTask>) :
    RecyclerView.Adapter<ReorderAdapter.ViewHolder>() {

    class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val numberView: TextView = view.findViewById(R.id.task_number)
        val textView: TextView = view.findViewById(R.id.task_text)
        val dragHandle: View = view.findViewById(R.id.drag_handle)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.widget_reorder_item, parent, false)
        return ViewHolder(view)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.numberView.text = (position + 1).toString()
        holder.textView.text = tasks[position].text
    }

    override fun getItemCount() = tasks.size
}
