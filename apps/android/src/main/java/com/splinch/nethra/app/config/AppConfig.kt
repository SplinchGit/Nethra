package com.splinch.nethra.app.config

import com.splinch.nethra.BuildConfig

object AppConfig {
    val buildWebClientId: String
        get() = sanitizeWebClientId(BuildConfig.NETHRA_WEB_CLIENT_ID)

    val buildRealtimeEndpoint: String
        get() = BuildConfig.NETHRA_REALTIME_ENDPOINT.trim()

    val buildRealtimeClientSecretEndpoint: String
        get() = BuildConfig.NETHRA_REALTIME_CLIENT_SECRET_ENDPOINT.trim()

    val buildChatModel: String
        get() = BuildConfig.NETHRA_CHAT_MODEL.trim()

    fun sanitizeWebClientId(value: String?): String {
        val trimmed = value?.trim().orEmpty()
        if (trimmed.isBlank()) return ""
        if (trimmed.equals("missing_nethra_web_client_id", ignoreCase = true)) return ""
        if (trimmed.startsWith("missing_", ignoreCase = true)) return ""
        if (trimmed.equals("null", ignoreCase = true)) return ""
        return trimmed
    }

    fun looksLikeWebClientId(value: String): Boolean {
        return value.contains(".apps.googleusercontent.com")
    }
}
