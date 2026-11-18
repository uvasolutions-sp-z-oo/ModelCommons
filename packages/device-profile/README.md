# @modelcommons/device-profile

Runtime profile selection from caller-supplied device capabilities, a model
manifest and runtime constraints. It can evaluate profiles without probing
hardware or loading a native module.

For the public developer preview, install
`@modelcommons/device-profile@experimental`. It resolves the matching
`@modelcommons/protocol` prerelease. Use Node.js 20.19 or later.

```ts
import {
  createRuntimeProfiles,
  resolveRuntimeProfile,
} from '@modelcommons/device-profile';
```

The package provides ESM, CommonJS and TypeScript declarations. Preview APIs
may change. The included license is MIT.
