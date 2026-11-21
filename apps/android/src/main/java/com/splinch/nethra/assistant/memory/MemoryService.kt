package com.splinch.nethra.assistant.memory

import com.splinch.nethra.assistant.context.ContextBlock
import com.splinch.nethra.assistant.context.Provenance
import com.splinch.nethra.assistant.tools.ToolApplyResult
import com.splinch.nethra.assistant.tools.UndoAction
import com.splinch.nethra.data.database.memory.MemoryFactDao
import com.splinch.nethra.data.database.memory.MemoryFactEntity
import java.util.UUID
import org.json.JSONObject

/** Owns durable assistant facts, their limits, and their context rendering. */
class MemoryService(
    private val dao: MemoryFactDao,
    private val maxFacts: Int = MAX_FACTS
) {
    suspend fun contextBlock(): ContextBlock? {
        val facts = dao.allOnce()
        if (facts.isEmpty()) return null
        val content = buildString {
            append("Known facts about the owner (remembered from prior conversations):\n")
            facts.forEach { fact ->
                append("- [").append(fact.category).append("] ").append(fact.content).append('\n')
            }
        }
        return ContextBlock(
            role = "system",
            content = content,
            provenance = Provenance.NETHRA,
            sourceRef = "nethra:memory"
        )
    }

    suspend fun searchText(query: String): String {
        val results = if (query.isBlank()) dao.allOnce() else dao.search(query)
        return if (results.isEmpty()) {
            "No remembered facts" + (if (query.isNotBlank()) " matching \"$query\"" else "") + "."
        } else {
            results.joinToString("\n") { "- [${it.category}] ${it.content}" }
        }
    }

    suspend fun remember(content: String, category: String, sessionId: String): ToolApplyResult {
        if (content.isBlank()) return ToolApplyResult("", errorOutput("Missing content"))
        if (dao.count() >= maxFacts) {
            return ToolApplyResult(
                "",
                errorOutput("Memory is at its limit ($maxFacts facts). Delete something first in Settings > Memory.")
            )
        }
        val id = UUID.randomUUID().toString()
        dao.insert(
            MemoryFactEntity(
                id = id,
                content = content,
                category = category.ifBlank { "other" },
                createdAt = System.currentTimeMillis(),
                sourceRef = "chat:$sessionId"
            )
        )
        return ToolApplyResult(
            confirmation = "Remembered: $content",
            toolOutput = successOutput("remember_fact", id),
            undo = UndoAction("Undo remember") {
                dao.delete(id)
                "Forgot that fact."
            }
        )
    }

    suspend fun forget(id: String): ToolApplyResult {
        if (id.isBlank()) return ToolApplyResult("", errorOutput("Missing id"))
        dao.delete(id)
        return ToolApplyResult(
            confirmation = "Forgot that fact.",
            toolOutput = successOutput("forget_fact", id)
        )
    }

    private fun successOutput(action: String, detail: String): String = JSONObject()
        .put("status", "applied")
        .put("action", action)
        .put("detail", detail)
        .toString()

    private fun errorOutput(message: String): String = JSONObject()
        .put("status", "error")
        .put("message", message)
        .toString()

    companion object {
        const val MAX_FACTS = 200
    }
}
