# Production Gate

`prod 100%` requires evidence for each item:

| Area | Evidence Required | Current Slice |
| --- | --- | --- |
| Vue/SFC static runtime | Local Vue, SFC loader, no bundler | Started |
| UnoCSS runtime | Local runtime files and fallback CSS | Started |
| Domain parity | Every Fideo screen ported | Pending |
| PocketBase parity | Bootstrap, persist, runtime, exceptions, messages | Pending |
| Veeper comms | WhatsApp handoff/queue via Veeper receipt | Started |
| AI engines | codex-goal adapter and receipts | Started |
| Security | CSP, sanitizers, no public secrets | Started |
| Quality | Line guard, SFC checks, smoke tests | Started |
| Commits | Slice commits with clean status | Started |

The project does not claim production readiness until all rows are proven by
current-state evidence.

