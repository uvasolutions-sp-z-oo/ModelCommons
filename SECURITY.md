# Security Policy

## Supported versions

ModelCommons has not published a stable release. The current development branch
receives security fixes, but no production support or response-time guarantee is
offered yet.

## Reporting a vulnerability

Use the repository's **GitHub Security Advisory** / private vulnerability
reporting workflow. Do not disclose a suspected vulnerability in a public issue,
discussion, pull request, chat transcript, or provider fixture.

Before publication, the owner must confirm that private vulnerability reporting
is enabled and visible, or publish an equivalent monitored private contact. This
document intentionally does not invent an unverified security email address.

Include only the minimum information needed to reproduce the issue:

- affected commit or package version;
- platform and OS version;
- transport/runtime involved;
- sanitized reproduction steps;
- impact and preconditions;
- whether credentials, prompts, responses, model artifacts, or user files may
  have been exposed.

Do not include real conversations, medical data, customer records, API keys,
signing certificates, or proprietary model files. Use synthetic fixtures.

## Security boundaries

ModelCommons treats all of the following as untrusted:

- client configuration and aliases;
- model manifests, catalogs, filenames, URLs, and checksums;
- provider-shaped requests and stream fragments;
- Android callers and client-supplied package IDs;
- iOS bookmarks, selected roots, paths, and symlinks;
- model-generated tool calls and arguments;
- downloaded model artifacts.

Required controls include:

- fail-closed protocol and schema validation;
- relative-path confinement and traversal rejection;
- HTTPS artifact URLs, except explicitly enabled loopback development paths;
- SHA-256 verification when integrity metadata is present;
- immutable READY artifacts and atomic registry publication;
- explicit model-license acceptance where required;
- stable, machine-readable errors;
- no implicit network fallback;
- no automatic tool execution;
- inert text rendering for current Hub model output, with no model-triggered
  Markdown links or remote image fetches;
- prompt-free diagnostics.

### Android

An exported Hub service must authorize every AIDL entry using the Binder calling
UID captured on the incoming transaction. The service must resolve the complete
package set for that UID, validate user-approved authorization and signing
identity, reject ambiguous shared UIDs unless policy covers every package, and
fail closed. A client-provided application ID is never proof of identity.

Large prompts and model data must not be placed in Binder transactions. Request
sizes are capped, model access is by stable model ID, and streaming uses bounded
callbacks. Client death must cancel and release sessions.

### iOS

App Groups are limited to apps entitled by the same developer team. Unrelated
apps use explicit document-picker grants and security-scoped bookmarks. Paths
must remain under the granted root, bookmarks may be stale or revoked, and every
successful security-scope acquisition must remain alive for the complete model
context/mmap lifetime. Release the inference context before ending access.

### Provider compatibility

The synthetic `https://modelcommons.local` origin is not an authentication
mechanism. Injected fetch implementations must match that exact origin, route
only documented paths, and never delegate unmatched requests to global/network
fetch. Official SDK dummy API keys satisfy constructors only; OS-level client
authorization remains mandatory. SDK option helpers set
`dangerouslyAllowBrowser: true` solely for that dummy, origin-locked local fetch,
disable retries, and set `logLevel: 'off'`; never reuse those options with a real
provider credential or network transport.

## Known prototype limitations

Hub chats are now memory-only; the donor cloud/provider settings and full-prompt
logging paths have been removed. Hub preferences and client approvals, native
authorization/bookmark records, model inventory, and license acceptances still
persist without a complete retention/erasure/backup review. Hub state rehydration
validates/bounds the stored settings, client records, and failure history, but it
does not replace platform-store reconciliation or signed-device review. The
sanitized logger and every future call site also require release audit. Do not
use this snapshot with sensitive or regulated data.

Android Binder, iOS shared-file access, provider adapters, runtime cancellation,
and artifact migration must be reviewed and physically tested before a public
security claim is made. See [the threat model](docs/security/threat-model.md).
