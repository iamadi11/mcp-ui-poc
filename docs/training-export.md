# Training export (future LocalAdapter)

Turns stored in Mongo (`turns` collection) plus thumbs-up/down ratings are the labeled set for an on-device DecisionAdapter. Soft-deleted studio chats land in `studio_chats` (prompts, planner path, `LayoutPolicy` / spec — never HTML or raw API payloads).

## Schema (frozen)

Input: `{ state, questions }` where `state` is `{ prompt, shape, catalog, previousPolicy, neighbors }` — **not** the API payload.

Output: `{ answers, confidence }` using `ROUTING_QUESTION_IDS` in `packages/core/src/decisions/schema.js`.

## Export

```bash
MONGODB_URI=... npm run export:turns > turns.json
```

The JSON omits raw payloads, API keys, and GitHub tokens. Soft-deleted chats are in `archivedChats`. First replacement target is **intent**, then `include_*` layout questions. Claude remains last-resort generation until a local model exists.

`packages/core/src/decisions/local.js` throws `LOCAL_ADAPTER_UNAVAILABLE` until that model is wired (ONNX/WASM).
