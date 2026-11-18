# @modelcommons/protocol

Canonical ModelCommons request, response, device, model and error types, with
runtime validators. This package has no runtime dependencies.

For the public developer preview, install `@modelcommons/protocol@experimental`.
Use Node.js 20.19 or later. The package provides ESM, CommonJS and TypeScript
declarations.

```ts
import { PROTOCOL_VERSION, textContent } from '@modelcommons/protocol';
import type { ModelCommonsRequest } from '@modelcommons/protocol';

const content = textContent('Hello');
```

The npm package version and the wire `PROTOCOL_VERSION` are separate. See the
[protocol versioning guide](https://github.com/uvasolutions-sp-z-oo/ModelCommons/blob/HEAD/docs/protocol/versioning.md)
and the included MIT license. Preview APIs may change.
