# @modelcommons/model-store

Model registry, verified model storage and read-only store composition.
Applications supply the I/O ports and trusted model policy. Installing or
importing the package includes catalog metadata and downloads no models.

For the public developer preview, install `@modelcommons/model-store@experimental`.
It resolves the matching `@modelcommons/protocol` prerelease. Use Node.js 20.19
or later. ESM, CommonJS and TypeScript declarations are included.

```ts
import { createModelStore, createReadOnlyModelStore } from '@modelcommons/model-store';
import { createEmptyRegistry } from '@modelcommons/model-store/registry';
import { MODEL_CATALOG } from '@modelcommons/model-store/catalog';
```

Each model has its own terms and trust requirements. See the
[storage guide](https://github.com/uvasolutions-sp-z-oo/ModelCommons/blob/HEAD/docs/models/store.md)
before provisioning artifacts. Preview APIs may change. The included license is MIT.
