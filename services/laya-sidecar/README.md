# Laya Decision sidecar

Open-weight System 1 engine for Studio (`DECISION_PROVIDER=laya` / `auto`).

## Why a sidecar?

Studio often deploys on Vercel Hobby, which cannot load ~1.7 GB ONNX weights.
Run Laya on a GPU/CPU host and point the app at it:

```bash
pip install 'laya>=0.3.3' fastapi uvicorn
LAYA_PORT=8091 python services/laya-sidecar/server.py
```

App env:

```bash
LAYA_BASE_URL=http://127.0.0.1:8091
# optional: LAYA_API_KEY=shared-secret
DECISION_PROVIDER=laya   # or leave auto
```

## Local ONNX (no sidecar)

On a fat Node host:

```bash
npm i @receptron/laya
LAYA_MODE=onnx LAYA_ENABLED=1
# optional: LAYA_MODEL_DIR=./onnx
```

See `docs/research/oss-decision-llm.md` and `docs/adr/007-oss-decision-llm.md`.
