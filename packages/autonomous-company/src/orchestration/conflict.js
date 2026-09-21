/**
 * Conflict detection: overlapping file ownership and duplicate work.
 */

export function detectFileConflicts(tasks) {
  const owners = new Map()
  const conflicts = []
  for (const task of tasks) {
    if (!['active', 'in_review', 'queued'].includes(task.status)) continue
    for (const file of task.filesLikely || []) {
      if (!owners.has(file)) {
        owners.set(file, task.id)
        continue
      }
      const other = owners.get(file)
      if (other !== task.id) {
        conflicts.push({
          file,
          taskIds: [other, task.id],
          message: `File ownership conflict on ${file}`,
        })
      }
    }
  }
  return conflicts
}

export function acquireLocks(run, task) {
  const locks = { ...(run.locks || {}) }
  const conflicts = []
  for (const file of task.filesLikely || []) {
    if (locks[file] && locks[file] !== task.id) {
      conflicts.push({ file, heldBy: locks[file], requestedBy: task.id })
    }
  }
  if (conflicts.length) {
    return { ok: false, conflicts, locks }
  }
  for (const file of task.filesLikely || []) {
    locks[file] = task.id
  }
  return { ok: true, conflicts: [], locks }
}

export function releaseLocks(run, taskId) {
  const locks = { ...(run.locks || {}) }
  for (const [file, owner] of Object.entries(locks)) {
    if (owner === taskId) delete locks[file]
  }
  return locks
}

export function findDuplicateBranch(tasks, branch) {
  if (!branch) return null
  return tasks.find(
    (t) =>
      t.branch === branch &&
      ['active', 'queued', 'in_review', 'blocked'].includes(t.status),
  ) || null
}
