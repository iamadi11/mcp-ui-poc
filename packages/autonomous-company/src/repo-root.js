import { existsSync } from 'node:fs'
import { dirname, join, parse } from 'node:path'

/**
 * Resolve monorepo root even when npm runs the CLI inside a workspace package.
 */
export function findRepoRoot(startDir = process.cwd()) {
  if (process.env.COMPANY_REPO_ROOT) {
    return process.env.COMPANY_REPO_ROOT
  }
  let dir = startDir
  const { root } = parse(dir)
  while (true) {
    const hasContext = existsSync(join(dir, 'CONTEXT.md'))
    const hasCompanyPkg = existsSync(join(dir, 'packages/autonomous-company/package.json'))
    const hasGit = existsSync(join(dir, '.git'))
    if (hasContext || (hasCompanyPkg && hasGit)) {
      return dir
    }
    if (dir === root) break
    dir = dirname(dir)
  }
  return startDir
}
