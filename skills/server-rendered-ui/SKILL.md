---
name: server-rendered-ui
description: >
  Build and verify server-rendered, SSE-driven UIs that do not flicker, jump, or repaint.
  Domain-agnostic. Use when a UI is rendered on the server and pushed or patched over the
  wire, and whenever a report says the page "flickers", "jumps", "shifts", "changes size",
  "changes colour", or "is not smooth". Covers how to measure layout in a real browser,
  which CSS and delivery traps cause instability, and how to record transient states that
  polling will miss. Project-specific framework facts belong in an extension layer, not
  here - see references/extension-pattern.md.
license: MIT
metadata:
  author: Oystro
  version: "1.0.0"
---
<!-- *** Maintained by oystro/oystro-oss, DON'T modify this, will be overwritten during next upgrade *** -->
<!-- License: MIT — see the repository LICENSE. Adapt these instructions to YOUR project's pinned versions, stack, and conventions; verify against official docs. -->

<!-- EDITORIAL RULES
- Terse. Tables and WRONG/CORRECT pairs over prose.
- No framework class names, no library attributes, no API signatures. Those are
  extension-layer facts and go stale. This file is method only.
- Every trap listed here was observed and measured, not theorised.
- If you cannot measure it, you have not verified it. Say so.
-->

## Non-Negotiable Rules

1. **Measure before you fix.** Get a number for the current behaviour and a number for the
   fixed behaviour. A layout bug reported as "it jumps around" has never been diagnosed
   until every candidate cause has a measured height, position, or computed style.
2. **Measure the element the user sees.** A wrapper whose height tracks its tallest child
   will report a change when nothing visible moved. Measure the visible box, and measure
   the wrapper separately if you need to.
3. **Static endpoints are not transitions.** Sampling the UI once per state proves the
   states agree. It says nothing about the frames between them. Record every state the DOM
   passes through.
4. **Never let colour carry state that layout should carry.** If a box changes colour to
   signal a state, it will read as a flash every time the state toggles. Signal state with
   text, an icon, or position, and hold the colour still.
5. **Revert each fix and confirm the test fails — one fix at a time.** A regression
   test that passes against the broken code is worse than no test, because it
   reports safety that is not there. Reverting the whole set proves nothing:
   two fixes can mask each other, so the suite can pass with both broken. Revert
   one, confirm red, restore, repeat.
6. **Prefer the value that already dominates.** When collapsing several values into one,
   pick the one the UI already shows most often, not the one that reads as semantically
   correct. A one-line change that preserves the common appearance beats a redesign.
7. **Fix the harness before you believe it.** A surprising result is far more often a bug
   in the measuring code than a finding. See "Harness bugs that produced fake results".
8. **A flag that changes timing also changes what is observable.** A test or dev flag
   that shortens a delay, skips a step, or forces a fast path also removes states
   from the client — so any conclusion you draw under it is about the flag, not
   the product. This invalidates conclusions about transient states specifically,
   because the states are what the flag removed. Measure the real timing at least
   once, in a second instance, before believing a "this never renders" result.

## What "Stable" Means

Write these down as invariants before touching code. Each is a measurement, not a feeling.

| Invariant | Measured as | Passes when |
| --- | --- | --- |
| Box does not resize | `getBoundingClientRect().height` of the visible box | identical across every state |
| Anchor does not move | `.top` / `.left` of a reference element | identical across every state |
| Row does not reflow | height of every row in a list | max − min is 0 or sub-pixel |
| Colour does not repaint | `getComputedStyle().backgroundColor` | identical across every state |
| Content is reachable | every state observed at least once | a state you never saw is not a state you tested |

Two tolerances are worth deciding explicitly and writing down:

- **Sub-pixel.** Row and border heights legitimately differ by 0.5px from rounding. Decide
  once whether that counts, and do not re-decide per assertion.
- **States you cannot reach.** If a state only appears under a condition your driver does
  not produce, you have not tested it. Either drive the condition or state the gap.

## Diagnostic Order

Work in this order. Each step is cheap and eliminates a class of cause.

1. **Reproduce as a number.** Drive the real flow in a headless browser. Record the box
   height, the anchor position, and the computed background for each state you can reach.
2. **Enumerate the states, including the ones you think are unreachable.** Terminal states
   are not exempt. In one case the odd state out was the *end of the game*, which had been
   written off as "occurs once" and was 118px taller than everything else.
3. **Find what actually keys the change.** Read the template. Do not infer the condition
   from the variable name that looks responsible. In one case the colour was assumed to be
   keyed on whose turn it was, and was in fact keyed on the game phase, which changed it
   twice per round instead of once per turn.
4. **Attribute the height.** For a box whose height moved, find which child grew. Compare
   the children's heights across states. A flex row takes the height of its tallest child,
   so one taller child moves the whole box regardless of the others.
5. **Only then fix**, and change one cause at a time.

## Recording Transient States

The most common measurement failure is trying to catch a state that lives for a few hundred
milliseconds by polling for it. Polling proves nothing about states you miss.

Install a recorder **before** the action that triggers the state:

```js
await page.eval(`
  window.__seen = [];
  const rec = () => {
    const el = document.querySelector(SEL);
    if (!el) return;
    const entry = { text: el.innerText.trim(), h: el.getBoundingClientRect().height };
    const last = window.__seen[window.__seen.length - 1];
    if (!last || last.text !== entry.text) window.__seen.push(entry);
  };
  new MutationObserver(rec).observe(document.body, {
    subtree: true, childList: true, characterData: true,
  });
  rec();
  return 1;
`);

// ... perform the action, then outlast the transition ...

const seen = await page.eval('return window.__seen;');
```

Then assert over the whole array: every height equal, every colour equal, and the states you
expected actually present. One recorded array answers all of it at once.

Two things this catches that endpoint sampling cannot:

- A state that alternates many times per round. Nine alternations at one height and one
  colour is a much stronger statement than four agreeing snapshots.
- A state that only appears under a condition, which then tells you what to drive.

### Shrink or slow the transition for observation

If a state is too brief to observe, do not conclude it does not happen. Two options, and
prefer the second:

- Disable the delay in the server under test so the state is wider. Only valid if the delay
  is not what you are testing.
- **Run a second instance of the app with the delay raised.** Same binary, different
  environment. A driver that needs a slow instance for one test and a fast instance for the
  rest is normal and worth the extra server.

## Framework-Agnostic Traps

Verified causes, in rough order of how often they turned out to be the real one.

| Trap | Why it destabilises | Fix |
| --- | --- | --- |
| `transition: all` | animates properties you did not intend, including ones that affect layout | name the properties |
| Cascade layer order | an override in a later-declared layer silently loses to the framework's own rule; the override appears to do nothing | put overrides in the highest layer, then verify it took effect |
| Variant/attribute not defined for that element | falls back to the base surface, which is often opaque and a different colour from every other variant | grep the framework source for that exact element + variant pair |
| State signalled by background colour | repaints the whole box on every toggle | one fixed colour; signal state in text or an icon |
| Busy/loading pseudo-element spinner | an animated inline-block pseudo-element is in flow, so it changes the box while it spins | suppress the visual, keep the accessibility attribute |
| Font loaded from a network | first paint uses a fallback, then reflows | self-host, or reserve the space |
| `background-attachment: fixed` | repaints on scroll and behaves differently across viewports | remove it |
| `grid-template-rows: repeat(n, auto)` to reserve space | empty `auto` tracks collapse to zero | put a constant number of children in the markup |
| `display: none` to reserve a slot | reserves nothing | `visibility: hidden`, which also leaves the tab order and the a11y tree |
| Centred layout above a content threshold | centring silently stops applying once content exceeds the viewport, which is the jump | align to a fixed edge |
| Variable child count across states | the box height is the tallest child, so one state with fewer children is shorter | constant child count, placeholder for the absent one |
| Child count varying by modifier class | two children with different heights do not form a stable row | match the modifier on the placeholder too |

## Delivery Traps

Applies to any server-rendered UI pushed or patched over the wire.

| Trap | Symptom | Fix |
| --- | --- | --- |
| Two-stage first paint | the shell paints, then the real content arrives and everything moves | render the first state on the server |
| Duplicate delivery to the acting client | the same state is applied twice, sometimes with a visible re-render | deliver once, or version the state and let the client drop stale updates |
| No gap detection | a dropped update leaves the UI permanently wrong with no signal | monotonic version per state, client compares |
| Server work done synchronously inside a request | intermediate states never exist on the client, so waiting is invisible to the user | if the user waits, render the waiting state |
| Patch scoped too narrowly | part of the page updates and the rest does not, which reads as a flicker | patch the smallest region that is genuinely self-contained, and measure that region |

## After the Fix: Separate Load-Bearing From Incidental

The suite is green. That is the point to review the design, because the fix has
just made several decisions look justified that were only ever accidents of the
old layout. Judge from measured behaviour, not from the fact that it now works.

| Verdict | Meaning | Action |
| --- | --- | --- |
| **Load-bearing** | The invariant holds because the structure guarantees it | Keep. This is the win. |
| **Incidental** | It holds for reasons unrelated to the structure | Fine, but do not build on it |
| **Load-bearing by accident** | A hack that now carries a real invariant | Document it *and* file the structural fix |

The third row is the one worth hunting for. Placeholders, fixed heights,
reserved slots, and counters that exist because something else once leaked tend
to absorb an invariant during a fix and then quietly become the reason nobody
dared change them. The giveaway is a construct whose stated purpose no longer
matches what it is doing.

Two reviews are worth writing down, because both change what you build next:

- **What was the most valuable artefact?** Often the answer is the measurement
  harness, not the application. A harness that turned "it flickers" into numbers
  and found causes reading the code had missed is core tooling — keep it in the
  default build target, treat it as a maintained component, and do not file it
  as a test detail.
- **What is now a symptom?** Every item in the *load-bearing by accident* row is
  a follow-up. Order them by observed value, not by how annoying they feel, and
  resist starting them piecemeal — if two of them share a root cause, doing one
  without the other is the incoherent option.

## Accessibility Is Not Optional

When you suppress a framework's loading indicator to stop a reflow, keep the semantic
attribute and add a non-reflowing textual signal. A suppressed spinner plus `aria-busy`
leaves a screen-reader user with an unchanging box that appears to be stuck. A glyph in the
message text costs no layout and restores the signal.

## Harness Bugs That Produced Fake Results

Each of these produced a confident, wrong conclusion. Check for them before believing a
measurement.

| Bug | Wrong conclusion it supported | Rule |
| --- | --- | --- |
| Polling a state that lives a few hundred ms | "this markup is dead" | record mutations, don't poll |
| Polling slower than the state | "this state never renders" | shrink or slow the transition first |
| Clicking the first element in a list | "the action does not work" | respect `disabled` and validity; the server may reject the rest |
| Waiting on a substring that matches two states | the driver acted during the wrong state | match the exact state, not a shared word |
| Bounding a loop by iteration count | "the flow never completes" when it just needed more steps | bound by wall clock, not iterations |
| Measuring a wrapper instead of the visible box | a phantom 118px change | measure the box the user sees |
| Deriving a count from a rect divided by a line height | nonsense values, silently | assert the property you care about directly |

## Anti-Patterns

- Fixing a flicker by adding a transition. This hides a discrete change and adds motion.
- Adding a fixed `min-height` to paper over a child that changes height. The child still
  moves inside the box.
- Treating a terminal state as exempt from invariants. It is usually the one that differs.
- Asserting on a state the driver never reached, and reporting the suite green.
- Declaring victory from a screenshot nobody looked at. If you cannot inspect images, say
  the visual claim rests on computed styles and needs a human eye.

## References

- `references/headless-measurement.md` — zero-dependency driver, and how to wire it into a
  build.
- `references/extension-pattern.md` — how to layer project-specific framework facts on top
  of this skill without making it stale. Read before adding any class name or attribute.
- `assets/cdp.mjs` — drop-in driver, no npm dependencies.
