# Windows launch contract

- A packaged Electron app is a directory runtime, not a standalone `Nethra.exe`.
  `Nethra.exe` must stay beside `resources/app.asar` and `resources/pc-companion`.
- A desktop launch must target the packaged runtime's `Nethra.exe` and use that
  runtime directory as its working directory. Use `npm run desktop` after building
  with `npm run pack:workspace`, or use the NSIS installer from `npm run dist`.
- Never copy only `Nethra.exe` to the Desktop. That creates a broken launch target.
- Normal launches must remain foreground launches. Only the explicit `--background`
  login-item path may hide the window.
- Startup failures must be recorded under the Electron user-data `logs/startup.log`
  and show a recovery window; do not turn startup errors into a silent quit.
- After changing packaging or startup code, run `npm test`, rebuild the package, run
  `npm run desktop`, and launch through the generated `Nethra.lnk`.- The per-user `Nethra <SID>` scheduled task restarts `--agent-host` every
  minute after a failure. Rebuilding the package in place can race it, which starts
  a bare "Electron" window while `app.asar` is missing. Disable the task before
  `pack:workspace` (`schtasks /Change /TN "<task>" /Disable`) and enable it again
  after launching through the shortcut.
- Set `NETHRA_PACK_OUTPUT=nethra-agent-chat-20261022` for both `pack:workspace`
  and `desktop`. Without it the shortcut targets the stale default package, which
  cannot open schema 4.
