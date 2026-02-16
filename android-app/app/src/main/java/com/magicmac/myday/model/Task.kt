package com.magicmac.myday.model

import com.squareup.moshi.Json

data class Task(
    val id: String,
    val text: String,
    val completed: Boolean,
    @Json(name = "created_at") val createdAt: String = "",
    val day: String,
)

data class AuthSession(
    val accessToken: String,
    val refreshToken: String,
    val userId: String,
    val email: String,
)
