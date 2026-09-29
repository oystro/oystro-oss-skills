---
name: oat
description: >
  Use when writing or reviewing HTML/CSS that uses Oat UI. Covers how to derive Oat's real
  class names, variants and custom properties from the vendored source instead of assuming
  them, the structural traps in Oat that silently produce wrong or unstable output, and how
  to customise within Oat's theming rather than beside it. This skill deliberately contains
  no class list: Oat's API changes between versions, so the catalogue lives in your project's
  extension layer and current API detail comes from the vendored source or the official docs.
license: MIT
metadata:
  author: Oystro
  version: "1.0.0"
---
<!-- *** Maintained by oystro/oystro-oss, DON'T modify this, will be overwritten during next upgrade *** -->
<!-- License: MIT — see the repository LICENSE. Adapt these instructions to YOUR project's pinned versions, stack, and conventions; verify against official docs. -->

<!-- EDITORIAL GUIDELINES
- Terse. Use tables and WRONG/CORRECT pairs over prose.
- NO class lists, NO variable tables, NO attribute tables. They go stale silently and are
  the reason this skill was rewritten. Method and traps only.
- Every trap here was observed in a real project, not inferred from docs.
- Framework facts belong in a project extension; see ../server-rendered-ui/references/extension-pattern.md.
-->

## Non-Negotiable Rules

- **Derive, never assume.** Every class, `data-*` attribute, and custom property must come
  from reading the Oat source the project actually vendors. A plausible class name that does
  not exist produces no error, no warning, and no visual hint — it just does nothing.
- **Record what does not exist, not only what does.** The negative findings are what prevent
  a confident wrong guess. An element that accepts a variant attribute but defines no rule
  for it is the single most common Oat trap; see Traps.
- **Customise through Oat's variables and hooks.** If a colour, radius, or spacing needs to
  change, override the variable rather than adding a competing rule. If theming has a
  framework hook (a theme attribute, a class), use it rather than a raw media query.
- **Check Oat before writing custom CSS.** If a primitive exists, use it. Every custom rule
  is a thing to maintain and a thing that can lose a cascade.
- **Current API detail is not here on purpose.** If you need a class list, a variant table,
  or a version number, grep the vendored source or read the official documentation. Do not
  expect this skill to answer it.

## How to Derive the Facts

This is the part that replaces the tables. Run it once per project and record the result in
that project's extension layer, not here.

```bash
# Locate the vendored source
find . -name "*.css" -not -path "*/node_modules/*" | xargs grep -l 'role=alert\|data-variant' 2>/dev/null

# Does this class exist?
grep -o '\.class-name\b' <oat.css> | sort -u

# Everything the framework defines for ONE element — the important query.
# Variants are per element, so a variant list is only valid for the element it came from.
grep -o '\[role=alert\]{[^}]*}' <oat.css>

# What does that element actually accept?
grep -o 'data-[a-z-]*' <oat.css> | sort -u

# Custom properties
grep -oP '\--[a-z0-9-]+' <oat.css> | sort -u

# Declared cascade layer order — decides which of your rules can win
grep -o '@layer [a-z,]*' <oat.css> | head -1
```

Record what you found **with the file and version you read it from**. A fact with no
provenance cannot be re-checked, so it decays without anyone noticing.

## Traps

Each of these produced a wrong result in a real project. All are structural, so they are
stable across versions — but confirm each against the vendored source before relying on it.

| Trap | What actually happens | Do instead |
| --- | --- | --- |
| **Variant not defined for that element** | The attribute is accepted, no rule matches, and the element silently falls back to its base surface. A valid variant on a button can be inert on an alert. | Grep the exact element + variant pair. Never transfer a variant list between elements. |
| **Cascade layer order** | The framework declares its layer order up front. An override placed in a layer declared *earlier* loses, and appears to do nothing at all. | Put overrides in the framework's highest layer, then verify the computed value changed. |
| **A state colour that toggles** | Repainting a whole box to signal a state reads as a flash on every toggle. | One fixed colour; signal state with text, an icon, or position. |
| **Busy/loading pseudo-element** | A framework spinner built as an animated inline pseudo-element sits *in flow*, so it changes the box's size while it spins. | Keep the accessibility attribute, suppress the visual, add a non-reflowing textual indicator. |
| **A role-based component laid out as a flex row** | Children sit side by side, so the box takes the height of the *tallest* child and a single taller child moves everything. | Attribute height to the child you are changing; keep sibling counts and modifier classes consistent across states. |
| **Empty grid tracks reserve nothing** | `repeat(n, auto)` collapses to zero when the tracks are empty, so the "reserved" space is not reserved. | Put a constant number of children in the markup, or give the track a length. |
| **`display: none` reserves nothing** | The slot collapses and the layout loses a row. | `visibility: hidden`, which also leaves the tab order and the accessibility tree. |
| **Spacing utilities are a fixed set** | Only certain steps exist. A missing step is not a no-op you can ignore; the gap silently does not apply. | Use the variables directly for one-off spacing rather than assuming a utility exists. |
| **Dark mode via a framework hook** | A raw `prefers-color-scheme` block fights the framework's own theming and produces two competing schemes. | Use the framework's theme hook and override variables inside it. |
| **No colour utility classes** | Oat has no `text-danger`-style classes. Reaching for one produces an unstyled span that looks like a styling bug. | Use the variable, or a one-line project class. |

## Customising

- **Override variables, do not fork rules.** Load project CSS after the framework and set the
  custom properties you need. This keeps the change inside Oat's theming and survives upgrades.
- **Prefer the framework's composition over new markup.** Existing primitives plus variables
  cover most needs; a custom component is a maintenance commitment.
- **Keep custom CSS small and attributable.** A handful of documented declarations is
  maintainable. A parallel design system in the project stylesheet is not, and it will lose
  cascade fights it does not realise it is having.
- **Count the `!important` you add.** It is a reliable signal of a losing cascade. If a rule
  needs one, the fix is usually layer placement, not the override.

## Migrating Custom CSS Onto Oat

The method generalises; the specific mappings are version-specific, so derive them.

| Instead of | Look for |
| --- | --- |
| A custom button class | The framework's button primitive, plus its variant attribute and outline/ghost modifiers |
| Custom badge or pill classes | The badge primitive with a variant attribute |
| A custom alert or callout box | The alert role with a variant attribute |
| Custom table or grid markup | The framework's stack/row layout primitives |
| A custom "active row" or "selected" class | A native state attribute the framework already styles |
| Colour utility classes | The colour variable |

Verify each mapping against the vendored source. A mapping table written from memory is the
exact failure this skill exists to prevent.

## Related

- `../server-rendered-ui/SKILL.md` — building and measuring Oat-based UIs that do not flicker
  or jump. Read this alongside this skill for any layout-stability work.
- `../server-rendered-ui/references/extension-pattern.md` — how to record this project's
  verified Oat facts with provenance, so they do not have to live here.
- Current API detail: the vendored `oat.css` and the official Oat documentation.
