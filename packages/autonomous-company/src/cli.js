#!/usr/bin/env node
import { resolve } from 'node:path'
import {
  boot,
  beginRun,
  runCycle,
  runDiscovery,
  interruptRun,
  stopRun,
  advancePhase,
  completeTask,
  requestHighImpact,
  getConflicts,
  loadStore,
} from './orchestration/controller.js'
import { renderStatusText, formatStatus } from './observability/status.js'
import { evaluateGates } from './gates/quality.js'
import { AGENTS } from './agents/registry.js'
import { findRepoRoot } from './repo-root.js'

function usage() {
  return `autonomous-company — durable controller CLI

Usage:
  npm run company -- <command> [options]

Commands:
  init                 Initialize durable state under .autonomous-company/
  status               Show current run, phase, pool, locks
  cycle [--dry-run] [--resume]
                       Run one discovery→select cycle (or resume)
  discover             Discovery + prioritization only
  resume               Resume interrupted/running execution
  interrupt [reason]   Mark run interrupted (durable)
  stop [reason]        Stop run and clear active task
  phase <name>         Advance phase (define|design|...|postmortem)
  agents               List agent registry
  conflicts            Show file ownership conflicts
  safety <action>      Check whether a high-impact action is allowed
  complete <taskId> --report <jsonFile>
                       Attempt task completion with gate evidence
  help                 Show this help

Notes:
  - This CLI does not invent test results or deploy by default.
  - Pair with /autonomous-company skill for agent-executed SDLC phases.
  - See docs/autonomous-company/ARCHITECTURE.md
`
}

function parseArgs(argv) {
  const args = argv.slice(2)
  const command = args[0] || 'help'
  const flags = new Set(args.filter((a) => a.startsWith('--')))
  const positional = args.filter((a) => !a.startsWith('--'))
  return { command, flags, positional, args }
}

async function main() {
  const repoRoot = resolve(findRepoRoot(process.cwd()))
  const { command, flags, positional, args } = parseArgs(process.argv)
  const dryRun = flags.has('--dry-run')
  const resume = flags.has('--resume') || command === 'resume'

  switch (command) {
    case 'help':
    case '--help':
    case '-h':
      console.log(usage())
      return
    case 'init': {
      const store = boot(repoRoot)
      console.log(renderStatusText(store.status))
      console.log('\nInitialized:', store.paths.root)
      return
    }
    case 'status': {
      const store = loadStore(repoRoot)
      console.log(renderStatusText(formatStatus(store)))
      return
    }
    case 'discover': {
      boot(repoRoot)
      beginRun(repoRoot, { resume: false })
      const result = runDiscovery(repoRoot)
      console.log(
        JSON.stringify(
          {
            accepted: result.accepted.length,
            rejected: result.rejected.length,
            selection: result.selection,
            message: result.selection.message,
          },
          null,
          2,
        ),
      )
      if (!result.selection.task) stopRun(repoRoot, result.selection.reason)
      return
    }
    case 'cycle':
    case 'resume': {
      const result = runCycle(repoRoot, { dryRun, resume: resume || command === 'resume' })
      console.log(JSON.stringify(result, null, 2))
      return
    }
    case 'interrupt': {
      const reason = positional[1] || 'manual_interrupt'
      console.log(renderStatusText(interruptRun(repoRoot, reason)))
      return
    }
    case 'stop': {
      const reason = positional[1] || 'manual_stop'
      console.log(renderStatusText(stopRun(repoRoot, reason)))
      return
    }
    case 'phase': {
      const phase = positional[1]
      if (!phase) {
        console.error('phase requires a name')
        process.exitCode = 1
        return
      }
      const result = advancePhase(repoRoot, phase)
      console.log(JSON.stringify(result, null, 2))
      return
    }
    case 'agents': {
      console.log(JSON.stringify(AGENTS, null, 2))
      return
    }
    case 'conflicts': {
      console.log(JSON.stringify(getConflicts(repoRoot), null, 2))
      return
    }
    case 'safety': {
      const action = positional[1]
      if (!action) {
        console.error('safety requires an action name')
        process.exitCode = 1
        return
      }
      console.log(JSON.stringify(requestHighImpact(repoRoot, action), null, 2))
      return
    }
    case 'complete': {
      const taskId = positional[1]
      const reportIdx = args.indexOf('--report')
      if (!taskId || reportIdx < 0 || !args[reportIdx + 1]) {
        console.error('Usage: complete <taskId> --report <jsonFile>')
        process.exitCode = 1
        return
      }
      const report = JSON.parse(await import('node:fs').then((fs) => fs.readFileSync(args[reportIdx + 1], 'utf8')))
      const result = completeTask(repoRoot, taskId, report)
      console.log(JSON.stringify(result, null, 2))
      if (!result.ok) process.exitCode = 1
      return
    }
    case 'gates': {
      const category = positional[1] || 'bug'
      console.log(JSON.stringify(evaluateGates({ category, checklist: {} }), null, 2))
      return
    }
    default:
      console.error(`Unknown command: ${command}\n`)
      console.log(usage())
      process.exitCode = 1
  }
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
