/**
 * Local-only env loader. Vercel injects process.env itself — never read key
 * files in production so deployed users must paste BYOK headers.
 */
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

if (process.env.VERCEL !== '1') {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  dotenv.config({ path: path.join(repoRoot, '.env.local') })
  dotenv.config({ path: path.join(repoRoot, '.env') })
}
