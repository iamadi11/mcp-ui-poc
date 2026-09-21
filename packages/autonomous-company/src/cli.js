#!/usr/bin/env node
import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
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
import {
  startCompany,
  tickCompany,
  bootCompany,
  pauseCompany,
  stopCompany,
} from './orchestration/clock.js'
import { renderStatusText, formatStatus, renderCompanyDashboard } from './observability/status.js'
import { evaluateGates } from './gates/quality.js'
import { AGENTS } from './agents/registry.js'
import { findRepoRoot } from './repo-root.js'

function usage() {
  return `autonomous-company — Company Operating System CLI

Usage:
  npm run company -- <command> [options]

Primary (company OS):
  start [--ticks N] [--fresh]   Start/resume company clock; continues after task completion
  tick                         One clock tick (discover/assign/recover/follow-ups)
  status                       Dashboard + run status
  pause [reason]               Pause durable company state
  stop [reason]                Stop company

Work:
  complete <taskId> --report <jsonFile>
  conflicts
  safety <action>

Legacy (single-cycle debug):
  init | discover | cycle [--dry-run] [--resume]
  phase <name> | resume | interrupt | agents | gates | help

Notes:
  - Completing a task does NOT stop the company — run tick again.
  - Pair with /autonomous-company skill as worker executor.
  - See docs/autonomous-company/ARCHITECTURE.md
`
}

function parseArgs(argv) {
  const args = argv.slice(2)
  const command = args[0] || 'help'
  const flags = new Set(args.filter((a) => a.startsWith('--') && !a.includes('=')))
  const positional = args.filter((a) => !a.startsWith('--'))
  const getFlagValue = (name) => {
    const idx = args.indexOf(name)
    if (idx >= 0 && args[idx + 1] && !args[idx + 1].startsWith('--')) return args[idx + 1]
    const eq = args.find((a) => a.startsWith(`${name}=`))
    return eq ? eq.split('=')[1] : null
  }
  return { command, flags, positional, args, getFlagValue }
}

async function main() {
  const repoRoot = resolve(findRepoRoot(process.cwd()))
  const { command, flags, positional, args, getFlagValue } = parseArgs(process.argv)
  const dryRun = flags.has('--dry-run')
  const resume = flags.has('--resume') || command === 'resume'
  const fresh = flags.has('--fresh')
  const ticksRaw = getFlagValue('--ticks')
  const ticks = ticksRaw ? Number(ticksRaw) : undefined

  switch (command) {
    case 'help':
    case '--help':
    case '-h':
      console.log(usage())
      return
    case 'start': {
      const result = startCompany(repoRoot, { ticks, fresh, resume: !fresh })
      console.log(result.dashboard)
      console.log('\n---\n')
      console.log(JSON.stringify({
        ok: result.ok,
        message: result.message,
        ticks: result.ticks,
        workOrders: result.workOrders,
        idle: result.results?.some?.((r) => r.idle) || false,
        status: result.status,
      }, null, 2))
      return
    }
    case 'tick': {
      const result = tickCompany(repoRoot, {})
      console.log(result.dashboard)
      console.log('\n---\n')
      console.log(JSON.stringify(result, null, 2))
      return
    }
    case 'init': {
      const store = bootCompany(repoRoot)
      console.log(renderCompanyDashboard(store))
      console.log('\nInitialized:', store.paths.root)
      return
    }
    case 'status': {
      const store = loadStore(repoRoot)
      console.log(renderCompanyDashboard(store))
      console.log('\n')
      console.log(renderStatusText(formatStatus(store)))
      return
    }
    case 'pause': {
      const reason = positional[1] || 'manual_pause'
      console.log(renderStatusText(pauseCompany(repoRoot, reason)))
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
      console.log(renderStatusText(stopCompany(repoRoot, reason)))
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
      const report = JSON.parse(readFileSync(args[reportIdx + 1], 'utf8'))
      const result = completeTask(repoRoot, taskId, report)
      console.log(JSON.stringify(result, null, 2))
      if (result.ok && result.companyContinues) {
        console.error('\nCompany continues — run: npm run company -- tick')
      }
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
