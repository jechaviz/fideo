# FideoVue

FideoVue is the Vue 3/SFC port of `C:\git\customers\fideo`.

This repository is intentionally static-first:

- Vue 3 is vendored as a local browser file in `vendor/vue.global.prod.js`.
- UnoCSS runtime is vendored as local runtime files.
- Components stay as browser-loaded `.vue` SFC files through `src/platform/sfcLoader.js`.
- Domain logic lives outside components and talks through explicit ports.
- Every source file must stay below 600 lines.

## Run

Serve the folder with any static HTTP server and open the printed URL.

```powershell
cd C:\git\websites\fideovue
python -m http.server 4173
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
```

The verifier checks:

- required vendor runtime files exist
- source files stay under 600 lines
- no remote script is used in production entrypoint
- required Fideo/Veeper/AI adapters are present
- all SFC files expose template and script blocks

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
              -> PocketBase HTTP contract
              -> Veeper WhatsApp/comms contract
              -> codex-goal AI engine contract
```

The first slice ports the operational cockpit shell and the exception loop
contract. The remaining Fideo screens will be migrated domain by domain without
allowing component or backend-equivalent files to grow past the line limit.

## Integration Notes

- Veeper is expected at `http://127.0.0.1:8097` by default.
- Mutating Veeper calls include `X-Veeper-Client: veeper-ui`, matching Veeper's
  anti-CSRF browser contract.
- `C:\git\codex\codex-goal` is represented as a configurable AI engine path.
  The path is currently absent locally, so this slice keeps an adapter contract
  and dry-run evidence instead of hard failing.
- Reusable V-side contracts live in `C:\git\v_projects\lib\fideo_core`.

