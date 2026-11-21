package com.splinch.nethra.assistant.context

import com.splinch.nethra.assistant.context.*
import com.splinch.nethra.assistant.conversation.*
import com.splinch.nethra.assistant.planning.*
import com.splinch.nethra.assistant.provider.*
import com.splinch.nethra.assistant.runtime.*
import com.splinch.nethra.assistant.tools.*
import com.splinch.nethra.assistant.trust.*

data class Entity(
    val type: String,   // "person", "date", "amount", "thread_id", etc.
    val value: String
)

data class ReaderOutput(
    val summary: String,                   // ≤ 400 chars
    val entities: List<Entity> = emptyList(),
    val contentRequests: List<String> = emptyList(),  // injected instructions surfaced as observations
    val salience: Float = 0f               // 0..1, for proactivity gating
)
