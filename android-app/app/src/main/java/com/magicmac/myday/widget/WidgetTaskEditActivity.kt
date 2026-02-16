package com.magicmac.myday.widget

import android.app.Activity
import android.app.AlertDialog
import android.os.Bundle
import android.widget.EditText
import android.widget.Toast
import com.magicmac.myday.R
import com.magicmac.myday.data.TaskRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class WidgetTaskEditActivity : Activity() {
    private lateinit var taskId: String
    private lateinit var taskText: String
    private var taskCompleted: Boolean = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        taskId = intent.getStringExtra(EXTRA_TASK_ID) ?: run {
            finish()
            return
        }
        taskText = intent.getStringExtra(EXTRA_TASK_TEXT) ?: ""
        taskCompleted = intent.getBooleanExtra(EXTRA_TASK_COMPLETED, false)

        showEditDialog()
    }

    private fun showEditDialog() {
        val input = EditText(this).apply {
            setText(taskText)
            hint = getString(R.string.widget_input_hint)
            setPadding(40, 30, 40, 30)
            textSize = 16f
            setTextColor(getColor(R.color.widget_text))
            setHintTextColor(getColor(R.color.widget_muted))
            setSelection(taskText.length)
            setSingleLine(true)
            imeOptions = android.view.inputmethod.EditorInfo.IME_ACTION_DONE
        }

        val dialog = AlertDialog.Builder(this, R.style.WidgetDialogTheme)
            .setTitle(R.string.widget_edit_task)
            .setView(input)
            .setPositiveButton(R.string.widget_button_save) { _, _ ->
                val newText = input.text.toString().trim()
                if (newText.isNotEmpty() && newText != taskText) {
                    updateTask(newText)
                } else {
                    finish()
                }
            }
            .setNegativeButton(R.string.widget_button_cancel) { _, _ -> finish() }
            .setNeutralButton(R.string.widget_button_delete) { _, _ ->
                deleteTask()
            }
            .setOnCancelListener { finish() }
            .create()

        // Handle Enter key press
        input.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == android.view.inputmethod.EditorInfo.IME_ACTION_DONE) {
                val newText = input.text.toString().trim()
                if (newText.isNotEmpty() && newText != taskText) {
                    updateTask(newText)
                    dialog.dismiss()
                } else {
                    finish()
                }
                true
            } else {
                false
            }
        }

        dialog.window?.setBackgroundDrawableResource(R.color.widget_background)
        dialog.show()
    }

    private fun updateTask(newText: String) {
        CoroutineScope(Dispatchers.Main).launch {
            try {
                withContext(Dispatchers.IO) {
                    val repository = TaskRepository(applicationContext)
                    val session = repository.getSession()
                    if (session == null) {
                        withContext(Dispatchers.Main) {
                            Toast.makeText(
                                this@WidgetTaskEditActivity,
                                "Please sign in to the app first",
                                Toast.LENGTH_SHORT
                            ).show()
                        }
                        return@withContext
                    }
                    repository.updateTaskText(taskId, newText)
                }
                // Widget refresh is handled by repository
            } catch (e: Exception) {
                Toast.makeText(
                    this@WidgetTaskEditActivity,
                    "Failed to update task: ${e.message}",
                    Toast.LENGTH_SHORT
                ).show()
            } finally {
                finish()
            }
        }
    }

    private fun deleteTask() {
        CoroutineScope(Dispatchers.Main).launch {
            try {
                withContext(Dispatchers.IO) {
                    val repository = TaskRepository(applicationContext)
                    val session = repository.getSession()
                    if (session == null) {
                        withContext(Dispatchers.Main) {
                            Toast.makeText(
                                this@WidgetTaskEditActivity,
                                "Please sign in to the app first",
                                Toast.LENGTH_SHORT
                            ).show()
                        }
                        return@withContext
                    }
                    repository.deleteTask(taskId)
                }
                // Widget refresh is handled by repository
            } catch (e: Exception) {
                Toast.makeText(
                    this@WidgetTaskEditActivity,
                    "Failed to delete task: ${e.message}",
                    Toast.LENGTH_SHORT
                ).show()
            } finally {
                finish()
            }
        }
    }

    companion object {
        const val EXTRA_TASK_ID = "extra_task_id"
        const val EXTRA_TASK_TEXT = "extra_task_text"
        const val EXTRA_TASK_COMPLETED = "extra_task_completed"
    }
}
