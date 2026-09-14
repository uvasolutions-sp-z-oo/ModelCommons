# Sales & Pricing Mobile integration

Sales & Pricing Mobile is the first owner-verified consumer of ModelCommons'
iOS shared-file flow. It is a separate application, not bundled in this repo.

## Verified flow

On a physical iPhone SE, the owner removed the consumer's private model,
downloaded the model in ModelCommons only, selected the shared store through
the Files folder picker, and generated a real response in airplane mode.
The app displayed `LOCAL_MODELCOMMONS`.

See the [iOS evidence record](../verification/ios-shared-models.md) for the
reported timings, missing device/build/model details, and untested cases.

```text
ModelCommons downloads and verifies GGUF
                  |
         Shared ModelCommons store
                  |
       User grants access through Files
                  |
Sales & Pricing Mobile: read-only store + embedded backend
                  |
          Canonical ModelCommons client
                  |
        Consumer-owned llama.rn runtime
                  |
              Offline text
```

Storage is owned by ModelCommons shared storage. Execution is owned by Sales &
Pricing Mobile. This flow does not run inference inside an iOS Hub service and
does not share runtime memory between applications.

## Explicit local modes

| Mode | Storage owner | Execution owner |
| --- | --- | --- |
| App-contained local | Sales & Pricing Mobile private store | Sales & Pricing Mobile |
| Shared with ModelCommons on iOS | User-selected ModelCommons store | Sales & Pricing Mobile |
| Shared with ModelCommons on Android | ModelCommons shared storage | Sales & Pricing Mobile; device acceptance pending |

A shared request must not call the private provisioning/import path or fall back
to another provider. Any separate cloud or LAN mode belongs to the consumer's
explicit product configuration, not the ModelCommons protocol.

## Reuse the integration pattern

Build matching local packages with the [getting-started guide](../getting-started.md).
The public [`dual-local.ts`](../../examples/reference-client/dual-local.ts) example
shows reusable composition without depending on Sales & Pricing source.

For iOS, the consumer combines `@modelcommons/native`, a read-only
`@modelcommons/model-store`, `@modelcommons/embedded`, the canonical client,
and its own pinned runtime. It supplies trusted catalog metadata and validates
a candidate connection before replacing a working one. Use the
[iOS contract](../platforms/ios.md) for plugin configuration and lease handling.

For Android, enable the consumer descriptor runtime and keep its provider and
inference service disabled. The user grants the ModelCommons SAF root; the same
read-only store and embedded/canonical composition then runs in the consumer.
Normal sharing needs neither Hub package visibility nor approval in Hub Clients.
See the [shared-files acceptance guide](../verification/android-shared-files-owner-run.md).

## Application responsibilities

- Keep business rules, authentication, customer data and output validation in
  the consumer application.
- Select one local route explicitly and request only its supported text subset.
- Cancel on backgrounding, identity changes and mode/model changes; suppress
  stale results and wait for context/lease cleanup before admitting new work.
- Release the runtime context before releasing shared-file access.
- Export only sanitized diagnostic metadata, never prompts, responses, customer
  records, raw filenames, bookmarks, tokens or container identifiers.

The successful demonstration used synthetic text through the canonical client.
It does not establish production pricing decisions, tool execution, structured
output guarantees, or official OpenAI/Anthropic SDK support. Those features need
separate application validation and device evidence.
