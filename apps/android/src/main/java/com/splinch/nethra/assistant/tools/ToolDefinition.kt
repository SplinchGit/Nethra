package com.splinch.nethra.assistant.tools

import com.splinch.nethra.assistant.context.*
import com.splinch.nethra.assistant.conversation.*
import com.splinch.nethra.assistant.planning.*
import com.splinch.nethra.assistant.provider.*
import com.splinch.nethra.assistant.runtime.*
import com.splinch.nethra.assistant.tools.*
import com.splinch.nethra.assistant.trust.*

data class ToolDefinition(
    val name: String,
    val description: String,
    val parametersJson: String   // JSON Schema object string for the "parameters" field
)
