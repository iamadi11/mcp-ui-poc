#!/usr/bin/env node
import { resolve } from 'node:path'
import { existsSync } from 'node:fs'
import {
  startAutonomous,
  tickAutonomous,
  stopAutonomous,
  formatStatus,
  renderDashboard,
} from './director/clock.js'
import { ensureState } from './state/store.js'

function findRepoRoot(cwd = process.cwd()) {
  let dir = resolve(cwd)
  for (let i = 0; i < 12; i++) {
    // Nested under mcp-ui-poc monorepo
    const nested = resolve(dir, 'mac-agent')
    if (
      existsSync(resolve(nested, 'Package.swift')) &&
      existsSync(resolve(nested, 'tools/autonomous/src/cli.js'))
    ) {
      return nested
    }
    if (existsSync(resolve(dir, 'Package.swift')) || existsSync(resolve(dir, 'tools/autonomous/src/cli.js'))) {
      return dir
    }
    const parent = resolve(dir, '..')
    if (parent === dir) break
    dir = parent
  }
  return resolve(cwd)
}

function usage() {
  return `autonomous — Director CLI for Mac Agent

Usage:
  npm run autonomous -- <command> [options]

Commands:
  start [--goal "..."] [--ticks N] [--fresh]   Start/resume director loop
  tick                                         One decide→delegate→verify cycle
  status                                       Dashboard + JSON
  stop [reason]                                Stop durable run
  help

Notes:
  - Completing one specialist task does NOT end the loop — tick again.
  - Pair with /.cursor/skills/autonomous/SKILL.md when running under Cursor.
`
}

function parseArgs(argv) {
  const args = argv.slice(2)
  const command = args[0] || 'help'
  const flags = new Set(args.filter((a) => a.startsWith('--') && !a.includes('=')))
  const get = (name) => {
    const idx = args.indexOf(name)
    if (idx >= 0 && args[idx + 1] && !args[idx + 1].startsWith('--')) return args[idx + 1]
    const eq = args.find((a) => a.startsWith(`${name}=`))
    return eq ? eq.slice(name.length + 1) : null
  }
  return { command, flags, get, args }
}

function main() {
  const repoRoot = findRepoRoot(process.cwd())
  const { command, flags, get, args } = parseArgs(process.argv)

  switch (command) {
    case 'help':
    case '--help':
    case '-h':
      console.log(usage())
      return
    case 'start': {
      ensureState(repoRoot)
      const goal = get('--goal')
      const ticks = Number(get('--ticks') || 12)
      const fresh = flags.has('--fresh')
      const result = startAutonomous(repoRoot, { goal, ticks, fresh })
      console.log(renderDashboard(result.status))
      console.log('\n---\n')
      console.log(
        JSON.stringify(
          {
            ok: result.ok,
            message: result.message,
            phases: result.results.map((r) => r.phase).filter(Boolean),
            skills: result.results.map((r) => r.workOrder?.skill).filter(Boolean),
            idle: result.results.some((r) => r.idle),
            status: result.status,
          },
          null,
          2,
        ),
      )
      return
    }
    case 'tick': {
      const result = tickAutonomous(repoRoot)
      console.log(renderDashboard(result.status))
      console.log('\n---\n')
      console.log(JSON.stringify(result, null, 2))
      return
    }
    case 'status': {
      const status = formatStatus(repoRoot)
      console.log(renderDashboard(status))
      console.log('\n---\n')
      console.log(JSON.stringify(status, null, 2))
      return
    }
    case 'stop': {
      const reason = args[1] || 'user_stop'
      const status = stopAutonomous(repoRoot, reason)
      console.log(renderDashboard(status))
      return
    }
    default:
      console.error(`Unknown command: ${command}\n`)
      console.log(usage())
      process.exitCode = 1
  }
}

main()
