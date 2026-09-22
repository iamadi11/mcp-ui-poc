#!/usr/bin/env python3
"""
Minimal Laya HTTP sidecar for Studio DecisionAdapter.

Install (GPU or CPU host — not Vercel serverless):
  pip install 'laya>=0.3.3' fastapi uvicorn

Run:
  LAYA_PORT=8091 python services/laya-sidecar/server.py

Studio:
  LAYA_BASE_URL=http://127.0.0.1:8091
  DECISION_PROVIDER=laya   # or auto
"""

from __future__ import annotations

import os
from typing import Any

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="Laya sidecar", version="0.1.0")

_router = None
_agent = None


def _load():
    global _router, _agent
    if _router is not None or _agent is not None:
        return
    import laya
    from laya import Router

    # Router with preload when available; fall back to a single English agent.
    try:
        _router = Router(preload=True)
    except Exception:
        _agent = laya.load("convaiinnovations/laya")


class SystemOneBody(BaseModel):
    state: Any
    questions: dict[str, Any] = Field(default_factory=dict)
    model: str | None = None


def _check_auth(authorization: str | None) -> None:
    expected = os.environ.get("LAYA_API_KEY")
    if not expected:
        return
    if not authorization or authorization != f"Bearer {expected}":
        raise HTTPException(status_code=401, detail="Unauthorized")


def _min_confidence(answers: dict[str, Any]) -> float | None:
    scores = []
    for value in answers.values():
        if isinstance(value, dict) and isinstance(value.get("confidence"), (int, float)):
            scores.append(float(value["confidence"]))
    return min(scores) if scores else None


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "engine": "laya"}


@app.post("/v1/system_one")
def system_one(
    body: SystemOneBody,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    _check_auth(authorization)
    _load()
    if _router is not None:
        raw = _router.predict(body.state, body.questions)
        answers = raw.get("answers", raw)
        model = (raw.get("routing") or {}).get("model") or body.model or "laya"
    else:
        raw = _agent.predict(body.state, body.questions)
        answers = raw.get("answers", raw) if isinstance(raw, dict) else raw
        model = body.model or "laya"
    return {
        "answers": answers,
        "confidence": _min_confidence(answers) if isinstance(answers, dict) else None,
        "model": model,
    }


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("LAYA_PORT", "8091"))
    uvicorn.run(app, host="0.0.0.0", port=port)
