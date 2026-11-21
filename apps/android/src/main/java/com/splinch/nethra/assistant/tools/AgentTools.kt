package com.splinch.nethra.assistant.tools

import com.splinch.nethra.assistant.context.*
import com.splinch.nethra.assistant.conversation.*
import com.splinch.nethra.assistant.planning.*
import com.splinch.nethra.assistant.provider.*
import com.splinch.nethra.assistant.runtime.*
import com.splinch.nethra.assistant.tools.*
import com.splinch.nethra.assistant.trust.*

import org.json.JSONObject

data class StreamingAssistantMessage(
    val itemId: String,
    val content: String
)

data class PendingToolCall(
    val callId: String,
    val name: String,
    val arguments: JSONObject,
    val summary: String
)

data class ToolApplyResult(
    val confirmation: String,
    val toolOutput: String,
    val undo: UndoAction? = null
)

data class UndoAction(
    val label: String,
    val action: suspend () -> String
)
