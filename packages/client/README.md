# @modelcommons/client

Provider-neutral ModelCommons client, session and transport interfaces.
Applications supply a transport. `InProcessTransport` can adapt a host in the
same process.

For the public developer preview, install `@modelcommons/client@experimental`.
It resolves the matching `@modelcommons/protocol` prerelease. Use Node.js 20.19
or later. ESM, CommonJS and TypeScript declarations are included.

```ts
import { ModelCommons, InProcessTransport } from '@modelcommons/client';
import type { ModelCommonsTransport } from '@modelcommons/client';
```

See the [reference client](https://github.com/uvasolutions-sp-z-oo/ModelCommons/tree/HEAD/examples/reference-client)
for transport and session usage. This package installs no Expo or inference
runtime. Preview APIs may change. The included license is MIT.
