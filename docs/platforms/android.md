# Android Hub service

Status, **2026-09-12**: Binder API 2, its client transport, and the optional
Hub-owned CPU inference host are implemented. The native `arm64-v8a` library
compiles and links locally. **Signed two-app inference and the device security/
lifecycle matrix remain unverified.** See the
[current acceptance guide](../verification/android-binder-inference-owner-run.md).

## Storage and execution ownership

Android's shared mode is designed to let ModelCommons own both model storage and
inference. An authorized consumer sends bounded canonical requests through Binder
and receives text events; it does not need a private copy of the GGUF or its own
loaded inference context for that route.

```text
Compatible app -> @modelcommons/native -> Binder API 2
                                            |
                                 ModelCommons service
                                            |
                              Process-wide coordinator
                                            |
                              Hub-only JNI/CPU worker
                                            |
                                 Verified model file
```

The Hub uses the same service/coordinator for its own Android chat. Its native
worker is built from the exact `llama.rn@0.12.9` patched source archive, with a
checked source inventory and separate symbol visibility. It does not call the
consumer's React-owned JSI runtime. The heavy host is optional and excluded from
the nine consumer package archives.

## Client and Hub configuration

Only the Hub enables `androidHubService: true` in the native config plugin.
Consumers declare explicit `androidHubPackages`, supply an installed signing
certificate SHA-256 pin, and obtain user approval in the Hub. Package IDs and
public certificate fingerprints are configuration, not authorization by themselves.

### Published official production Hub identity

The official production Android Hub identity published by the project maintainer
is:

| Field | Value |
| --- | --- |
| Package | `com.uvasolutions.modelcommons` |
| Signing certificate SHA-256 | `69:15:CE:DD:34:F3:C2:EC:F2:A6:82:89:AB:1E:A4:81:A3:2C:AD:E8:A7:CA:A8:A6:FB:E2:AF:93:08:42:70:54` |

This fingerprint is public identity data, not a secret or signing credential.
It identifies the official production signer only. Preview APKs, local debug
builds, and forks can use different certificates; a consumer of those builds
must pin the certificate of the Hub that will actually be installed. Publishing
a fingerprint does not authorize a client—the Hub user still approves each
consumer separately.

For Sales&Pricing Mobile, configure `MODELCOMMONS_ANDROID_HUB_PACKAGE` and
`MODELCOMMONS_ANDROID_HUB_SHA256` in the **consumer's** build environment, or its
variant's `localAI.androidHubs`. Use the signing certificate of the Hub APK
installed on the device. `apksigner verify --verbose --print-certs ModelCommons.apk`
prints APK signing certificates; an APK file checksum is a different value.
A Play installation may use a different app signing key from the EAS/AAB upload
key. Never substitute the upload key for the installed app's signer.

After installing the configured consumer build, connect from Sales&Pricing
Mobile to register a pending request, approve its package and certificate in
Hub **Clients**, then return, reconnect and refresh models. Missing build trust
cannot be repaired by client approval. Neither step downloads a private model.

`createAndroidBinderTransport({ packageName, trustedCertificateSha256 })` returns
a canonical transport, service information, and disconnect operation. Both apps
must ship matching API 2 native connectors. API 1 parcels are incompatible.

## Implemented boundaries

- Caller authority comes from Binder UID, user, the complete package set and
  signing identity. Approval and scope are rechecked before execution/delivery.
- Sessions use opaque IDs and bounded lifetimes. Per-UID/global limits bound
  requests, sessions, pending approvals and callback data.
- The host admits one generation/context at a time. Busy work is rejected;
  there is no unbounded inference queue.
- Model authority comes from trusted pinned metadata, confined paths, actual
  size/SHA-256 checks and an open verified descriptor held through execution.
- Streaming has ordered lifecycle events and one-event credit. Client death,
  revocation, timeout or cancellation stops work and discards undeliverable data.
- Context teardown precedes descriptor release and coordinator reuse. Mutation
  and deletion share the Hub's admission gate.

The initial host is **CPU-only, arm64-v8a, Android API 24+**, with Safe/context
1024 and an output ceiling of 128 tokens. It supports bounded text generation;
tools, schemas, vision/audio, unsupported sampling fields and larger budgets are
rejected. Exact limits and source pins are in the
[acceptance guide](../verification/android-binder-inference-owner-run.md).

## Availability and remaining evidence

`centralizedInference=true` means the optional host implementation/library is
present. It does not prove that a model has loaded or completed a request. A
release acknowledgement requests cleanup; the separate drain state confirms it.
Missing connections cannot establish successful drain.

The service is an ordinary bound service, without a promise of indefinite
background execution. A force-stopped Hub may need to be reopened. Physical
tests still need to cover cold bind, offline generation, authorization and
revocation, multiple callers, death, backpressure, cancellation, model deletion,
backgrounding and process reclamation. Compile success is recorded separately
from those cases.

Android's design differs from the [verified iOS Files flow](../verification/ios-shared-models.md),
where each consumer executes locally against shared storage.

## Chat keyboard verification

Hub chat explicitly uses Android keyboard height avoidance with the navigation
header's measured height. Its message list can shrink while the composer remains
outside the scrolling content. iOS retains its existing padding behavior and offset.
On a physical Android device, verify empty and populated chats, multiline input,
Send/Cancel, repeated keyboard open/close, gesture navigation and three-button
navigation. Check that controls stay above the keyboard and system navigation bar.
Source checks alone do not verify keyboard layout on a device.
