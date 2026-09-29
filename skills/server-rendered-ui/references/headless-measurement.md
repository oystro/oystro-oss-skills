# Headless Measurement

How to run `assets/cdp.mjs` and turn it into a regression suite. Copy the driver into your
project's test directory; it has no dependencies and nothing in it is executed by a skill
runner.

## Requirements

- Node >= 22 (uses the global `WebSocket`).
- A `chrome-headless-shell` binary. Reuse one already in a Playwright cache, or
  `npx playwright install chromium`. Override the path with `CHROME_HEADLESS_SHELL`.

## Wiring it in

```
test/
  cdp.mjs                 # copied from assets/, unmodified unless you need to
  ui-regressions.mjs      # your checks
Makefile
```

```make
ui: build
	node test/ui-regressions.mjs
```

Put it in `all`. A layout check that is not in the default target is a check that stops
running within a month.

## Booting the app under test

Do not test against a shared or already-running server. Boot a fresh one per run, on a port
you picked, and wait for a health endpoint rather than sleeping.

```js
async function startServer() {
  const port = 9100 + Math.floor(Math.random() * 800);
  const proc = spawn(join(ROOT, 'bin', 'server'), [], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}/healthz`)).ok) {
        return { base: `http://127.0.0.1:${port}`, stop: () => proc.kill('SIGTERM') };
      }
    } catch { /* not up yet */ }
    await sleep(150);
  }
  proc.kill('SIGKILL');
  throw new Error('server did not become healthy');
}
```

Two things that will bite otherwise:

- **Drain or discard stderr.** `stdio: 'pipe'` with nobody reading fills the pipe buffer and
  blocks the server mid-request. The symptoms look like random hangs, not like a logging bug.
- **Kill it in a `finally`.** A failed check that leaves a server running will make the next
  run fail in a way that looks unrelated.

## Two servers, on purpose

If the app has a configurable delay — a think-time, an animation, a debounce — run a second
instance with it raised for the tests that need to observe a transient state.

```js
const slow = await startServer({ env: { DELAY: '750ms' } });
const fast = await startServer();               // default, for everything else
```

A driver that needs both is normal. What is not normal is concluding a state does not render
because you could not catch it.

## Assertion helpers

Keep them dumb and make the failure message carry the numbers. A failure that says
`heights differ` sends someone back to the diff; one that says
`heights differ by 118.0px [143.0, 261.0]` is already the diagnosis.

```js
let checks = 0, failures = 0;

function assertTrue(label, cond, detail = '') {
  checks++;
  if (cond) return console.log(`  ok   ${label}`);
  failures++;
  console.error(`  FAIL ${label}${detail ? ': ' + detail : ''}`);
}

// Decide the tolerance once. Row and border heights legitimately differ by a
// sub-pixel from rounding; do not re-decide per assertion.
function assertUniform(label, values, tolerance = 0.5) {
  const spread = Math.max(...values) - Math.min(...values);
  assertTrue(
    label,
    spread <= tolerance,
    `${spread > tolerance ? 'differ' : 'uniform'} ` +
      `${spread.toFixed(1)}px spread [${values.map((v) => v.toFixed(1)).join(', ')}]`
  );
}
```

## Isolate every test

One timeout must not hide the result of the next check. Give each test its own page and its
own error boundary, and report the totals at the end.

```js
const run = async (name, fn) => {
  try { await fn(); }
  catch (err) { checks++; failures++; console.error(`  FAIL ${name}: ${err.message}`); }
};
```

This matters more than it looks. During one session a single mis-written wait hid the result
of every check after it, and the suite looked like it had passed.

## Budget loops by wall clock

Not by iteration count. The same helper may drive a fast instance and a slow one, and a count
that suits one starves the other into a false "never completes".

```js
async function drive(page, budgetMs = 90000) {
  const start = Date.now();
  while (Date.now() - start < budgetMs) {
    if (await atBoundary(page)) return true;
    await act(page);
  }
  throw new Error(`did not reach a boundary within ${budgetMs}ms`);
}
```

## Respect validity, not position

Automated drivers click whatever is at an index. Applications reject what is not legal. If
the server enforces rules — card suits, form validity, disabled state — a positional click
stalls the flow and the failure surfaces as "the app is broken".

```js
// WRONG: picks element 0 regardless of whether it is usable
document.querySelector(SELECTOR).click();

// CORRECT: ask the page which elements are actionable
[...document.querySelectorAll(SELECTOR)].find((el) => !el.disabled)?.click();
```

## Assert over the whole recorded array

Once you have `__seen` from the MutationObserver pattern in the main skill, most checks are
one reduce. Record the property you care about in each entry and assert over all of them.

```js
const seen = await page.eval('return window.__seen;');
assertUniform('height never changes', seen.map((e) => e.h));
assertTrue('one colour throughout', new Set(seen.map((e) => e.variant)).size === 1,
           [...new Set(seen.map((e) => e.variant))].join(' vs '));
assertTrue('the waiting state appeared', seen.some((e) => e.msg.includes(WAIT_MARKER)));
```

## Proving the test is not vacuous

Before committing a layout fix, revert the fix and confirm the suite goes red. Do this per
fix, not once for the batch — two fixes can mask each other.

| Reverted | Expect |
| --- | --- |
| The one-line CSS that pinned the height | the height assertion fails with the original number |
| The colour that was made constant | the colour assertion fails, listing both values |

If reverting does not fail the suite, the assertion is not measuring the fix. Find out why
before shipping it.

## Screenshots

`browser.screenshot()` returns PNG bytes. An agent usually cannot inspect images, so treat
them as artifacts for a human: attach one per state to the verification report, or diff two.

```js
await writeFile('state-playing.png', await browser.screenshot());
```

If nobody can look at them, do not cite them as evidence. Say the visual claim rests on
computed styles and needs a human eye.

## Runtime

A suite that drives a real flow end to end takes minutes, not seconds. Budget for that in CI
and prefer one long recording pass over many short ones — a single `__seen` array from a full
round answers every invariant at once.
