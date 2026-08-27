# @modelcommons/runtime-llama-rn

Optional ModelCommons runtime adapter pinned to `llama.rn` 0.12.9 (embedded llama.cpp build b10256).

The package deliberately makes `llama.rn` an optional peer. Installing `@modelcommons/client` or the protocol packages must not download native inference binaries; only applications that choose this runtime install the exact peer.

The default pool permits one loaded model/profile context and serializes completions. This is intentional for phone memory safety. Sessions with the same model, lease and profile share that context while active; the final session release destroys the native context immediately. A security-scoped model lease is released only after `context.release()` resolves.

Canonical requests include their full conversation history, so the adapter clears llama.rn KV state before every completion. Recurrent/hybrid contexts request a full data clear; dense contexts clear cache metadata. This trades some prefix-cache throughput for isolation between sessions sharing one native context.

Capabilities are read from the loaded context (`gpu`, `reasonNoGPU`, `devices`, Android library and Jinja chat-template capability flags). Tool calls are enabled only when the selected Jinja template reports both tool input and tool-call output support. JSON schema/object requests are mapped only to llama.rn grammar constraints. Multimodal input is not advertised because this adapter does not initialize an `mmproj` context.

Cancellation is native: once a request owns the serialized inference lane, abort/cancel invokes `context.stopCompletion()`. Aborting a queued request never stops a different session's active completion. Ending async iteration early also aborts the associated native request.

For iOS open-ecosystem storage, pass the lease returned by `@modelcommons/native` as the model lease. Do not call the native lease's `release()` separately; this runtime balances it after the mmap/context is destroyed.
