package com.syncd.android.core.network

import com.syncd.android.core.auth.TokenProvider
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Response
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import java.util.concurrent.TimeUnit

/**
 * One JSON configuration for REST and Socket.IO payloads.
 * - ignoreUnknownKeys: the server may add fields (additive changes must not break us).
 * - explicitNulls=false: optional outgoing fields are omitted, so the server sees
 *   `undefined` (e.g. `expectedFrontVideoId` on `queue:advance`), never `null`.
 */
val SyncDJson: Json = Json {
    ignoreUnknownKeys = true
    explicitNulls = false
    coerceInputValues = true
}

/**
 * Attaches `Authorization: Bearer <token>` (what `clerkMiddleware` reads). On a
 * 401 it retries exactly once with a force-refreshed token; a second 401 means
 * the session really is gone and surfaces as [ApiError.Unauthorized].
 *
 * Runs on OkHttp's dispatcher threads, so blocking for the token is acceptable.
 */
class AuthInterceptor(private val tokens: TokenProvider) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val token = runBlocking { tokens.token(forceRefresh = false) }
        val first = chain.proceed(chain.request().withBearer(token))
        if (first.code != 401 || token == null) return first

        val refreshed = runBlocking { tokens.token(forceRefresh = true) } ?: return first
        first.close()
        return chain.proceed(chain.request().withBearer(refreshed))
    }

    private fun okhttp3.Request.withBearer(token: String?) =
        if (token == null) this else newBuilder().header("Authorization", "Bearer $token").build()
}

object NetworkFactory {
    /**
     * Shared base client: the Socket.IO transport and the image loader reuse its
     * connection pool. It carries no auth — REST adds [AuthInterceptor] on top.
     * No logging interceptor is installed: request logs would contain bearer tokens.
     */
    fun baseClient(): OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .writeTimeout(20, TimeUnit.SECONDS)
        .build()

    fun api(base: OkHttpClient, baseUrl: String, tokens: TokenProvider): SyncDApi {
        val client = base.newBuilder().addInterceptor(AuthInterceptor(tokens)).build()
        return Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(client)
            .addConverterFactory(SyncDJson.asConverterFactory("application/json".toMediaType()))
            .build()
            .create(SyncDApi::class.java)
    }
}
