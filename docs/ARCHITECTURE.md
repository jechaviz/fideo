# FideoVue Architecture

## Product Goal

FideoVue preserves Fideo's operational cockpit strengths while removing the
largest structural risks from the legacy React/PocketBase version:

- no component file over 600 lines
- no frontend dependency install required at runtime
- no public client-side secret assumptions
- no direct provider delivery without adapter receipt
- no UI mutation without a domain operation boundary

## Layers

### Platform

`src/platform` owns boot, SFC loading, dependency injection and runtime services.
It is the only layer that touches Vue app creation.

### Domain

`src/domain` contains pure business state, selectors, validation and operations.
The Action Center uses this layer for follow-up, reassignment and resolution.

### Infrastructure

`src/infrastructure` contains HTTP adapters for the MySQL snapshot runtime,
Veeper and AI engines. The snapshot adapter keeps the historical
PocketBase-compatible route names while using `pb-mysql` on the server. Adapters
never mutate UI state directly and always return receipts.

### Components

`src/components` contains thin Vue SFCs. Components display state and call
kernel actions. They do not own transport or business rules.

## Security Baseline

- CSP in `index.html` blocks remote scripts and object embeds.
- Vue and Uno runtime are local vendored files.
- SFC loader accepts only local `.vue` files under `src`.
- WhatsApp/Veeper calls are dry-run or adapter-gated by default.
- AI engine access is represented through a narrow adapter.
- User-controlled strings are normalized by `domain/security/sanitize.js`.

## Migration Strategy

1. Port operational shell and exception loop.
2. Port domain modules: catalog, inventory, customers, suppliers, deliveries,
   finances, messaging and staff portals.
3. Replace large Fideo source files with small Vue components plus domain
   services.
4. Keep live MySQL, Veeper, OneSignal and AI execution behind deployment gates
   until credentials and services are supplied.
5. Treat the static port as production-ready when parity, security and local
   gates pass, with live provider activation tracked separately.
