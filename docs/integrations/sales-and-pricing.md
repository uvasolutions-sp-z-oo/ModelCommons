# Sales & Pricing integration

Target application: Expo 54 / React Native 0.81.x enterprise mobile app with an
existing `llama.rn` dependency. ModelCommons does not modify that application in
this repository.

## Recommended vertical slice

Add a `ModelCommonsProvider` behind the application's existing provider
interface. Keep all customer/business semantics, tool implementations, and
output validation in Sales & Pricing. The provider should translate only at its
boundary:

```text
existing feature -> existing provider interface -> ModelCommonsProvider
                                              -> @modelcommons/client
                                              -> in-process llama.rn transport
```

Because the app already ships llama.rn, the first integration should be an
in-process transport. An Android hub transport can be a later configuration
choice; do not make the first release depend on cross-app service discovery.

The pure client/protocol/device-profile packages and a text-only
`@modelcommons/runtime-llama-rn` adapter exist today. Sales & Pricing still needs
application composition that exposes its verified store/model/profile through a
`ModelCommonsTransport`; the reference client demonstrates that glue, but it is
not yet an integration in the target application.

## Client configuration

Create the configuration once at the composition root, not in feature screens:

```ts
import { ModelCommons, createClientConfiguration } from '@modelcommons/client';

const config = createClientConfiguration({
  id: 'sales-and-pricing-mobile',
  displayName: 'Sales & Pricing',
  capabilities: ['text', 'tools', 'structured-output'],
  fallback: 'unavailable',
  profile: 'safe',
  context: 2048,
  maxOutput: 512,
  transports: ['local-runtime', 'hub-service'],
});

const client = await ModelCommons.connect({
  clientConfiguration: config,
  transportFactory: createSalesAndPricingTransport, // application-owned for now
});
```

The returned transport must declare the path it implements. The built-in
`InProcessTransport` defaults to `local-runtime`; a different custom transport
must expose its preference itself or in its availability result, or the caller
must set the matching `transportPreference` in `connect()`. Once the transport
is available, the client rejects conflicting declarations and a path absent
from `config.access.transports`.

That allowlist does not make `connect()` try `local-runtime` and then
`hub-service`: it classifies one supplied transport. Sales & Pricing must own any
user-visible transport choice/failover policy and instantiate exactly that path.
The client post-validates custom resolution, but the transport/runtime must still
apply the requested context during native initialization.

`fallback: 'unavailable'` is deliberate: offline AI being unavailable is safer
than silently sending customer data to a cloud provider. If the product offers a
cloud fallback, it must be a separate, explicit user/admin decision with its own
privacy policy.

## Provider behavior

For each operation:

1. call `getAvailability()` and return the application's existing unavailable
   state when not `AVAILABLE`;
2. create a session with the smallest capability set and context needed;
3. convert existing messages into canonical content blocks;
4. pass an `AbortSignal`, stream deltas if the current provider interface allows
   it, and always `release()` in `finally`;
5. validate every tool argument and structured result in Sales & Pricing; and
6. map typed ModelCommons errors into existing retry/UX categories without
   logging content.

Example session shape:

```ts
const session = await client.createSession({
  capabilities: ['text', 'tools', 'structured-output'],
  profile: 'safe',
});

try {
  const response = await session.generate({
    messages: [{
      role: 'user',
      content: [{ type: 'text', text: requestText }],
    }],
    tools: approvedToolSchemas,
    toolChoice: { type: 'auto' },
    responseFormat: {
      type: 'json_schema',
      name: 'pricing_result',
      schema: pricingResultSchema,
      strict: true,
      guarantee: runtimeGuarantee,
    },
    maxOutputTokens: 512,
  }, { signal });
  return validatePricingResult(response);
} finally {
  await session.release();
}
```

`runtimeGuarantee` must come from the resolved runtime capability. Never label a
prompt-only JSON request `grammar`. Reject the operation if the business flow
requires a stronger guarantee than the loaded model/runtime can provide.

## Tool boundary

Good tools are narrow reads/calculations such as looking up an authorized local
catalog row or calculating a formula from already-authorized inputs. The model
does not receive a database, filesystem, HTTP client, credential, or arbitrary
query executor.

For each generated call, the application verifies the exact tool name, JSON
schema, tenant/user authorization, record scope, numeric/locale/currency rules,
and output size. Price publication, customer communication, contractual quotes,
data mutation, and any external request require deterministic business rules and
appropriate human confirmation. Model text is never the source of record.

## Diagnostics and retention

Allow only coarse operational fields: actual model/revision, runtime/profile,
success/failure category, initialization/generation timing, and token counts.
Exclude prompts, completions, customer/account IDs, tool arguments/results,
quotes, SKUs, employee identity, and free-form metadata. Keep benchmarks local
unless an enterprise administrator explicitly configures collection.

## Rollout

1. Text-only, read-only internal feature using `safe` and a fixed model.
2. Structured output with application validation and golden compatibility cases.
3. Read-only tools with audited authorization and human-visible trace.
4. Streaming/cancellation and memory/thermal soak tests.
5. Optional Android hub mode after its native security matrix passes.

At every phase retain the current provider as an explicit user/admin-selected
option and a clean feature-disabled state. Do not silently change execution
location during a retry.
