# Offline contract cases

Use `openai@7.5.0` only as an optional test dependency; the provider package itself must stay dependency-free from it.

1. `models.list()` parses only ready local models and makes zero delegate/network calls.
2. `responses.create()` exposes `output_text`; its stream has the complete Responses lifecycle, uses `response.incomplete` for a length stop, and has no required `[DONE]` marker.
3. Chat text and tool streams use data-only chunks, indexed tool fragments, an optional final usage chunk, and `[DONE]`.
4. A tool result round trip preserves `call_id`/`tool_call_id`; no adapter code executes the tool.
5. JSON object, JSON Schema, strict tools, sampling, stop, and parallel-tool requests fail when their explicit capability flag is off.
6. Embeddings test both float arrays and the SDK's omitted-format/base64 path; decode the returned bytes as little-endian float32.
7. Unknown fields and unsupported nested images/audio/reasoning return HTTP 400 with `x-modelcommons-error-code`.
8. Abort during validation, execution, and stream consumption reaches the backend signal; stream cancellation releases exactly once.
9. A URL on any origin other than `https://modelcommons.local` rejects and never invokes another fetch.
