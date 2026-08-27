# Partidito integration

Target application: Expo 54 / React Native 0.81.x with Expo Router and no current
`llama.rn` dependency. ModelCommons does not modify that application in this
repository.

## Dependency rule

Partidito should install only the pure packages it uses:

```text
@modelcommons/protocol
@modelcommons/client
```

Neither package depends on llama.rn today. Do not add `llama.rn`, a native runtime
plugin, model weights, or native build settings transitively. Native capability
must remain a separate, explicit application choice.

## Intended platform behavior

| Platform/configuration | Preferred path | Honest unavailable behavior |
|---|---|---|
| Android, approved hub installed | optional Android hub transport | show authorization/discovery flow, then local AI |
| Android, no hub or approval | none | `HUB_NOT_FOUND` / `PERMISSION_REQUIRED`; disable local AI cleanly |
| iOS, no optional runtime/transport | none | `TRANSPORT_UNAVAILABLE` (or a platform factory's `UNSUPPORTED_PLATFORM` / `RUNTIME_UNAVAILABLE`); no hidden cloud request |
| iOS, app explicitly ships runtime | optional in-process transport | local inference with Partidito's own memory/context |
| Web | none today | `UNSUPPORTED_PLATFORM` |

Optional Android/iOS connector code now exists, but Android capabilities
deliberately report `RUNTIME_NOT_READY`, generation terminates with canonical
`RUNTIME_UNAVAILABLE` after an ordered `response.started`, and centralized
inference is not implemented. Neither platform has physical-device evidence.
The table is the desired product behavior only after the relevant connector and
execution path passes device/security verification.

## Router-safe composition

Create/connect once in a root provider outside route screens. Screens consume a
small state machine and should not perform native module imports themselves:

```text
checking -> available
         -> permission-required
         -> unavailable
         -> failed
```

The client already returns a safe unavailable transport when none is configured,
so a JS-only installation can render normally:

```ts
import { ModelCommons, createClientConfiguration } from '@modelcommons/client';

const configuration = createClientConfiguration({
  id: 'partidito-mobile',
  displayName: 'Partidito',
  capabilities: ['text'],
  fallback: 'unavailable',
  profile: 'safe',
  maxOutput: 256,
  transports: ['hub-service'],
});

const client = await ModelCommons.connect({ clientConfiguration: configuration });
const availability = await client.getAvailability();
```

Without a registered transport, the last line reports unavailable; it does not
touch the network. When an Android connector exists, configure its factory in an
Android-specific composition module. Use an optional native-module lookup so an
iOS/web bundle without the connector does not fail during import.

`access.transports` allows the active path; it is not a preference-order broker.
Partidito must choose one optional transport in platform composition and report
its availability rather than expecting the client to probe multiple factories.

## Product boundary

Start with a narrow, non-authoritative feature such as an explanation or local
summary. Do not allow generated content to change match results, participants,
payments, messages, schedules, moderation state, or notifications without
normal application validation and an explicit user action.

Availability messaging should say which condition applies: hub not installed,
approval required, model not ready, runtime unavailable, or unsupported on this
configuration. Do not suggest that installing the JS client alone enables local
inference.

## Verification before adoption

- Prove a plain Partidito install contains no llama.rn/native runtime artifact.
- Prove every unsupported platform imports, starts, and navigates normally.
- On Android, test no hub, incompatible protocol, denied/revoked approval,
  certificate change, hub restart, cancellation, and client death.
- If iOS runtime is opted in, run the full local-runtime memory and bookmark/App
  Group matrix; the app owns its context and RAM.
- Confirm prompts/responses never enter navigation params, analytics, crash
  breadcrumbs, or logs.
