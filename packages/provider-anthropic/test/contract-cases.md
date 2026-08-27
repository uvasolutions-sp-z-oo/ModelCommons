# Offline contract cases

Use `@anthropic-ai/sdk@0.120.0` only as an optional test dependency; do not add it to the provider package.

1. `messages.create()` parses text, top-level system instructions, current nullable fields, usage, and the resolved local model ID.
2. `messages.stream()` and raw async iteration observe `message_start`, block start/delta/stop, `message_delta`, and `message_stop`, with no `[DONE]` marker.
3. Tool arguments arrive as concatenable `input_json_delta` values; the following user `tool_result` preserves `tool_use_id` and is never executed by the adapter.
4. `output_config.format` and strict tools fail unless the relevant constrained-decoding flag is on.
5. Missing/wrong `anthropic-version`, beta headers, thinking/images/server tools, and unknown fields return `invalid_request_error` plus `x-modelcommons-error-code`.
6. Unknown models return `not_found_error`; runtime failures before and after stream headers retain `request-id`.
7. Abort before execution and cancellation during consumption reach the backend signal and release once.
8. Any origin other than `https://modelcommons.local` rejects without invoking another fetch.
