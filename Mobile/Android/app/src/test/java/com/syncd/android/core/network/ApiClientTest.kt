package com.syncd.android.core.network

import com.syncd.android.core.auth.TokenProvider
import kotlinx.coroutines.test.runTest
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import okhttp3.OkHttpClient
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class ApiClientTest {
    private lateinit var server: MockWebServer
    private val tokenRequests = mutableListOf<Boolean>()
    private var nextToken = "token-1"
    private val tokens = TokenProvider { force ->
        tokenRequests += force
        nextToken
    }

    @Before
    fun setUp() {
        server = MockWebServer()
        server.start()
    }

    @After
    fun tearDown() = server.close()

    private fun api() = NetworkFactory.api(OkHttpClient(), server.url("/api/").toString(), tokens)

    private fun json(code: Int, body: String, vararg headers: Pair<String, String>) =
        MockResponse.Builder().code(code).body(body).addHeader("Content-Type", "application/json").apply {
            headers.forEach { addHeader(it.first, it.second) }
        }.build()

    @Test
    fun `attaches the bearer token clerkMiddleware expects`() = runTest {
        server.enqueue(json(200, """{"authenticated":true,"user":null,"onboardingComplete":false}"""))
        val r = apiCall { api().me() }
        assertTrue(r is ApiResult.Success)
        val req = server.takeRequest()
        assertEquals("Bearer token-1", req.headers["Authorization"])
        assertEquals("/api/me", req.url.encodedPath)
    }

    @Test
    fun `401 retries once with a force-refreshed token`() = runTest {
        server.enqueue(json(401, """{"authenticated":false,"message":"Unauthorized"}"""))
        server.enqueue(json(200, """{"authenticated":true,"user":null,"onboardingComplete":false}"""))
        val requested = mutableListOf<Boolean>()
        // Cached token is stale; only a forced refresh yields a valid one.
        val api = NetworkFactory.api(OkHttpClient(), server.url("/api/").toString()) { force ->
            requested += force
            if (force) "fresh" else "stale"
        }
        val r = apiCall { api.me() }
        assertTrue(r is ApiResult.Success)
        assertEquals("Bearer stale", server.takeRequest().headers["Authorization"])
        assertEquals("Bearer fresh", server.takeRequest().headers["Authorization"])
        assertEquals(listOf(false, true), requested)
    }

    @Test
    fun `persistent 401 is a session problem`() = runTest {
        server.enqueue(json(401, """{"message":"Unauthorized"}"""))
        server.enqueue(json(401, """{"message":"Unauthorized"}"""))
        val r = apiCall { api().me() }
        assertTrue((r as ApiResult.Failure).error is ApiError.Unauthorized)
    }

    @Test
    fun `server error messages are surfaced`() = runTest {
        server.enqueue(json(404, """{"message":"Room not found"}"""))
        val r = apiCall { api().getRoom("ABC234") } as ApiResult.Failure
        assertEquals(ApiError.Http(404, "Room not found"), r.error)
        assertEquals("/api/rooms/ABC234", server.takeRequest().url.encodedPath)
    }

    @Test
    fun `rate limits carry Retry-After`() = runTest {
        server.enqueue(json(429, """{"message":"Too many requests. Try again in 12s."}""", "Retry-After" to "12"))
        val r = apiCall { api().joinRoom("ABC234") } as ApiResult.Failure
        val e = r.error as ApiError.RateLimited
        assertEquals(12, e.retryAfterSeconds)
        assertEquals("Too many requests. Try again in 12s.", e.message)
    }

    @Test
    fun `contract drift is a protocol error, not a crash`() = runTest {
        server.enqueue(json(200, """{"unexpected":true}"""))
        val r = apiCall { api().getRoom("ABC234") } as ApiResult.Failure
        assertTrue(r.error is ApiError.Protocol)
    }

    @Test
    fun `unreachable server is offline`() = runTest {
        val url = server.url("/api/").toString()
        server.close()
        val r = apiCall { NetworkFactory.api(OkHttpClient(), url, tokens).me() } as ApiResult.Failure
        assertTrue(r.error is ApiError.Offline)
    }

    @Test
    fun `leave posts to the leave route and decodes roomDeleted`() = runTest {
        server.enqueue(json(200, """{"left":true,"roomDeleted":true}"""))
        val r = apiCall { api().leaveRoom("ABC234") } as ApiResult.Success
        assertTrue(r.value.roomDeleted)
        val req = server.takeRequest()
        assertEquals("POST", req.method)
        assertEquals("/api/rooms/ABC234/leave", req.url.encodedPath)
    }
}
