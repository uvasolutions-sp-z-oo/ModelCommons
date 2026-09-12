# Roadmap

ModelCommons is a pre-alpha developer preview. This roadmap describes priorities,
not delivery dates or compatibility guarantees.

## Demonstrated

- Local inference inside ModelCommons and Sales & Pricing Mobile, reported by the owner.
- iOS model-file reuse through the Files folder picker on a physical iPhone SE.
- Successful airplane-mode generation after removing the consumer's private model
  and downloading the model only in ModelCommons.

See the [evidence record](verification/ios-shared-models.md) for the exact scope.

## Next milestones

1. **Complete the iOS evidence pack.** Add exact model, OS and build identities,
   sanitized screenshots/diagnostics, and repeated offline runs.
2. **Verify Android centralized inference.** Exercise two signed apps through
   Binder, including authorization, cancellation, client death, revocation and
   cleanup. The native CPU host compiles; device acceptance is still pending.
3. **Broaden iOS coverage.** Test restart and bookmark restoration, Hub-closed
   operation, cancellation, memory pressure, separate App Group provisioning,
   and a client signed by an unrelated developer team.
4. **Improve contributor integration.** Add runnable minimal clients, a reviewed
   npm release pipeline, package/version migration guidance, and CI evidence.
5. **Harden protocol and lifecycle boundaries.** Expand compatibility and failure
   cases, retention/deletion documentation, and device security/privacy review.
6. **Validate provider-shaped paths on mobile.** Keep exact subsets documented;
   Anthropic streaming requires early input-token usage that the current
   llama.rn stream does not emit. Official SDK validation remains separate.

## Research

Broader modalities, tool/schema support through Hub composition, accelerator
coverage, and Elastic MoE caching remain future work. Source types or upstream
features alone do not establish ModelCommons support.
