package com.magicmac.myday

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import com.magicmac.myday.data.TaskRepository
import com.magicmac.myday.ui.MainScreen
import com.magicmac.myday.ui.MainViewModel
import com.magicmac.myday.ui.MainViewModelFactory
import com.magicmac.myday.ui.theme.MyDayTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val repository = TaskRepository(applicationContext)

        setContent {
            val vm: MainViewModel = viewModel(factory = MainViewModelFactory(repository, applicationContext))
            MyDayTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    MainScreen(vm)
                }
            }
        }
    }
}
