# ADR-002: Pluggable LLM providers

## Status

Accepted

## Decision

`LLMProvider` protocol with Mock, Ollama, and future Foundation Models / MLX. Deterministic FastPathRouter runs before any provider.
