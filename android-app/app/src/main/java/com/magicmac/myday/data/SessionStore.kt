package com.magicmac.myday.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.emptyPreferences
import androidx.datastore.preferences.core.MutablePreferences
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.magicmac.myday.model.AuthSession
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map
import java.io.IOException

private val Context.authDataStore by preferencesDataStore(name = "auth")

class SessionStore(private val context: Context) {
    private object Keys {
        val accessToken = stringPreferencesKey("access_token")
        val refreshToken = stringPreferencesKey("refresh_token")
        val userId = stringPreferencesKey("user_id")
        val email = stringPreferencesKey("email")
    }

    val sessionFlow: Flow<AuthSession?> = context.authDataStore.data
        .catch { e ->
            if (e is IOException) emit(emptyPreferences()) else throw e
        }
        .map { prefs ->
            val access = prefs[Keys.accessToken] ?: return@map null
            val refresh = prefs[Keys.refreshToken] ?: return@map null
            val userId = prefs[Keys.userId] ?: return@map null
            val email = prefs[Keys.email] ?: ""
            AuthSession(access, refresh, userId, email)
        }

    suspend fun save(session: AuthSession) {
        context.authDataStore.edit { prefs ->
            prefs[Keys.accessToken] = session.accessToken
            prefs[Keys.refreshToken] = session.refreshToken
            prefs[Keys.userId] = session.userId
            prefs[Keys.email] = session.email
        }
    }

    suspend fun clear() {
        context.authDataStore.edit { prefs: MutablePreferences ->
            prefs.clear()
        }
    }
}
