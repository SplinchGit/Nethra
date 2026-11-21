# Nethra subscriptions, wallet and rename implementation plan

> Execute inline using superpowers:executing-plans and test-driven-development. The owner requested implementation directly after clarifying the design.

**Goal:** Make GPT and Claude subscription-backed Nethra agents, provide an Electrum wallet with exact owner approval before spending, and rename the product and repository to Nethra.

**Architecture:** Reuse the existing agent tool loop for both subscription clients. The unmodified official CLIs own authentication; no API credentials or paid fallback are allowed. A host-only Electrum adapter owns encrypted connection settings and payment proposals; model tools cannot approve payments. Existing installation identifiers and on-disk data require compatibility migration.

**Tech stack:** Node.js, Electron, Kotlin, Electrum JSON-RPC, existing test runners.

## Constraints

- Work in the canonical checkout on main, holding .git/nethra-writer.lock; preserve pre-existing files.
- GPT and Claude must fail closed unless signed in with their subscriptions. No API fallback, even when keys are present in the environment.
- Keys/seeds remain in Electrum; local connection and spending credentials use OS encryption outside the checkout. Never expose credentials to models, sync, audit, or Git.
- Every outgoing payment needs explicit owner approval of its exact destination, amount and fee; signing/broadcast never happens from a model tool.
- Notifications expose pending payments; rejection, expiry, duplicate approval and indeterminate broadcast are handled without repeated spending.

## Review focus

- API-authenticated CLIs, injected API environment variables, exhausted quotas: no paid inference.
- Unknown or malformed model tool requests: rejected by existing schema validation.
- Payment changes, concurrent/replayed approvals, restart during broadcast: no duplicate or unapproved sends.
- Electrum RPC error responses: secrets cannot enter stored errors or model results.
- Renamed installations retain data, pairing, saved tasks and local model access.

### Task 1: Subscription agents

- [x] Add failing tests for subscription preflight, environment sanitization, structured tool calls, cancellation and no network fallback.
- [x] Implement subscription-models.js and subscription-runtime.js; route LocalAgentRuntime.chat to official CLIs for subscription model IDs.
- [x] Make task model validation and desktop/Android selectors accept subscription models; keep local measurement tools local.
- [x] Run focused tests and full Windows suite.

### Task 2: Electrum wallet

- [x] Add failing tests for loopback RPC, encrypted settings, pending payment approval, replay protection and unknown broadcast outcome.
- [x] Implement electrum-wallet.js with allowlisted reads, receiving requests, unsigned proposals, host-only approval, signing and broadcast.
- [x] Expose wallet tools in chat/objectives; add local settings and pending payment review UI.
- [x] Run focused tests and full Windows suite.

### Task 3: Nethra rename

- [x] Rename tracked product/source references and file paths; keep explicit compatibility migration for existing installation identities, data and protocols.
- [x] Update packaging, launch scripts, Android namespaces and GitHub links.
- [x] Verify Windows tests/package and Android tests/build; perform independent review and fix material findings.
- [x] Rename GitHub repository and update origin after source is ready; review exact canonical diff, commit/push main without force.

## Execution record

- Initial tracked working tree clean at 784c1db; numerous existing untracked artifacts left untouched.
- Writer lock acquired by interactive Codex session.

- Implementation: subscription runtime/tool loop and desktop/Android model selection; paid OpenAI/Anthropic API paths disabled/migrated.
- Owner confirmation of provider-side disabled extra usage is required locally before ANY official client inference; the app cannot change provider billing policy. The central gate covers advisors, memory inference and Foreman too.
- Wallet: local encrypted RPC connection, host-only exact approval and password entry, notifications on PC and paired phone, no private-key/seed methods. Broadcast failures consume approval and report UNKNOWN.
- Rename compatibility: retain production Firebase project and Android installation identity, encrypted preferences filename and existing storage/keystore IDs. Keep Windows installed data folders, canonical checkout, local model aliases and CI secret-name fallbacks.
- Independent review found and fixed billing-gate bypass, native Codex shell availability, existing development data-directory fallback, post-broadcast receipt-error misreporting, and Android subscription selector omissions. Regression tests cover the first four; Android build covers selector wiring.
- Verification: focused security tests passed; Windows full suite 591/591 passed before final review additions; Android unit tests and assembleDebug passed. Final reruns in progress.

- Final independent review fixes verified, including central billing gate regression and exact-once broadcast persistence regression. No live paid-provider requests or Bitcoin payments were made.
- Windows full suite passed, Android unit tests and APK build passed, web production build passed. Packaged Nethra launched through Nethra.lnk and retained existing conversations in junction-windows user data. The new startup task replaces the previous task; original task/shortcut archived outside Git.
- GitHub repository renamed to SplinchGit/Nethra and origin updated. Canonical checkout remains Documents/Junction as instructed.
- Local setup pending: owner must confirm provider-side extra usage/autopurchase is disabled; billing confirmations remain unchecked. Electrum was not found at standard paths and no wallet connection credentials were supplied, so no live wallet is connected. Windows raised its normal firewall prompt for Nethra.exe; the owner must choose network access. No Android device is attached; the APK is built for owner installation.

- Final evidence: Windows npm test PASS (last node:test group 592/592, plus subscription/wallet/compatibility preflight tests and legacy suites); Android 228/228 unit tests, assembleDebug PASS; web production build PASS; pc-companion 5/5 and nethra-functions 5/5 PASS; final Windows pack:workspace PASS and shortcut launched. Staged secret-pattern scan: no private-key/token matches.
- UI accessibility inspection confirmed Nethra title and existing conversations. The desktop capture helper could not activate/capture the window, so wallet-screen visual inspection was not completed; native firewall prompt was left for owner review.
