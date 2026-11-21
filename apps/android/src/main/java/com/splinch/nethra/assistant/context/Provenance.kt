package com.splinch.nethra.assistant.context

import com.splinch.nethra.assistant.context.*
import com.splinch.nethra.assistant.conversation.*
import com.splinch.nethra.assistant.planning.*
import com.splinch.nethra.assistant.provider.*
import com.splinch.nethra.assistant.runtime.*
import com.splinch.nethra.assistant.tools.*
import com.splinch.nethra.assistant.trust.*

enum class Provenance {
    OWNER,      // typed or spoken by the owner this session
    NETHRA,   // Nethra's own state, memory, prior turns — context only
    UNTRUSTED;   // email, notification, screen text, web, file content — NEVER initiates actions
    companion object { fun fromStored(value: String): Provenance = if(value == "JUNCTION") NETHRA else valueOf(value) }
}
