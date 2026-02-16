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

class WidgetTaskInputActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        showInputDialog()
    }

    private fun showInputDialog() {
        val input = EditText(this).apply {
            hint = getString(R.string.widget_input_hint)
            setPadding(40, 30, 40, 30)
            textSize = 16f
            setTextColor(getColor(R.color.widget_text))
            setHintTextColor(getColor(R.color.widget_muted))
            setSingleLine(true)
            imeOptions = android.view.inputmethod.EditorInfo.IME_ACTION_DONE
            requestFocus()
        }

        val dialog = AlertDialog.Builder(this, R.style.WidgetDialogTheme)
            .setTitle(R.string.widget_add_task)
            .setView(input)
            .setPositiveButton(R.string.widget_button_add) { _, _ ->
                val text = input.text.toString().trim()
                if (text.isNotEmpty()) {
                    addTask(text)
                } else {
                    finish()
                }
            }
            .setNegativeButton(R.string.widget_button_cancel) { _, _ -> finish() }
            .setOnCancelListener { finish() }
            .create()

        // Handle Enter key press
        input.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == android.view.inputmethod.EditorInfo.IME_ACTION_DONE) {
                val text = input.text.toString().trim()
                if (text.isNotEmpty()) {
                    addTask(text)
                    dialog.dismiss()
                }
                true
            } else {
                false
            }
        }

        dialog.window?.apply {
            setSoftInputMode(android.view.WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_VISIBLE)
            setBackgroundDrawableResource(R.color.widget_background)
        }
        dialog.show()
    }

    private fun addTask(text: String) {
        CoroutineScope(Dispatchers.Main).launch {
            try {
                withContext(Dispatchers.IO) {
                    val repository = TaskRepository(applicationContext)
                    val session = repository.getSession()
                    if (session == null) {
                        withContext(Dispatchers.Main) {
                            Toast.makeText(
                                this@WidgetTaskInputActivity,
                                "Please sign in to the app first",
                                Toast.LENGTH_SHORT
                            ).show()
                        }
                        return@withContext
                    }
                    repository.addTask(text)
                }
                // Widget refresh is handled by repository
            } catch (e: Exception) {
                Toast.makeText(
                    this@WidgetTaskInputActivity,
                    "Failed to add task: ${e.message}",
                    Toast.LENGTH_SHORT
                ).show()
            } finally {
                finish()
            }
        }
    }
}
