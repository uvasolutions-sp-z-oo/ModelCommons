# ModelCommons npm developer preview

The first release is a pre-alpha preview of four JavaScript packages. The
verification workflow builds and uploads candidate archives for owner review.
Publication requires a separate owner decision and npm approval.

| Package | First preview version | Status |
| --- | --- | --- |
| `@modelcommons/protocol` | `0.1.0-preview.0` | Core candidate and first in release order |
| `@modelcommons/client` | `0.1.0-preview.0` | Core candidate, depends on protocol |
| `@modelcommons/device-profile` | `0.1.0-preview.0` | Core candidate, depends on protocol |
| `@modelcommons/model-store` | `0.2.0-preview.0` | Core candidate, depends on protocol |
| `@modelcommons/provider-openai`, `@modelcommons/provider-anthropic` | Deferred | Confirm adapter compatibility claims, trademark wording and release scope |
| `@modelcommons/runtime-llama-rn`, `@modelcommons/native`, `@modelcommons/embedded` | Deferred | Complete native dependency, payload/license and physical-device acceptance |
| `@modelcommons/hub`, `@modelcommons/inference-host` | Private | Hub application and Hub-only inference host |

## Packaging audit

- **Mechanical.** Workspace manifests resolve source for Metro and remain
  private. The preview packer stages compiled CommonJS, named ESM entry points
  backed by the same runtime instance, NodeNext declarations for each format,
  a package README and the MIT license. It preserves the model-store
  `/registry` and `/catalog` subpaths. Package build checks reject undeclared
  imports, cross-package relative imports and imports of Hub code. The emitted
  preview includes model catalog metadata and no model weights.
- **Resolution.** The three core dependents pin the matching protocol prerelease
  because ordinary ranges for stable versions can exclude prereleases. The wire
  protocol version remains `0.1.0`. The local archives keep their original
  versions, dependency specs and schema-1 provenance. All nine also remain
  installable together as npm tarball dependencies. None of the distributable
  packages requires the Hub or the private inference host.
- **Metadata.** Preview manifests set public access and the `experimental`
  tag. Package URLs use the public Uva Solutions repository. The checkout's
  `origin` is `asierraserna/ModelCommons`; the owner must confirm the release
  workflow will run in the canonical Uva Solutions repository before configuring
  OIDC. The workflow identity and manifest repository URL must agree.
- **Native.** The connector ships Expo module metadata, its config plugin,
  the Podspec, Swift/Kotlin/AIDL sources and the existing payload/descriptor
  scripts. The Podspec points to the canonical repository and reserves the
  future source tag `modelcommons-native-v<version>`. Expo uses the local Podspec
  in the installed package. The reviewed setup uses Expo SDK 54, React Native
  0.81 and `llama.rn@0.12.9`; native consumers using inference must install the
  exact runtime and follow the existing payload and descriptor instructions.
  The current iOS device evidence covers the owner's recorded iPhone SE
  Files scenario. Android two-app acceptance, broader iOS coverage, and
  verification of the final registry-installed native artifacts remain open.
  See the [device evidence matrix](verification/physical-devices.md).
- **Security and licensing.** The owner must confirm donor copyright and
  contribution rights, review the actual archive contents and notices, and
  confirm the private vulnerability reporting route is monitored. Review
  separate model terms before redistributing any models. Native releases
  also require review of the pinned downloadable binaries and embedded
  llama.cpp notices, plus signed-app acceptance for the applicable device paths.
  See the [notices ledger](../THIRD-PARTY-NOTICES.md) and [security policy](../SECURITY.md).

## Repeat verification

Use Node 22.14 or later with an npm CLI supporting the lockfile. Use the current
npm CLI for signing and provenance verification. On PowerShell installations
where `npm.ps1` is disabled, use `npm.cmd` for the commands below.
The managed Windows verification used Node's `--use-system-ca` option to trust
the system certificate store while keeping TLS verification enabled.

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run lint
npm run typecheck
npm test
npm run packages:verify-preview -- dist/npm-preview
```

This runs real tarball installs outside the workspace, exercises CJS and named
ESM imports and TypeScript NodeNext and bundler resolution, checks tar contents
and hashes, and tests package-only installs against a temporary read-only
loopback registry backed by the candidate bytes. The core lockfile must contain
only the expected core packages. The registry fixture has no write route and
serves only the four exact candidate versions. The audit queries the live public
npm advisory API with the fixture's installed core dependency graph. Known
advisories are a separate check from archive contents and runtime behavior.
Source and local archive verification skip lifecycle scripts for the pinned
native dependency, whose postinstall can download native payloads. The core
install uses normal lifecycle handling and is required to pass offline from
tarballs with a clean dependency cache.

The nine-package fixture uses npm to install the local archives and pinned
mobile peers in a separate temporary consumer, resolves the Expo plugin and
Apple/Android autolinking, validates the descriptor patch on the installed
pinned source, and runs the existing lockfile and provenance verifier. For a
local consumer you own, build its archives with:

```sh
npm run packages:pack-local -- ../my-client/vendor/modelcommons
```

`Source checks` on GitHub runs the same verification and uploads the four
candidate archives and `provenance.json` for the run's commit. Download that
artifact for the owner review. Keep verified archives with the release record.
Once all four exact versions are visible on public npm, run this against the
**same archive set** from its source revision, or select `verify_published` in
the workflow at that revision:

```sh
npm run packages:verify-preview -- --published dist/npm-preview
```

This uses the public registry for a fresh install and `npm ci`, compares remote
integrities with the verified archives and runs real advisory and signature
checks. It requires the candidate versions to be available on public npm.

## Verification record, 18 November 2026

- Clean root `npm ci` from the committed lockfile plus the packaging metadata
  changes, Expo lint, TypeScript and all 236 tests passed on Node 22.23.1.
  The Hub's Expo prebuild configuration resolved for both platforms.
- Four archive inspections, offline tarball installation and `npm ci`,
  CommonJS and ESM imports, TypeScript declarations, and cold registry fixture
  installs passed. All four installed individually through the fixture. The
  live npm advisory endpoint reported zero vulnerabilities for the core graph.
  npm 10.9.8 and 12.0.1 produced matching preview archive SHA-256 hashes.
- The nine-archive fixture installed with npm, discovered the Expo plugin and
  Apple/Android modules, applied the pinned Android descriptor source patch,
  and passed the existing archive, provenance, lockfile and installed-hook
  checks.
- The read-only registry check returned HTTP 404 for all nine package names.
  The npm organization page returned HTTP 403 to the anonymous request. The
  status of the organization and rights to use `@modelcommons` require an
  authenticated owner check.
- Updating the transitive `shell-quote` lock entry to `1.12.0` cleared the
  critical finding without changing Expo, React Native or llama.rn versions.
  A fresh Hub production-lockfile audit reports 54 remaining findings
  (39 high, 15 moderate). Review build-tool exposure before artifact approvals
  and triage the applicable findings before releasing native or Hub artifacts.
  Reproduce with `npm audit --omit=dev --package-lock-only`.
  [shell-quote advisory](https://github.com/advisories/GHSA-pqg4-j6r4-53mv).
- The public npm smoke test returned E404 for an unpublished preview version.
  Run it once the owner's approved packages are available. The GitHub-hosted
  job itself awaits an owner-run workflow. Physical builds, code signing and
  on-device acceptance require the native toolchains, accounts and devices.

## Owner authorization and npm setup

1. Sign in to npm with a company-authorized account and enable 2FA in
   **Account → Two-Factor Authentication**. If the company already owns
   `modelcommons`, verify your owner role and the release maintainers in its
   **Members** and **Teams** settings. Otherwise use **profile menu → Add an
   Organization**, enter `modelcommons` and select **Unlimited public
   packages** if npm accepts the name. Keep package write access limited to
   release maintainers and require organization 2FA where available. If the
   scope is controlled by someone else, resolve ownership or explicitly
   choose a new company-controlled scope and rerun package verification.
   [npm organization setup](https://docs.npmjs.com/creating-an-organization/).
2. Approve distribution rights and the reporting channel. Review the candidate
   commit, archive SHA-256 values in `provenance.json`, release notes, and npm
   availability of each exact name/version. Keep release notes with the
   approved source revision and state the supported APIs, preview status, and
   dependency order. Bump the preview versions in
   [the release version map](../scripts/package-artifacts.cjs) if a version was
   used or its content changes after approval. Rebuild and reapprove the
   dependent archives if the protocol version changes.
3. **Only after explicit release authorization**, use npm 11.15 or later and
   authenticate interactively with `npm login --registry=https://registry.npmjs.org`
   and confirm the account with `npm whoami --registry=https://registry.npmjs.org`.
   With npm's staged publishing, an initial submission for a new name can create
   a publicly visible `0.0.0-stage` placeholder. Stage the exact verified
   tarballs with the commands below, beginning with protocol. Review each
   staged package's version, tag and downloaded archive hash with
   `npm stage view <stage-id>` and `npm stage download <stage-id>`. Approve
   protocol with `npm stage approve <stage-id>` and 2FA, and verify that exact
   version resolves on npm before staging and approving the three dependents.
   Run the public verification and confirm `experimental` via
   `npm dist-tag ls <package>` for each package. [npm staged publishing](https://docs.npmjs.com/staged-publishing/).

```sh
npm stage publish ./dist/npm-preview/modelcommons-protocol-0.1.0-preview.0.tgz --access public --tag experimental --registry=https://registry.npmjs.org
```

After approving protocol in npm's **Staged Packages** tab, confirm the exact
protocol version resolves before running the dependent commands.

```sh
npm view @modelcommons/protocol@0.1.0-preview.0 version --registry=https://registry.npmjs.org
```

```sh
npm stage publish ./dist/npm-preview/modelcommons-client-0.1.0-preview.0.tgz --access public --tag experimental --registry=https://registry.npmjs.org
npm stage publish ./dist/npm-preview/modelcommons-device-profile-0.1.0-preview.0.tgz --access public --tag experimental --registry=https://registry.npmjs.org
npm stage publish ./dist/npm-preview/modelcommons-model-store-0.2.0-preview.0.tgz --access public --tag experimental --registry=https://registry.npmjs.org
```

### Trusted publishing for subsequent previews

After the package settings are available, create a dedicated
`.github/workflows/npm-release.yml` only after owner approval. Use a
GitHub-hosted runner, `workflow_dispatch`, a protected release ref,
concurrency for releases, and a GitHub environment named `npm-release`.
Configure allowed release refs and required reviewers with self-review
disabled where the GitHub plan permits. The release job should consume the
verified artifact for the approved commit and check its hashes. Give only
that job `id-token: write` and `contents: read`. Pin actions to full SHAs,
disable package-manager caching for release builds, and keep install/test in
the verification job without publication credentials.

For each approved npm package, open **Settings → Trusted publishing → GitHub
Actions**. Enter organization `uvasolutions-sp-z-oo`, repository
`ModelCommons`, workflow filename `npm-release.yml` and environment
`npm-release`. Enable **Allow npm stage publish** alone. Keep npm's
interactive approval with 2FA, and after verifying the trusted publisher,
set publishing access to require 2FA and disallow tokens. Configure trust
when the next authorized staging run is ready, since new connections expire
if unused for two days. The future job stages the approved archives from
`protocol` to dependents in separate approval batches if the versions are
new. Use a currently supported npm CLI with Node 22.14+ and keep the
`experimental` tag explicit. For public repositories and public packages,
GitHub Actions trusted publishing generates provenance automatically.
The interactive bootstrap above does not generate this CI attestation.
[npm trusted publishing](https://docs.npmjs.com/trusted-publishers/).

## Sales & Pricing Mobile adoption and rollback

Keep the existing nine local archives until all nine names and their exact
compatible versions are registry-installable and the native acceptance gates
are complete. The two private Hub packages are outside that dependency set.

On an owner-controlled S&P change, record the working `package.json`, lockfile,
all nine archives and their `provenance.json`. Replace all nine `file:` specs
together with exact reviewed npm versions. Run `npm install --package-lock-only` and
`npm ci` in a clean checkout, and check the installed versions and registry
integrities with `npm ls --all` and `npm audit signatures`. Keep the pinned
Expo/RN/llama.rn versions and existing payload/descriptor hooks. Verify Expo
prebuild and autolinking, run consumer regression tests, and test the signed
iOS Files and Android SAF flows on physical devices before rolling out. See
the [S&P integration and acceptance references](integrations/sales-and-pricing.md).

If adoption fails, restore the prior manifest, lockfile and complete archive
set together. Run `npm ci` and the existing pinned payload/descriptor setup, then run
`node scripts/verify-local-consumer.cjs <S&P-root>` from ModelCommons and
rebuild the affected dev clients. Use a new immutable prerelease to fix a
public issue. The owner can move or remove the `experimental` tag and
deprecate an affected version with a rollback message.
