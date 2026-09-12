# Getting started

ModelCommons is a pre-alpha source release. Start with the canonical text path;
public npm publishing and general official-provider-SDK support are not complete.

## Run the checks

Use Node.js 22, npm, and a checkout of this repository:

```sh
npm ci
npm run lint
npm run typecheck
npm test
```

The committed lockfile is the dependency baseline. Do not regenerate it merely to
install the project. Installation may fetch verified llama.rn engine artifacts;
model weights are separate, explicit downloads inside the Hub.

For checks that do not load native modules, `npm ci --ignore-scripts` avoids
native install hooks. Native builds require the normal install and the pinned
payload checks. CI runs JavaScript/TypeScript checks, not device acceptance.

## Build the Hub

Expo Go does not include ModelCommons' custom native modules. Use an Expo native
development build or EAS. Local iOS builds need macOS and Xcode; local Android
builds need a JDK and Android SDK/NDK.

```sh
npm run android
# On macOS:
npm run ios
```

For an EAS build from a fork, first configure `app.config.ts` for your own Expo
account/project and application identifiers. The checked-in `owner`, EAS project
UUID, bundle identifier, and Android package identify the official project;
they are public identifiers, not credentials or permission to use its signing.
Create/link your own EAS project and provisioning before running:

```sh
eas build --platform ios --profile development
eas build --platform android --profile development
```

Default iOS storage is `Documents/ModelCommons`, exposed through Files. No App
Group is required for the demonstrated Files flow. `.env.example` documents
optional configuration; do not enable its example group identifier unless you
have provisioned a real group for the participating apps.

`MODELCOMMONS_REPORT_URL` is optional. Omit it for a build without output reporting.
If you operate a receiver, configure your own public HTTPS URL and privacy policy;
never embed a token or other credential in that URL.

## Try the iOS shared-file flow

1. Install ModelCommons and a compatible client as native apps.
2. Download a small compatible GGUF through ModelCommons' Models screen.
3. In the client, select shared-model mode and use the Files folder picker to
   choose the `ModelCommons` folder containing `protocol.json` and `registry.json`.
4. Choose the installed model and generate a synthetic text response offline.

The [verified Sales & Pricing scenario](verification/ios-shared-models.md) records
one successful run. Sales & Pricing Mobile is a separate application; its source
or binary is not bundled here and is not required to contribute to ModelCommons.
For a new client, use the integration boundaries below.

## Build packages for your own client

Workspace manifests expose source to Metro/TypeScript. The local pack command
compiles the nine consumer packages to JavaScript plus declarations and creates
archives and `provenance.json` in an explicit `vendor/modelcommons` destination:

```sh
npm run packages:pack-local -- ../my-client/vendor/modelcommons
```

The destination must end in `vendor/modelcommons`. Run against a client directory
you own. Install the generated archives together in that client, using the actual
relative paths in its package manifest. Matching archive provenance matters:
pre-alpha archives can share version `0.1.0` while containing different source.
The Hub-only inference host is intentionally excluded from consumer archives.
This command does not publish to npm or install into the client.

See [`dual-local.ts`](../examples/reference-client/dual-local.ts) for private and
shared composition, and the [iOS platform guide](platforms/ios.md) for the native
plugin and shared reader. A consuming app provides its own trusted model policy,
explicit transport choice, and cancellation/identity lifecycle. Shared mode uses
the read-only store; it must not silently import or download a private copy.

On iOS, the client includes its own optional `llama.rn` runtime. On Android,
centralized mode uses the Binder connector, explicit installed-signing pins and
Hub authorization; follow the [Android acceptance guide](verification/android-binder-inference-owner-run.md).

## Record results

Use synthetic prompts and the [device matrix](verification/physical-devices.md).
Record exact device/OS, build identities, model/revision, selected route, outcome,
and cleanup. Keep model weights, credentials, device identifiers, raw bookmarks,
and business data out of Git and public issues.
