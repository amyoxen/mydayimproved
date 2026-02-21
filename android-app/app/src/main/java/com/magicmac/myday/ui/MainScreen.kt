package com.magicmac.myday.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp

@Composable
fun MainScreen(vm: MainViewModel) {
    val state by vm.uiState.collectAsState()
    val lifecycleOwner = LocalLifecycleOwner.current

    // Track last known date to detect midnight crossing
    val lastDate = remember { mutableStateOf(java.time.LocalDate.now()) }

    // Refresh tasks when app comes to foreground and manage realtime connection
    DisposableEffect(lifecycleOwner) {
        var lastPauseTime = 0L
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_PAUSE -> {
                    lastPauseTime = System.currentTimeMillis()
                }
                Lifecycle.Event.ON_RESUME -> {
                    if (state.session != null) {
                        val today = java.time.LocalDate.now()
                        val dateChanged = today != lastDate.value
                        if (dateChanged) {
                            lastDate.value = today
                        }
                        val pauseDuration = System.currentTimeMillis() - lastPauseTime
                        // Refresh if date changed or app was in background for more than 2 seconds
                        // This avoids refreshing when just opening widget dialogs
                        if (dateChanged || pauseDuration > 2000 || lastPauseTime == 0L) {
                            vm.refresh()
                        }
                        // Connect realtime WebSocket when app is visible
                        vm.connectRealtime()
                    }
                }
                Lifecycle.Event.ON_STOP -> {
                    // Disconnect realtime when app is no longer visible
                    vm.disconnectRealtime()
                }
                else -> {}
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
        }
    }

    // Auto-refresh at midnight if app is in the foreground
    LaunchedEffect(state.session) {
        if (state.session == null) return@LaunchedEffect
        while (true) {
            val now = java.time.LocalDateTime.now()
            val nextMidnight = now.toLocalDate().plusDays(1).atStartOfDay()
            val delayMs = java.time.Duration.between(now, nextMidnight).toMillis() + 2000 // 2s buffer
            kotlinx.coroutines.delay(delayMs)
            lastDate.value = java.time.LocalDate.now()
            vm.refresh()
        }
    }

    if (state.loading) {
        Column(modifier = Modifier.fillMaxSize(), verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) {
            Text("Loading...")
        }
        return
    }

    if (state.session == null) {
        LoginScreen(state = state, onEmailChange = vm::onEmailChanged, onPasswordChange = vm::onPasswordChanged, onSignIn = vm::signIn)
        return
    }

    MyDayScreen(
        state = state,
        myDayTasks = vm.myDayTasks(),
        archived = vm.archivedTasks(),
        onTaskChange = vm::onTaskChanged,
        onAddTask = vm::addTask,
        onToggleTask = vm::toggleTask,
        onDeleteTask = vm::deleteTask,
        onRefresh = vm::refresh,
        onSignOut = vm::signOut,
    )
}

@Composable
private fun LoginScreen(
    state: MainUiState,
    onEmailChange: (String) -> Unit,
    onPasswordChange: (String) -> Unit,
    onSignIn: () -> Unit,
) {
    val passwordFocusRequester = remember { FocusRequester() }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .padding(32.dp),
        verticalArrangement = Arrangement.Center,
    ) {
        Text(
            "My Day",
            style = MaterialTheme.typography.headlineLarge,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onBackground
        )
        Spacer(Modifier.height(8.dp))
        Text(
            "Sign in to continue",
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyLarge
        )
        Spacer(Modifier.height(32.dp))

        TextField(
            value = state.emailInput,
            onValueChange = onEmailChange,
            label = { Text("Email") },
            modifier = Modifier.fillMaxWidth(),
            colors = TextFieldDefaults.colors(
                focusedContainerColor = Color.White.copy(alpha = 0.7f),
                unfocusedContainerColor = Color.White.copy(alpha = 0.5f),
            ),
            shape = RoundedCornerShape(8.dp),
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Next),
            keyboardActions = KeyboardActions(onNext = { passwordFocusRequester.requestFocus() }),
        )

        Spacer(Modifier.height(12.dp))

        TextField(
            value = state.passwordInput,
            onValueChange = onPasswordChange,
            label = { Text("Password") },
            visualTransformation = PasswordVisualTransformation(),
            modifier = Modifier
                .fillMaxWidth()
                .focusRequester(passwordFocusRequester),
            colors = TextFieldDefaults.colors(
                focusedContainerColor = Color.White.copy(alpha = 0.7f),
                unfocusedContainerColor = Color.White.copy(alpha = 0.5f),
            ),
            shape = RoundedCornerShape(8.dp),
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
            keyboardActions = KeyboardActions(onDone = { onSignIn() }),
        )

        Spacer(Modifier.height(24.dp))

        Button(
            onClick = onSignIn,
            modifier = Modifier.fillMaxWidth().height(48.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.primary
            ),
            shape = RoundedCornerShape(8.dp),
        ) {
            Text("Sign in", style = MaterialTheme.typography.bodyLarge)
        }

        if (state.error != null) {
            Spacer(Modifier.height(16.dp))
            Text(state.error, color = Color.Red.copy(alpha = 0.8f))
        }
    }
}

@Composable
private fun MyDayScreen(
    state: MainUiState,
    myDayTasks: List<com.magicmac.myday.model.Task>,
    archived: Map<String, List<com.magicmac.myday.model.Task>>,
    onTaskChange: (String) -> Unit,
    onAddTask: () -> Unit,
    onToggleTask: (com.magicmac.myday.model.Task) -> Unit,
    onDeleteTask: (com.magicmac.myday.model.Task) -> Unit,
    onRefresh: () -> Unit,
    onSignOut: () -> Unit,
) {
    val listState = rememberLazyListState()

    // Scroll to top when tasks change (after adding a new task)
    LaunchedEffect(myDayTasks.size) {
        if (myDayTasks.isNotEmpty() && listState.firstVisibleItemIndex > 0) {
            listState.animateScrollToItem(0)
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .padding(top = 32.dp)
    ) {
        // Top bar with date and quote
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        "My Day",
                        style = MaterialTheme.typography.headlineMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onBackground
                    )
                    Text(
                        java.time.LocalDate.now().format(
                            java.time.format.DateTimeFormatter.ofPattern("EEE, MMM d")
                        ),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Row {
                    TextButton(onClick = onRefresh) {
                        Text("Refresh", color = MaterialTheme.colorScheme.primary)
                    }
                    TextButton(onClick = onSignOut) {
                        Text("Sign out", color = MaterialTheme.colorScheme.primary)
                    }
                }
            }

            Spacer(Modifier.height(12.dp))

            // Daily Quote
            val quote = com.magicmac.myday.data.DailyQuotes.getTodaysQuote()
            Text(
                "\"${quote.text}\"",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                fontStyle = androidx.compose.ui.text.font.FontStyle.Italic,
                modifier = Modifier.padding(vertical = 4.dp)
            )
            Text(
                "— ${quote.author}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)
            )
        }

        Spacer(Modifier.height(16.dp))

        // Task input at top
        TextField(
            value = state.taskInput,
            onValueChange = onTaskChange,
            placeholder = { Text("Add a task") },
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp),
            colors = TextFieldDefaults.colors(
                focusedContainerColor = Color.White.copy(alpha = 0.7f),
                unfocusedContainerColor = Color.White.copy(alpha = 0.5f),
                focusedIndicatorColor = Color.Transparent,
                unfocusedIndicatorColor = Color.Transparent,
            ),
            shape = RoundedCornerShape(8.dp),
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
            keyboardActions = KeyboardActions(
                onDone = {
                    if (state.taskInput.isNotBlank()) {
                        onAddTask()
                    }
                }
            ),
        )

        Spacer(Modifier.height(8.dp))

        Text(
            "${myDayTasks.count { it.completed }} of ${myDayTasks.size} tasks completed",
            modifier = Modifier.padding(horizontal = 20.dp),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Spacer(Modifier.height(12.dp))

        // Task list
        LazyColumn(
            state = listState,
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            if (myDayTasks.isEmpty()) {
                item {
                    Text(
                        "No tasks for today",
                        modifier = Modifier.padding(vertical = 32.dp),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.bodyLarge
                    )
                }
            } else {
                items(myDayTasks, key = { it.id }) { task ->
                    TaskItem(
                        task = task,
                        onToggle = { onToggleTask(task) },
                        onDelete = { onDeleteTask(task) }
                    )
                }
            }

            item { Spacer(Modifier.height(16.dp)) }

            if (state.error != null) {
                item {
                    Text(state.error, color = Color.Red.copy(alpha = 0.8f))
                }
            }
        }
    }
}

@Composable
private fun TaskItem(
    task: com.magicmac.myday.model.Task,
    onToggle: () -> Unit,
    onDelete: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(4.dp))
            .clickable(onClick = onToggle)
            .padding(vertical = 12.dp, horizontal = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // Custom checkbox
        Box(
            modifier = Modifier
                .size(24.dp)
                .border(
                    width = 2.dp,
                    color = if (task.completed) MaterialTheme.colorScheme.primary
                    else Color(0xFF5A5A5A),
                    shape = RoundedCornerShape(3.dp)
                )
                .background(
                    color = if (task.completed) MaterialTheme.colorScheme.primary
                    else Color.Transparent,
                    shape = RoundedCornerShape(3.dp)
                )
                .clickable(onClick = onToggle),
            contentAlignment = Alignment.Center
        ) {
            if (task.completed) {
                Text("✓", color = Color.White, fontSize = MaterialTheme.typography.bodyMedium.fontSize)
            }
        }

        Spacer(Modifier.width(12.dp))

        Text(
            task.text,
            modifier = Modifier.weight(1f),
            color = MaterialTheme.colorScheme.onBackground,
            style = MaterialTheme.typography.bodyLarge,
            textDecoration = if (task.completed) TextDecoration.LineThrough else TextDecoration.None,
        )

        TextButton(onClick = onDelete) {
            Text("Delete", color = MaterialTheme.colorScheme.primary)
        }
    }
}
