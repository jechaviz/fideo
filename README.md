# FideoVue

FideoVue is the Vue 3/SFC port of `C:\git\customers\fideo`.

This repository is intentionally static-first:

- Vue 3 is vendored as a local browser file in `vendor/vue.runtime.global.prod.js`.
- UnoCSS runtime is vendored as local runtime files.
- Components stay as browser-loaded `.vue` SFC files through `src/platform/sfcLoader.js`.
- Domain logic lives outside components and talks through explicit ports.
- Every source file must stay below 600 lines.

## Run

Serve the folder with any static HTTP server and open the printed URL.

```powershell
cd C:\git\websites\fideovue
node scripts\serve.mjs 4173
```

Then open:

```text
http://127.0.0.1:4173/
```

Opening `index.html` directly is not supported because browser SFC loading uses
`fetch()` and ES modules.

## Verify

```powershell
node scripts/verify.mjs
node scripts/domain-tests.mjs
node scripts/domain-regression-tests.mjs
node scripts/kilo-bridge-smoke.mjs
node scripts/source-inventory.mjs C:\git\customers\fideo\frontend
node scripts/browser-smoke.mjs http://127.0.0.1:4173/
```

The verifier checks:

- required vendor runtime files exist
- source files stay under 600 lines
- no remote script is used in production entrypoint
- required Fideo/Veeper/AI adapters are present
- compact snapshot transport preserves omitted heavy slices
- all SFC files expose template and script blocks
- a real Edge/Chrome headless session renders the operational cockpit

## Architecture

```text
index.html
  -> vendor Vue + Uno runtime
  -> src/main.js
      -> platform/sfcLoader.js
      -> platform/kernel.js
          -> domain state/selectors
          -> domain operations
          -> infrastructure adapters
              -> MySQL snapshot HTTP contract
              -> Veeper WhatsApp/comms contract
              -> codex-goal AI provider contract
```

The first slice ports the operational cockpit shell and the exception loop
contract. The remaining Fideo screens will be migrated domain by domain without
allowing component or backend-equivalent files to grow past the line limit.

## Integration Notes

- Veeper is expected at `http://127.0.0.1:8097` by default.
- Mutating Veeper calls include `X-Veeper-Client: veeper-ui`, matching Veeper's
  anti-CSRF browser contract.
- The PocketBase-compatible route surface is backed by the `pb-mysql` adapter in
  `api/fideo/index.php`, so production persistence uses MySQL without exposing
  PocketBase as a live browser dependency.
- Production MySQL mutations require `FIDEO_API_TOKEN` in the host env. Browser
  requests include `Authorization: Bearer <token>` only when `config.js` sets
  `window.FIDEO_CONFIG.pocketbaseToken`; if the host token is missing, POST
  requests fail closed with 503.
- Mutating snapshot posts may send `expectedVersion`; stale writes return HTTP
  409 with the current server `version` and `snapshotRecordId`.
- Repeated posts with the same `actionId` or `idempotencyKey` replay the stored
  response without creating a second version or event.
- The AI adapter defaults to Kilo Code with `kilo/stepfun/step-3.7-flash:free`
  and also accepts Gemini Free or an OmniRoute StepFun 3.7 gateway through
  `window.FIDEO_CONFIG.aiProvider`, `aiModel` and `aiVariant`. The codex-goal
  path remains configurable, so missing local engines produce dry-run receipts
  instead of hard failing.
- Live local Kilo execution uses `scripts/kilo-bridge.mjs` on `127.0.0.1:8765`.
  Start it with `FIDEO_KILO_BRIDGE_TOKEN` or use the generated token it prints,
  then store that token in browser localStorage as `FIDEO_AI_BRIDGE_TOKEN`. The
  public page never starts `kilo.exe` on load; `AI plan` calls the bridge only
  after the local token is present.
- Reusable V-side contracts live in `C:\git\v_projects\lib\fideo_core`.
