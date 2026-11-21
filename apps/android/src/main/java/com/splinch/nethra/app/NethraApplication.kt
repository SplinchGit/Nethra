package com.splinch.nethra.app

import android.app.Application
import android.util.Log
import com.splinch.nethra.feature.scheduler.NotificationHelper
import com.splinch.nethra.feature.scheduler.Scheduler
import com.splinch.nethra.data.preference.UserPrefsRepository
import kotlinx.coroutines.CoroutineExceptionHandler
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.SupervisorJob

class NethraApplication : Application() {
    private val exceptionHandler = CoroutineExceptionHandler { _, throwable ->
        Log.e(TAG, "Background task failed", throwable)
    }
    private val appScope = CoroutineScope(SupervisorJob() + Dispatchers.Default + exceptionHandler)

    // Built lazily rather than eagerly in onCreate: touching it for the first time is what
    // constructs ChatManager and friends, and the app should not pay that cost (or start
    // pulling in the Room database) on every cold start before anything actually needs it.
    // MainActivity and RemoteCommandForegroundService both read this same instance, so
    // whichever one runs first builds it and the other reuses it.
    val container: AppContainer by lazy { AppContainer(this) }

    override fun onCreate() {
        super.onCreate()
        runCatching { NotificationHelper.createChannels(this) }
            .onFailure { Log.e(TAG, "Failed to create notification channels", it) }

        val prefsRepository = UserPrefsRepository(this)

        appScope.launch {
            val interval = prefsRepository.digestIntervalMinutesFlow.first().coerceAtLeast(15)
            val enabled = prefsRepository.digestEnabledFlow.first()
            Scheduler.configureFeedDigest(this@NethraApplication, enabled, interval.toLong())
        }
        appScope.launch {
            runCatching { com.splinch.nethra.feature.scheduler.DeviceCommandWorker.schedule(this@NethraApplication) }
                .onFailure { Log.e(TAG, "Failed to schedule device command sync", it) }
        }
    }

    private companion object {
        private const val TAG = "NethraApplication"
    }
}
