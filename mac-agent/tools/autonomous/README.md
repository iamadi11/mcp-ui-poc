# Autonomous Director CLI

Production orchestration for `/autonomous`.

## One command

```bash
npm run autonomous -- start --goal "Build the local-first Mac AI control application." --ticks 12
```

This runs multiple SDLC stages in one invocation: decide → specialist → evidence → replan → next.

## Commands

| Command | Purpose |
|---------|---------|
| `start [--goal] [--ticks N] [--fresh]` | Run the director loop |
| `tick` | One cycle |
| `status` | Dashboard |
| `stop [reason]` | Stop durable run |

## Layout

```
tools/autonomous/src/
  cli.js
  director/{decide,clock}.js
  specialists/handlers.js
  state/store.js
.cursor/skills/autonomous/          # entry skill
.cursor/skills/auto-*/              # specialists
.agent/state/                       # durable project memory
```

## Tests

```bash
npm run autonomous:test
```
