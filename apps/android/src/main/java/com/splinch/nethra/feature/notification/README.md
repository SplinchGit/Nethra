# Notification

## Purpose

Notification owns the user-facing capability for observing Android notifications and safely relaying notification taps and actions into Nethra.

## Main Entry Point

- `service/NethraNotificationListenerService.kt`

## Responsibilities

- receive and normalise posted notifications;
- expose notification-access status and active notification keys;
- preserve tap targets for later user actions;
- route notification tap broadcasts.

## Does Not Own

- feed database schemas and persistence;
- assistant trust or plan decisions;
- general Android accessibility control.

## Flow

Android notification event → capture and normalisation → feed or notification action
