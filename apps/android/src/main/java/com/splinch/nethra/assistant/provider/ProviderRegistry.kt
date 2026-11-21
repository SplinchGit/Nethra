package com.splinch.nethra.assistant.provider

import com.splinch.nethra.assistant.context.*
import com.splinch.nethra.assistant.conversation.*
import com.splinch.nethra.assistant.planning.*
import com.splinch.nethra.assistant.provider.*
import com.splinch.nethra.assistant.runtime.*
import com.splinch.nethra.assistant.tools.*
import com.splinch.nethra.assistant.trust.*

import android.content.Context
import com.splinch.nethra.data.secret.KeyStorage
import com.splinch.nethra.data.preference.ProviderConfig
import com.splinch.nethra.data.preference.UserPrefsRepository
import com.splinch.nethra.data.sync.lan.LanConversationSync
import kotlinx.coroutines.flow.first
import java.util.concurrent.ConcurrentHashMap

class ProviderRegistry(
    private val context: Context,
    private val prefs: UserPrefsRepository,
    private val keyStorage: KeyStorage = KeyStorage(context),
    private val conversationSync: LanConversationSync? = null
) {
    // Health tracking: providerIds that are temporarily deprioritised
    private val deprioritised = ConcurrentHashMap<String, Long>()

    suspend fun getActiveProvider(): LlmProvider? {
        val saved = prefs.providerConfigFlow.first()
        val config = when(saved.providerId) {
            "openai" -> ProviderConfig(providerId="codex",modelId="codex:default")
            "anthropic" -> ProviderConfig(providerId="claude",modelId="claude:sonnet")
            else -> saved
        }
        val definition = ModelCatalog.providerById(config.providerId)
        val credentialId = definition?.credentialProviderId
        val apiKey = credentialId?.let(keyStorage::getApiKey).orEmpty()
        if (definition?.requiresApiKey != false && apiKey.isBlank()) return null
        if (definition?.requiresBaseUrl == true && config.baseUrl.isBlank()) return null
        return buildProvider(config, apiKey)
    }

    /** Human-facing, provider-specific configuration state for the chat surface. */
    suspend fun activeProviderConfigurationError(): String? {
        val saved = prefs.providerConfigFlow.first()
        val config = when(saved.providerId) {
            "openai" -> ProviderConfig(providerId="codex",modelId="codex:default")
            "anthropic" -> ProviderConfig(providerId="claude",modelId="claude:sonnet")
            else -> saved
        }
        val definition = ModelCatalog.providerById(config.providerId)
            ?: return "Unknown AI provider. Choose a provider in Settings."
        if (definition.requiresBaseUrl && config.baseUrl.isBlank()) {
            return if (definition.id == "local") {
                "Local LLM needs its Nethra gateway URL. Open Settings and add the secure PC endpoint."
            } else {
                "${definition.displayName} needs a base URL in Settings."
            }
        }
        if (definition.requiresApiKey && definition.credentialProviderId?.let(keyStorage::getApiKey).isNullOrBlank()) {
            return "${definition.displayName} needs an API key in Settings."
        }
        return null
    }

    suspend fun getWorkhorseProvider(): LlmProvider? = getActiveProvider()

    suspend fun getFrontierProvider(): LlmProvider? {
        val base = getActiveProvider() ?: return null
        return if (base.frontierModel != null) base else null
    }

    fun markUnhealthy(providerId: String) {
        deprioritised[providerId] = System.currentTimeMillis() + 60_000L
        android.util.Log.w("ProviderRegistry", "Deprioritising provider '$providerId' for 60s")
    }

    fun isHealthy(providerId: String): Boolean {
        val until = deprioritised[providerId] ?: return true
        return System.currentTimeMillis() > until
    }

    /**
     * §1.1 health-aware fallback: tries other providers the owner has already
     * stored a key for, skipping [excludeId] and anything still deprioritised.
     * "custom" is never a fallback target -- there's no sensible default base
     * URL to guess for an arbitrary endpoint.
     */
    fun getFallbackProvider(excludeId: String): LlmProvider? {
        val candidates = ModelCatalog.providers
            .map { it.id }
            .filter { it != excludeId && it != "custom" && it != "local" && isHealthy(it) }
        for (candidateId in candidates) {
            val credentialId = ModelCatalog.providerById(candidateId)?.credentialProviderId ?: continue
            val apiKey = keyStorage.getApiKey(credentialId)
            if (apiKey.isBlank()) continue
            android.util.Log.i("ProviderRegistry", "Falling back to provider '$candidateId'")
            return buildProvider(ProviderConfig(providerId = candidateId), apiKey)
        }
        return null
    }

    /**
     * The single place that turns a provider id + stored key into a real
     * [LlmProvider]. Anthropic's Messages API has a genuinely different wire
     * shape (system prompt as a top-level field, SSE event names, auth header)
     * so it gets its own class; every other provider -- including "custom" --
     * speaks the OpenAI Chat Completions shape and only differs by base URL
     * and model name, both of which [ModelCatalog] already knows.
     */
    private fun buildProvider(config: ProviderConfig, apiKey: String): LlmProvider {
        val providerDef = ModelCatalog.providerById(config.providerId)
        val configuredModelId = config.modelId.ifBlank { config.workhorseModel }
            .ifBlank { providerDef?.defaultModelId.orEmpty() }
        // Provider pickers only expose catalog models. When an app update retires an old
        // entry, move that saved selection to the provider's new default instead of
        // silently continuing to call an obsolete model that the UI no longer shows.
        val modelId = ModelCatalog.normalizeModelId(config.providerId, configuredModelId)
        val frontierId = ModelCatalog.normalizeFrontierModelId(config.providerId, modelId, config.frontierModel)

        if (config.providerId in setOf("local", "codex", "claude")) return LanFirstNethraPcProvider(context, modelId.ifBlank { "qwen3:30b" }, conversationSync = conversationSync)

        if (config.providerId == "anthropic") {
            return AnthropicProvider(
                apiKey = apiKey,
                workhorseModel = modelId.ifBlank { "claude-haiku-4-5-20251001" },
                frontierModel = frontierId
            )
        }

        val baseUrl = if (config.providerId == "custom") {
            config.baseUrl.ifBlank { "https://api.openai.com/v1" }
        } else {
            providerDef?.baseUrl?.ifBlank { null } ?: config.baseUrl.ifBlank { "https://api.openai.com/v1" }
        }

        return OpenAiCompatibleProvider(
            id = config.providerId,
            apiKey = apiKey,
            workhorseModel = modelId.ifBlank { "gpt-5.6-luna" },
            frontierModel = frontierId,
            baseUrl = baseUrl
        )
    }
}
