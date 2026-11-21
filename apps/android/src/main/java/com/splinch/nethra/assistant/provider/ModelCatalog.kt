package com.splinch.nethra.assistant.provider

import com.splinch.nethra.assistant.context.*
import com.splinch.nethra.assistant.conversation.*
import com.splinch.nethra.assistant.planning.*
import com.splinch.nethra.assistant.provider.*
import com.splinch.nethra.assistant.runtime.*
import com.splinch.nethra.assistant.tools.*
import com.splinch.nethra.assistant.trust.*

/**
 * Single source of truth for every provider and model Nethra knows about —
 * display metadata (wizard/Settings pickers), routing (base URL), and cost
 * estimation all read from here instead of being scattered across
 * ProviderRegistry's per-provider `when` branches, provider class defaults,
 * and a separate substring-matched pricing table.
 */
data class ModelEntry(
    val id: String,
    val displayName: String,
    val costTier: String,
    val blurb: String,
    val inputPerMillionUsd: Double,
    val outputPerMillionUsd: Double,
    val supportsVision: Boolean = false,
    /**
     * True for Anthropic models on the adaptive-thinking API surface (Claude 4.6
     * and later). Those models think by default and count thinking against
     * max_tokens, so requests need extra output headroom; older ones reject the
     * `thinking: {type: "adaptive"}` / `output_config.effort` fields outright,
     * which is why this can't just be assumed.
     */
    val supportsAdaptiveThinking: Boolean = false
)

data class ProviderDefinition(
    val id: String,
    val displayName: String,
    val platformGroup: String,
    val sourceLabel: String,
    val credentialProviderId: String? = id,
    val recommendationTag: String,
    val recommendationDetail: String,
    val apiKeyUrl: String?,
    val baseUrl: String,
    val requiresBaseUrl: Boolean = false,
    /** Local/OpenAI-compatible services can be deliberately keyless. */
    val requiresApiKey: Boolean = true,
    val models: List<ModelEntry> = emptyList(),
    val defaultModelId: String = ""
)

data class ProviderRoute(
    val providerId: String,
    val credentialProviderId: String?,
    val baseUrl: String,
    val modelId: String
)

object ModelCatalog {
    val providers: List<ProviderDefinition> = listOf(
        ProviderDefinition(id="codex", displayName="GPT on your PC", platformGroup="Subscriptions", sourceLabel="ChatGPT subscription", credentialProviderId=null, recommendationTag="Subscription only", recommendationDetail="Signed-in Codex on your paired PC. No paid fallback.", apiKeyUrl=null, baseUrl="", requiresApiKey=false, models=listOf(ModelEntry("codex:default","GPT · Codex default","Subscription","Nethra tools through your paired PC",0.0,0.0)), defaultModelId="codex:default"),
        ProviderDefinition(id="claude", displayName="Claude on your PC", platformGroup="Subscriptions", sourceLabel="Claude subscription", credentialProviderId=null, recommendationTag="Subscription only", recommendationDetail="Signed-in Claude Code on your paired PC. No paid fallback.", apiKeyUrl=null, baseUrl="", requiresApiKey=false, models=listOf(ModelEntry("claude:sonnet","Claude Sonnet","Subscription","Nethra tools through your paired PC",0.0,0.0),ModelEntry("claude:opus","Claude Opus","Subscription","Nethra tools through your paired PC",0.0,0.0)), defaultModelId="claude:sonnet"),
        ProviderDefinition(
            id = "local",
            displayName = "Qwen on your PC",
            platformGroup = "Local",
            sourceLabel = "Qwen · local",
            credentialProviderId = null,
            recommendationTag = "Your PC",
            recommendationDetail = "Your signed-in Nethra PC runs this model. No API key, VPN, or endpoint setup is required.",
            apiKeyUrl = null,
            baseUrl = "",
            requiresApiKey = false,
            defaultModelId = "qwen3:30b",
            models = listOf(
                ModelEntry("qwen3:30b", "Qwen3 30B", "Local agent", "Runs on your paired PC with native agent tools and always-on thinking.", 0.0, 0.0),
                ModelEntry("nethra-qwen3-next-thinking:80b-q4km", "Qwen3-Next 80B Thinking · Q4_K_M", "Local agent", "Official Qwen weights on your paired PC. Requires substantial memory.", 0.0, 0.0)
            )
        ),
        ProviderDefinition(
            id = "anthropic",
            displayName = "Anthropic",
            platformGroup = "First Party",
            sourceLabel = "Anthropic · first party",
            recommendationTag = "Low priority",
            recommendationDetail = "Best balance of quality and cost for everyday use.",
            apiKeyUrl = "https://console.anthropic.com/settings/keys",
            baseUrl = "https://api.anthropic.com/v1",
            defaultModelId = "claude-sonnet-5",
            models = listOf(
                ModelEntry("claude-haiku-4-5", "Claude Haiku 4.5", "$ Cheap", "Fastest and cheapest Claude — good for quick voice replies.", 1.0, 5.0, supportsVision = true),
                ModelEntry("claude-sonnet-5", "Claude Sonnet 5", "$$ Balanced", "Near-flagship quality at Sonnet cost — the best everyday default.", 3.0, 15.0, supportsVision = true, supportsAdaptiveThinking = true),
                ModelEntry("claude-opus-4-8", "Claude Opus 4.8", "$$$ Most capable", "Highly autonomous, strong on long agentic work and knowledge tasks.", 5.0, 25.0, supportsVision = true, supportsAdaptiveThinking = true),
                ModelEntry("claude-opus-5", "Claude Opus 5", "$$$ Most capable", "Deep reasoning and long-horizon agentic work, same price as 4.8.", 5.0, 25.0, supportsVision = true, supportsAdaptiveThinking = true),
                ModelEntry("claude-fable-5", "Claude Fable 5", "$$$$ Frontier", "Anthropic's most capable model. Thinking is always on, so replies take longer.", 10.0, 50.0, supportsVision = true, supportsAdaptiveThinking = true)
            )
        ),
        ProviderDefinition(
            id = "openai",
            displayName = "OpenAI",
            platformGroup = "First Party",
            sourceLabel = "OpenAI · first party",
            recommendationTag = "Most capable",
            recommendationDetail = "Widest tool support and strong reasoning for complex tasks.",
            apiKeyUrl = "https://platform.openai.com/api-keys",
            baseUrl = "https://api.openai.com/v1",
            defaultModelId = "gpt-5.6-luna",
            models = listOf(
                ModelEntry("gpt-5.6-luna", "GPT-5.6 Luna", "$ Efficient", "Fast, cost-conscious GPT-5.6 for everyday chat and voice.", 1.0, 6.0, supportsVision = true),
                ModelEntry("gpt-5.6-terra", "GPT-5.6 Terra", "$$ Balanced", "Strong intelligence at a lower cost than the flagship.", 2.5, 15.0, supportsVision = true),
                ModelEntry("gpt-5.6-sol", "GPT-5.6 Sol", "$$$ Frontier", "OpenAI's flagship for complex professional work.", 5.0, 30.0, supportsVision = true)
            )
        ),
        ProviderDefinition(
            id = "nvidia",
            displayName = "NVIDIA",
            platformGroup = "First Party",
            sourceLabel = "NVIDIA · first party",
            recommendationTag = "API key",
            recommendationDetail = "Direct NVIDIA API using the key encrypted on this device.",
            apiKeyUrl = "https://build.nvidia.com/",
            baseUrl = "https://integrate.api.nvidia.com/v1",
            defaultModelId = "nvidia/nemotron-3-ultra-550b-a55b",
            models = listOf(
                ModelEntry("nvidia/nemotron-3-ultra-550b-a55b", "Nemotron 3 Ultra", "NVIDIA API", "Direct from NVIDIA.", 0.0, 0.0)
            )
        ),
        ProviderDefinition(
            id = "openrouter",
            displayName = "NVIDIA",
            platformGroup = "OpenRouter",
            sourceLabel = "NVIDIA via OpenRouter",
            credentialProviderId = "openrouter",
            recommendationTag = "FREE",
            recommendationDetail = "NVIDIA Nemotron 3 Ultra through OpenRouter's free endpoint. No paid fallback.",
            apiKeyUrl = "https://openrouter.ai/keys",
            baseUrl = "https://openrouter.ai/api/v1",
            defaultModelId = "nvidia/nemotron-3-ultra-550b-a55b:free",
            models = listOf(
                ModelEntry(
                    "nvidia/nemotron-3-ultra-550b-a55b:free",
                    "Nemotron 3 Ultra (FREE)",
                    "FREE",
                    "NVIDIA's reasoning and orchestration model via OpenRouter's free endpoint.",
                    0.0,
                    0.0
                )
            )
        ),
        ProviderDefinition(
            id = "custom",
            displayName = "Custom",
            platformGroup = "Advanced",
            sourceLabel = "Custom endpoint",
            recommendationTag = "Advanced",
            recommendationDetail = "Point at any OpenAI-compatible endpoint you run or trust.",
            apiKeyUrl = null,
            baseUrl = "",
            requiresBaseUrl = true
        )
    )

    /** The everyday chat surface stays focused on the supported first-party and explicit cloud lanes. */
    val primaryProviders: List<ProviderDefinition>
        get() = providers.filter { it.id in setOf("local", "codex", "claude", "nvidia", "openrouter") }

    fun providerById(id: String): ProviderDefinition? = providers.find { it.id == id }

    fun modelById(providerId: String, modelId: String): ModelEntry? =
        providerById(providerId)?.models?.find { it.id == modelId }

    fun normalizeModelId(providerId: String, modelId: String): String {
        if (providerId == "local" && (modelId.startsWith("codex:") || modelId in listOf("claude:sonnet","claude:opus"))) return modelId
        if (providerId == "local" && modelId.startsWith("junction-qwen")) return normalizeModelId(providerId, modelId.replaceFirst("junction-qwen", "nethra-qwen"))
        val provider = providerById(providerId) ?: return modelId
        if (providerId == "custom") return modelId
        if (providerId == "local" && modelId in listOf(
                "nethra-qwen3-next:80b-q3km", "nethra-qwen3-next-thinking:80b-q3km",
                "hf.co/unsloth/Qwen3-Next-80B-A3B-Instruct-GGUF:Q3_K_M",
                "hf.co/unsloth/Qwen3-Next-80B-A3B-Thinking-GGUF:Q3_K_M",
                "hf.co/Qwen/Qwen3-Next-80B-A3B-Thinking-GGUF:Q4_K_M"
            )) return "nethra-qwen3-next-thinking:80b-q4km"
        return provider.models.find { it.id == modelId }?.id ?: provider.defaultModelId
    }

    fun normalizeFrontierModelId(providerId: String, selectedModelId: String, frontierModelId: String): String {
        val selected = normalizeModelId(providerId, selectedModelId)
        if (providerId == "custom") return frontierModelId.ifBlank { selected }
        return providerById(providerId)?.models?.find { it.id == frontierModelId }?.id ?: selected
    }

    fun routeFor(providerId: String, modelId: String): ProviderRoute? {
        val provider = providerById(providerId) ?: return null
        return ProviderRoute(provider.id, provider.credentialProviderId, provider.baseUrl, normalizeModelId(providerId, modelId))
    }

    /**
     * Best-effort match by reported model string, for cost estimation when the
     * value came back from the API (e.g. a custom/free-text model) rather than
     * being selected from this catalog directly.
     */
    fun findModelByReportedName(reported: String?): ModelEntry? {
        if (reported.isNullOrBlank()) return null
        val lower = reported.lowercase()
        providers.forEach { provider ->
            provider.models.forEach { model ->
                if (lower == model.id.lowercase() || lower.contains(model.id.lowercase())) return model
            }
        }
        return null
    }

    // Conservative blended rate for a reported model this catalog doesn't recognise
    // (e.g. a custom/free-text endpoint) -- an estimate for the owner's own budgeting,
    // never a billing-accurate figure.
    private val fallbackInputPerMillionUsd = 1.0
    private val fallbackOutputPerMillionUsd = 3.0

    fun estimateCostUsd(model: String?, tokensIn: Int?, tokensOut: Int?): Double? {
        if (tokensIn == null && tokensOut == null) return null
        val entry = findModelByReportedName(model)
        val inputRate = (entry?.inputPerMillionUsd ?: fallbackInputPerMillionUsd) / 1_000_000
        val outputRate = (entry?.outputPerMillionUsd ?: fallbackOutputPerMillionUsd) / 1_000_000
        return (tokensIn ?: 0) * inputRate + (tokensOut ?: 0) * outputRate
    }
}
