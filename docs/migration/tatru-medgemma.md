# Migrating the TatruMedGemma donor install

Status as of 2026-08-27: a one-time, journaled legacy model-directory migration
is implemented in `services/modelcommons/modelStore.ts`. It runs during store
initialization. Application state and chats are not generically migrated.

## Identity comes before files

Mobile sandbox access is tied to application identity. The current ModelCommons
config uses Android package and iOS bundle identifier
`com.uvasolutions.modelcommons`, not the donor Android package
`com.sirnejo.tatrumedgemmaapp`. That creates a different sandbox, so the automatic
migrator cannot see an installed donor app's private files in a normal fresh
install. The code is useful for an in-place bridge build retaining the donor
identity/signing key, for a development copy already containing the legacy
directory, or after an explicit user-controlled export/import.

Owner review must establish the donor iOS identifier/signing team and upgrade
path. A new App Group does not retroactively grant another app access to the old
private container. Do not change a published application identity expecting the
filesystem migration alone to bridge it.

## Legacy input recognized by the store

The migrator looks under the app document directory for:

```text
models/
  download-manifest.json  # contains ggufUri and optional mmprojUri
  <legacy GGUF>
  <optional legacy mmproj>
```

It rejects paths outside that exact legacy root and unsafe filenames. It records
a migration journal, moves the directory to
`ModelCommons/models/medgemma-4b-it-legacy-donor-v1/`, renames present artifacts
to `model.gguf` and `mmproj.gguf`, writes a generic manifest, publishes
`local/migrated-medgemma-4b-it` as a `READY` inventory record, then removes the
journal. If both source and migration destination exist, it fails rather than
overwrite either one.

The migration validates paths, presence, and recorded sizes. It deliberately
does **not** claim a checksum that the donor never stored. The manifest says so,
uses the local `legacy-donor-v1` revision, recommends `safe`, and records the
Health AI Developer Foundations terms. A migrated inventory record does not
waive license acceptance; the host must still gate load/use appropriately.

## What is not migrated automatically

Do not silently carry these into generic ModelCommons configuration:

- provider API keys, LAN endpoints, Kaggle credentials, Flask/Ollama settings,
  or cloud fallback preferences;
- medical system prompts, disclaimer/consent state, vision UI defaults, or model
  aliases implying provider equivalence;
- chat history or attached images, including donor persisted chat state; or
- raw logs, crash data, or diagnostic identifiers.

These belong to the MedGemma reference experience or the user's old application
data, not the shared runtime. If a product later offers chat export/import, it
needs a separate preview, consent, schema, encryption/retention policy, and
rollback story.

## Safe upgrade procedure

1. Archive the exact prior app version, application IDs, signing identities, and
   store layout in release notes.
2. Back up a non-sensitive test fixture and verify the old app can still load it.
3. Either upgrade a reviewed bridge build in place with the same donor identity
   and signing key, or export from the donor and explicitly import in
   ModelCommons. Do not uninstall before export: uninstalling normally removes
   the private sandbox.
4. Initialize ModelCommons with no active llama context or legacy download.
5. Inspect the migration result and surface a clear error without deleting either
   copy on ambiguity.
6. Require license acceptance before first use and run a small `safe` load/generate
   check.
7. Only after successful use offer cleanup of obsolete donor-only metadata.

Test fresh install, complete legacy install, text-only legacy install, interrupted
download, corrupt/missing manifest, path escape, migration interruption after
each move, both-directories conflict, low disk, and upgrade followed by rollback.

## Rollback

The on-disk move means an older binary expecting `documents/models/` will not see
the migrated directory. Release engineering must either provide a tested reverse
migration/export before rollout or declare the upgrade one-way and retain a full
user backup path. The current code has recovery journaling but no automatic
reverse migration. Do not promise downgrade compatibility.

## Provenance review

This repository began as a copy of TatruMedGemma donor code. Before public
release, the owner must review commit/file provenance, confirm rights to publish
all retained assets and text, document any additional contributors/copyrights,
and verify that the unchanged MIT notice remains accurate. See
[THIRD-PARTY-NOTICES.md](../../THIRD-PARTY-NOTICES.md).
