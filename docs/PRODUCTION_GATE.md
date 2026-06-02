# Production Gate

`prod 100%` for the static FideoVue port means all source domains are represented
by small Vue SFCs, domain modules, infrastructure adapters and tests, with live
providers behind explicit deployment gates.

| Area | Evidence | Status |
| --- | --- | --- |
| Vue/SFC static runtime | Local Vue runtime, SFC loader, no bundler, CSP-safe boot | Passed |
| UnoCSS runtime | Local runtime files, Wind3 preset and fallback styles | Passed |
| Domain parity | Operations, inventory, catalog, customers, suppliers, delivery, finance, messages, portals, assets and planogram | Passed |
| MySQL snapshot adapter | PocketBase-compatible route manifest, bootstrap, persist, runtime overview, realtime plan and dry receipts via `pb-mysql` | Passed |
| Veeper comms | WhatsApp follow-up, promotion and provider receipt adapters | Passed |
| AI engines | codex-goal adapter and dry-run planning receipt | Passed |
| Security | CSP, no public secrets, no eval, no raw HTML insertion | Passed |
| Quality | Line guard, SFC checks, domain tests, browser smoke | Passed |
| Commits | Each production slice committed on `port/vue3-sfc-unocss` | Passed |

## Deployment Gates

These are intentionally not activated in the static repo because they require
deployment credentials, running services or local operator paths:

- MySQL credentials and tables on the production host.
- OneSignal SDK execution with an app id and explicit live flag.
- Veeper live receipt loop against a running provider service.
- Gemini/provider-backed correction execution with server-side credentials.
- codex-goal live engine execution once `C:\git\codex\codex-goal` exists.

Until those inputs are configured, the app exposes dry-run or gated receipts
instead of client-side secrets or unsafe SDK loading. PocketBase remains a
legacy compatibility name for the route manifest; the active persistence target
is MySQL through `api/fideo/index.php`.
