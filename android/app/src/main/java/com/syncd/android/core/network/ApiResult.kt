package com.syncd.android.core.network

import com.syncd.android.core.model.ErrorBody
import kotlinx.coroutines.CancellationException
import kotlinx.serialization.SerializationException
import retrofit2.HttpException
import java.io.IOException

/** Failure categories the UI can act on. Messages are user-safe (server messages are already sanitised). */
sealed interface ApiError {
    val message: String

    /** No connection / DNS / timeout — the request may not have reached the server. */
    data class Offline(override val message: String = "You're offline. Check your connection.") : ApiError

    /** 401 even after a forced token refresh — the session is gone. */
    data class Unauthorized(override val message: String = "Your session expired. Please sign in again.") : ApiError

    data class RateLimited(val retryAfterSeconds: Int?, override val message: String) : ApiError

    /** Any other non-2xx; [message] is the server's `{ message }` when present. */
    data class Http(val status: Int, override val message: String) : ApiError

    /** The response did not match the expected contract. */
    data class Protocol(override val message: String = "Unexpected response from the server.") : ApiError
}

sealed interface ApiResult<out T> {
    data class Success<T>(val value: T) : ApiResult<T>
    data class Failure(val error: ApiError) : ApiResult<Nothing>
}

inline fun <T, R> ApiResult<T>.map(transform: (T) -> R): ApiResult<R> = when (this) {
    is ApiResult.Success -> ApiResult.Success(transform(value))
    is ApiResult.Failure -> this
}

/** Runs a Retrofit call and maps every failure to an [ApiError]. Cancellation propagates. */
suspend fun <T> apiCall(block: suspend () -> T): ApiResult<T> =
    try {
        ApiResult.Success(block())
    } catch (e: CancellationException) {
        throw e
    } catch (e: HttpException) {
        ApiResult.Failure(e.toApiError())
    } catch (_: IOException) {
        ApiResult.Failure(ApiError.Offline())
    } catch (_: SerializationException) {
        ApiResult.Failure(ApiError.Protocol())
    } catch (_: IllegalArgumentException) {
        // kotlinx.serialization reports missing required fields this way.
        ApiResult.Failure(ApiError.Protocol())
    }

private fun HttpException.toApiError(): ApiError {
    val status = code()
    val serverMessage = response()?.errorBody()?.string()?.let { body ->
        runCatching { SyncDJson.decodeFromString(ErrorBody.serializer(), body).message }.getOrNull()
    }
    return when (status) {
        401 -> ApiError.Unauthorized()
        429 -> ApiError.RateLimited(
            retryAfterSeconds = response()?.headers()?.get("Retry-After")?.toIntOrNull(),
            message = serverMessage ?: "Too many requests. Try again shortly.",
        )
        else -> ApiError.Http(status, serverMessage ?: defaultMessage(status))
    }
}

private fun defaultMessage(status: Int) = when (status) {
    403 -> "You don't have access to that."
    404 -> "Not found."
    in 500..599 -> "The server had a problem. Try again."
    else -> "Request failed ($status)."
}
