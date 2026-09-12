# Privacy

ModelCommons is designed for local, user-controlled inference. Local operation
does not by itself guarantee privacy; storage, logs, transports, client
authorization, and tool hosts all remain part of the privacy boundary.

## Product principles

- ModelCommons never silently sends a local request to a cloud provider.
- An application chooses whether to fall back to a network provider after a
  typed local-unavailable error.
- Diagnostics and benchmarks must not contain prompts, responses, chats, user
  messages, customer objects, medical data, or tool payload contents.
- Model-generated tool calls are returned to the application. ModelCommons does
  not execute them automatically or grant filesystem/network access.
- The current Hub renders chat output as inert selectable text. It does not
  interpret Markdown, fetch model-supplied remote images, or activate links.
  Downstream applications remain responsible for their own renderers.
- The user controls model installation, license acceptance, client
  authorization, storage use, deletion, and experimental profiles.

## Data that may be stored

The current host/native components may contain:

- model IDs, revisions, relative artifact paths, checksums, sources, licenses,
  lifecycle state, install timestamps, and license-acceptance tuples containing
  model ID/revision, license ID/URL, and acceptance time;
- Android package names, user IDs, SHA-256 signing-certificate identities,
  requested/approved scopes, pending/approval timestamps, and revocation state;
- security-scoped bookmark data and non-secret connection metadata in the
  consuming iOS application's private storage; and
- selected model/profile/context/output preferences and at most 20 coarse
  runtime-failure records containing model ID, profile ID, category, and time.
  The full device profile is not persisted; and
- an adult-notice boolean acknowledgement, acknowledgement-policy version, and
  acknowledgement time. ModelCommons does not request or store a date of birth,
  identity document, name, or account for this disclosure/access gate.

Device benchmark schemas exist, but the repository currently has no benchmark
collector/writer. Any future collection remains subject to the minimization rule
below.

It must not contain conversation text or tool payloads as diagnostics. A Hub
chat feature may store conversation history only as a separate, explicit user
feature with clear retention and deletion controls.

## Data leaving the device

Model downloads contact the source URL declared by a manifest. That request can
reveal network metadata such as IP address and user agent to the model host.
Gated sources may require the user to authenticate under the model publisher's
terms.

A completed assistant response has a voluntary **Report output** action. Only
after the user selects a category, reviews an inert preview, optionally adds a
note, and presses **Send report**, the app sends the selected response (limited
visibly to 12,000 characters), truncation flag, category, optional note, model
ID and immutable revision, app/runtime version, platform, locale, a random
one-report UUID, and client time to the configured operator-controlled receiver.
It does not send the prompt, other conversation messages, conversation
title/session ID, identity/contact or location data, advertising/persistent
device ID, diagnostics/device profile, memory data, stack traces, exception
text, paths, credentials, or attachments. Failed reports are neither persisted
nor queued; an unchanged manual retry reuses its report UUID for receiver
idempotency. Editing the report creates a new UUID. Ordinary chats make no
report request.

`MODELCOMMONS_REPORT_URL` is optional. When it is absent, reporting is not
configured and no report can be sent; all other ModelCommons functionality
continues normally. ModelCommons never selects a fallback receiver.

The published ModelCommons Privacy Policy is available at
<https://uva.solutions/index.php?option=com_content&view=article&id=80&catid=8&lang=en&Itemid=128>.
The Uva-operated receiver used by official distributions defaults to 180-day
report-content retention and allows earlier administrator deletion. Server/proxy
access logs may still contain network metadata such as IP address and request
time; they must not log POST bodies and remain governed by Uva Solutions
infrastructure retention. Other distributors are responsible for documenting
their receiver operator, policy, and retention.

Provider compatibility through an injected ModelCommons fetch is intended to be
offline and must not perform DNS or network fallback. The current Hub has no
LAN, Flask, Gradio, or cloud inference mode. If a downstream application adds a
remote provider, it is a separate, explicit product mode with its own disclosure
and policy; prompts and attachments leave the device when that application uses
it.

## Diagnostics and benchmarks

Allowed fields include:

- model ID/revision;
- client app ID;
- runtime and protocol version;
- selected profile and accelerator class;
- context/batch/ubatch settings;
- initialization and generation timing;
- status and sanitized failure category;
- device capability ranges.

Free-form native exception messages should be normalized before persistence.
Diagnostics must not capture request bodies, response bodies, content-derived
filenames, tool arguments/results, or access tokens.

## Platform sharing

- Android Hub execution can keep model artifacts and inference inside the Hub
  process. Authorized applications still control their own prompts and tools.
- iOS App Groups share artifacts only between apps from the same developer team.
- iOS open-ecosystem sharing uses a user-selected file/directory. The consuming
  app obtains file access and runs its own optional runtime; ModelCommons cannot
  prevent that authorized app from processing data it receives.

## Current residual gaps

The donor chat/provider cleanup has landed: Hub chats are memory-only, the old
LAN/cloud/Flask/Kaggle modes and API-key settings are gone, and the diagnostic
logger is disabled by default, user-controlled, and accepts an explicit metadata
allowlist rather than prompts or responses. Those are source-code properties,
not a completed privacy assessment.

Residual gaps as of 2026-09-12 are:

- Hub runtime preferences, sanitized runtime-failure history, and authorization
  records are persisted in AsyncStorage. Rehydration now validates/bounds
  identities and authorization records, clamps numeric settings, and drops
  malformed failure records; Android approvals and iOS connection/bookmark
  records also use platform app-private stores. Their backup/data-protection
  behavior, retention periods, reconciliation, and upgrade/reinstall handling
  have not been audited on signed devices.
- Revocation/disconnect and model deletion exist, but there is no single
  privacy-reset/export flow. Revoked-client audit records, registry inventory,
  and model-license acceptances can remain after artifact deletion and have no
  documented expiration or hard-delete UI.
- The sanitized logger has no analytics collector and its persisted toggle now
  gates all current console events, but production console/crash capture and
  every future call site still require review to ensure allowlisted string
  fields never contain user content.
- Android caller authorization, iOS bookmark/scope lifetime, platform backups,
  protected-data states, and cross-process file replacement have no
  comprehensive physical-device privacy evidence. The iOS connector now holds
  `NSFileCoordinator` reads through the model-lease lifetime, but coordination
  remains cooperative and the loader opens a pathname. The
  [owner-verified offline Files run](docs/verification/ios-shared-models.md)
  establishes functional reuse, not these privacy/lifecycle properties.
- Any configured voluntary receiver still requires deployment,
  published-policy alignment, and physical-device verification. Community builds
  may omit it and operate normally without reporting. Reporting does not prevent
  or moderate prohibited model output and does not alone complete store-policy
  compliance.

Do not use the prototype with confidential, medical, regulated, or production
customer data until those controls and the physical-device matrix are reviewed.

## Deletion

The public implementation must provide explicit controls to delete models,
partial downloads, manifests, benchmarks, client authorization, bookmarks,
license/audit records subject to documented retention, and any optional chat
history. Deleting or replacing an artifact must first release all runtime
contexts that may mmap it. Cross-app iOS clients retain their own bookmarks and
must revoke/delete them independently.

Privacy-impacting changes should update this document and the
[threat model](docs/security/threat-model.md).
