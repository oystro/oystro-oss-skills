---
name: node
description: >
  Always activate when writing Node.js or TypeScript code in this project.
  Use when creating files, writing tests with vitest, defining types,
  or working with package.json. Overrides pretrained habits with project rules.
license: MIT
metadata:
  author: Oystro
  version: "1.0.0"
---
<!-- *** Maintained by oystro/oystro-oss, DON'T modify this, will be overwritten during next upgrade *** -->
<!-- License: MIT — see the repository LICENSE. Adapt these instructions to YOUR project's pinned versions, stack, and conventions; verify against official docs. -->


<!-- EDITORIAL: Only project-specific rules and common AI mistakes. -->

## Non-Negotiable Rules

- TypeScript strict mode only — `"strict": true` in tsconfig.json
- `pnpm` for package management — never `npm install` or `yarn`
- `vitest` for testing — never Jest
- No `any` type — use `unknown` and narrow it
- ESM modules only — `"type": "module"` in package.json
- **Prefer std lib** — do not add a third-party dependency when Node built-ins cover the need

## Project Layout

```
src/           ← source TypeScript
tests/         ← vitest tests (*.test.ts)
dist/          ← compiled output (gitignored)
tsconfig.json  ← strict mode, paths configured
package.json   ← scripts: dev, build, test, lint, typecheck
```

## Modern Toolchain

```json
// package.json scripts
{
  "type": "module",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest run",
    "test:coverage": "vitest run --coverage",
    "lint": "eslint src/ tests/",
    "typecheck": "tsc --noEmit",
    "check": "pnpm typecheck && pnpm lint && pnpm test"
  }
}
```

```bash
pnpm check          # typecheck + lint + test
pnpm build          # compile
```

## Type Conventions

- Use `satisfies` operator for config objects
- Prefer `interface` for extendable shapes, `type` for unions and intersections
- Use `zod` for runtime validation of external data

```typescript
// CORRECT
interface User {
  id: string
  name: string
}
type Status = 'active' | 'inactive' | 'pending'

// WRONG
const user: any = { id: '1' }
```

## Test Conventions

- Coverage target: >80% (`vitest --coverage`)
- Mock with `vi.mock()` and `vi.spyOn()`

```typescript
import { describe, it, expect, beforeEach } from 'vitest'

describe('MyComponent', () => {
  it('should do X when Y', () => {
    const result = myFn('input')
    expect(result).toBe('expected')
  })
})
```

## Structured Logging

Use `console` with structured objects — never string concatenation for operational logs.

```typescript
// CORRECT
console.info({ event: 'server_started', addr, port })
console.error({ event: 'request_failed', err: err.message, stack: err.stack })

// WRONG
console.log(`server started on ${addr}:${port}`)
```

## Configuration & Secrets

```typescript
// CORRECT — secrets from ~/.config/<app>/ (or Windows %APPDATA% / %USERPROFILE% fallbacks), env vars for non-secrets
import { z } from 'zod'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { parse as parseYaml } from 'yaml'

const configSchema = z.object({
  PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  DATABASE_URL: z.string().url(),
  API_KEY: z.string().min(1),
})

function loadConfig() {
  // 1. Load secrets from standard config directory (handling Windows fallback)
  let configFile = process.env.APPDATA
    ? join(process.env.APPDATA, 'myapp', 'config.yaml')
    : join(homedir(), '.config', 'myapp', 'config.yaml')

  if (process.env.APPDATA && !existsSync(configFile) && process.env.USERPROFILE) {
    configFile = join(process.env.USERPROFILE, '.config', 'myapp', 'config.yaml')
  }

  let secrets: Record<string, unknown> = {}
  try {
    const raw = readFileSync(configFile, 'utf-8')
    secrets = parseYaml(raw)
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw new Error(`Failed to read ${configFile}: ${err}`)
    }
  }

  // 2. Merge: secrets as base, env vars override non-secrets
  const merged = {
    ...secrets,
    PORT: process.env.PORT ?? secrets.PORT,
    LOG_LEVEL: process.env.LOG_LEVEL ?? secrets.LOG_LEVEL,
  }

  // 3. Validate — fails fast with clear message
  return configSchema.parse(merged)
}
```

**Directory structure:**
- Unix: `~/.config/<app-name>/config.yaml`
- Windows: `%APPDATA%\<app-name>\config.yaml` (fallback: `%USERPROFILE%\.config\<app-name>\config.yaml`)

## Health Checks & Graceful Shutdown

```typescript
// Health endpoints
app.get('/healthz', (_req, res) => res.json({ status: 'ok' }))
app.get('/readyz', async (_req, res) => {
  try {
    await db.query('SELECT 1')
    res.json({ status: 'ok' })
  } catch {
    res.status(503).json({ status: 'error' })
  }
})

// Graceful shutdown
const shutdown = async (signal: string) => {
  server.close(async () => {
    await db.disconnect()
    process.exit(0)
  })
  setTimeout(() => process.exit(1), 30_000)
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
```

## API Error Format

Every HTTP handler must return errors in a consistent JSON format.

```typescript
interface APIError {
  code: string
  message: string
}

function sendError(res: Response, status: number, code: string, message: string) {
  res.status(status).json({ code, message })
}
```

## Database Runtime Patterns

```typescript
// Pool size configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
})

// Transaction with rollback
const client = await pool.connect()
try {
  await client.query('BEGIN')
  // ... db operations ...
  await client.query('COMMIT')
} catch (err) {
  await client.query('ROLLBACK')
  throw err
} finally {
  client.release()
}
```

## Node Built-ins to Use First

| Need | Built-in | Do NOT add |
|------|----------|------------|
| HTTP client | `fetch` (global Node 18+) | axios, node-fetch |
| URL parsing | `new URL()` | url-parse |
| Crypto | `node:crypto` | md5, uuid |
| File read/write | `node:fs/promises` | fs-extra |
| **WebSocket** | **global `WebSocket` (Node 22+)** | ws, socket.io |
| Child process | `node:child_process` | execa, shelljs |
| Testing | vitest (project standard) | jest |
| Schema validation | `zod` | joi, yup, ajv |
| Environment | `node:process.env` | dotenv |

## Tooling: Reach for a Dependency Only When the Built-in Is Not Enough

The built-ins table is not just a style preference. A runtime that ships the
capability globally means a tool needs **zero** dependencies, which is worth
more than convenience: no lockfile churn, no install step in CI, and a script
that still runs in five years.

The test that decides it: *would this tool still work if npm were unreachable?*
If yes, it ships as a single file with no `node_modules`.

| Situation | Use | Why |
| --- | --- | --- |
| Driving a real browser over the DevTools protocol | `WebSocket` (Node 22+) plus a `chrome-headless-shell` binary already on disk | The protocol is a JSON message loop. A full automation framework is hundreds of transitive packages to measure a box height. |
| Spawning and supervising a process under test | `node:child_process` | Same. |
| Anything that needs a maintained browser build matrix, device emulation, or recorded traces | the full automation framework | This is the line. Past it, the dependency earns itself. |

Two rules for the zero-dependency version, both learned by getting them wrong:

- **Drain or discard the child's stderr.** `stdio: 'pipe'` with nobody reading
  fills the pipe buffer and blocks the process mid-request. The symptom looks
  like a random hang, not a logging bug.
- **Boot a fresh instance per run on a port you chose, and wait for a health
  endpoint rather than sleeping.** A shared or already-running server makes the
  test depend on state you did not set up.

The payoff case: a ~200-line dependency-free driver outranked the application
code it was written to test, on value per line. That is not a normal ratio and
it is worth noticing when it happens — see `../server-rendered-ui/references/headless-measurement.md`.

## Common AI Mistakes to Avoid

| Mistake | Correct |
|---------|---------|
| `npm install` | `pnpm add` |
| `require()` | `import` (ESM) |
| `any` type | `unknown` then narrow |
| `== null` checks | `=== null` or optional chaining `?.` |
| `console.log` for debug | structured logger |
| `JSON.parse(x)` unvalidated | parse then validate with `zod` |
| Callback-style async | always `async/await` |
| Adding `axios` for HTTP | use global `fetch` |
