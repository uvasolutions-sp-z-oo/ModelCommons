# Public-preview preparation record

Prepared **2026-09-12** against base commit `6ac987d`, with the working-tree
changes described here. This prepares a source developer preview; it does not
record a GitHub visibility change, a published npm release, or a production audit.

## Public scope

The project is described as pre-alpha and experimental. Its lead milestone is
the [owner-verified iOS Files run](ios-shared-models.md) on a physical iPhone SE:
ModelCommons stores the model and Sales & Pricing Mobile executes against that
shared file offline. No App Group, cross-team, Android Binder, shared-memory or
all-device success is inferred from that test.

The current README, platform/integration guides, roadmap and evidence page agree
on this scope. Historical implementation prompts/handoffs are labeled as such.
Missing build/model/OS metadata and screenshots are explicitly recorded.

## Checks completed locally

| Check | Result |
| --- | --- |
| `npm run lint` | Passed |
| `npm run typecheck` | Passed |
| `npm test` | 32 files, 214 tests passed |
| Local consumer pack | All nine archives built |
| Archive inspection | SHA-256 matched provenance; compiled entry points, declarations and LICENSE present; no model weights/signing files/generated native build folders found |
| Node consumer smoke | All eight non-native package entry points loaded from the extracted consumer layout |
| Android CPU host, earlier in this session | All 194 compile/link steps passed with NDK 27.0.12077973, API 24, arm64-v8a, RelWithDebInfo |
| Lockfile inventory | CycloneDX 1.5, 1,007 components; see the third-party ledger for limits |
| Local Git history credential-pattern scan | 16 commits / 379 distinct blobs; no apparent real credentials found; two credential-URL matches were intentional invalid-URL test fixtures |

The history scan examined locally reachable Git objects and common token/private
key/credential-URL patterns. It is not a dedicated secret-scanner certification
and does not cover unreachable objects, remote-only refs, GitHub attachments,
Actions artifacts, or all possible credential formats. No model weights, signing
material or non-example environment files were found in the scanned history paths.
The checked-in EAS project UUID, Expo owner and app IDs are public identifiers.

The first full test run exposed invalid synthetic artifact-size metadata, a
disk-space test affected by an unrelated context warning, and a provider test
that incorrectly expected Anthropic streaming without early usage. The fixtures
and expectations were corrected; no application runtime behavior was changed by
those corrections. Anthropic's current streaming limitation is documented rather
than hidden behind fabricated usage data.

## Contributor setup

The source-check workflow runs install without native lifecycle hooks, lint,
typecheck, tests and local packing on Node.js 22, with read-only repository
permissions. It needs its first hosted run after the changes are pushed; local
success is not a recorded GitHub Actions result. PR and bug-report templates ask
for reproducible, sanitized evidence.

The getting-started guide documents fork-owned EAS configuration, native build
requirements, Files sharing, and local package consumption. Optional App Group
configuration is commented out in `.env.example`.

## Before changing GitHub visibility

- Review and commit/push the final preparation diff, including the Android fix
  if it has not already been committed. The work recorded here did not stage,
  commit, push, publish, or change visibility.
- Confirm private vulnerability reporting is enabled and reachable at the
  channel linked in `SECURITY.md`, plus the desired Actions and contribution
  settings. GitHub CLI returned HTTP 401 during this preparation, so remote
  visibility/settings could not be verified through it.
- Complete the owner's existing donor/asset provenance review described in
  `THIRD-PARTY-NOTICES.md`. The preserved MIT copyright and generated/template
  assets were not relicensed by this preparation.

The exact iOS model/build metadata and sanitized attachments can strengthen the
evidence record as they become available. Android device verification and broader
iOS acceptance remain roadmap work rather than claims of this source preview.

LinkedIn, X, and the launch article are separate steps; no announcement was sent.
