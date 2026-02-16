package com.magicmac.myday.data

import com.magicmac.myday.model.Task
import com.squareup.moshi.Json
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.POST
import retrofit2.http.PATCH
import retrofit2.http.Query

interface SupabaseAuthApi {
    @POST("auth/v1/token?grant_type=password")
    suspend fun login(
        @Header("apikey") apiKey: String,
        @Body body: LoginRequest,
    ): LoginResponse

    @POST("auth/v1/token?grant_type=refresh_token")
    suspend fun refreshToken(
        @Header("apikey") apiKey: String,
        @Body body: RefreshTokenRequest,
    ): LoginResponse
}

interface SupabaseTasksApi {
    @GET("rest/v1/tasks")
    suspend fun getTasks(
        @Header("apikey") apiKey: String,
        @Header("Authorization") authorization: String,
        @Query("select") select: String = "id,text,completed,created_at,day",
        @Query("user_id") userIdEq: String,
        @Query("order") order: String = "created_at.desc",
    ): List<Task>

    @POST("rest/v1/tasks")
    suspend fun addTask(
        @Header("apikey") apiKey: String,
        @Header("Authorization") authorization: String,
        @Header("Prefer") prefer: String = "return=representation",
        @Body body: List<CreateTaskRequest>,
    ): List<Task>

    @PATCH("rest/v1/tasks")
    suspend fun updateTask(
        @Header("apikey") apiKey: String,
        @Header("Authorization") authorization: String,
        @Header("Prefer") prefer: String = "return=representation",
        @Query("id") idEq: String,
        @Body body: UpdateTaskRequest,
    ): List<Task>

    @PATCH("rest/v1/tasks")
    suspend fun updateTaskText(
        @Header("apikey") apiKey: String,
        @Header("Authorization") authorization: String,
        @Header("Prefer") prefer: String = "return=representation",
        @Query("id") idEq: String,
        @Body body: UpdateTaskTextRequest,
    ): List<Task>

    @DELETE("rest/v1/tasks")
    suspend fun deleteTask(
        @Header("apikey") apiKey: String,
        @Header("Authorization") authorization: String,
        @Query("id") idEq: String,
    )
}

data class LoginRequest(
    val email: String,
    val password: String,
)

data class LoginResponse(
    @Json(name = "access_token") val accessToken: String,
    @Json(name = "refresh_token") val refreshToken: String,
    val user: LoginUser,
)

data class LoginUser(
    val id: String,
    val email: String,
)

data class CreateTaskRequest(
    @Json(name = "user_id") val userId: String,
    val text: String,
    val completed: Boolean,
    val day: String,
)

data class UpdateTaskRequest(
    val completed: Boolean,
)

data class UpdateTaskTextRequest(
    val text: String,
)

data class RefreshTokenRequest(
    @Json(name = "refresh_token") val refreshToken: String,
)
