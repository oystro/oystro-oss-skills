# Extension Pattern

How to add project-specific knowledge to a canonical skill without turning the canonical
skill into a liability.

## The Problem

A skill that lists real class names is useful for exactly one project and one version of one
framework. The moment the framework is upgraded, every name in it is a guess wearing the
authority of a document. The failure mode is worse than having no skill: an agent reads
`.toast.tight` in a reference, writes it into a template, and nothing renders, with no error
anywhere.

So: **method goes in the canonical skill, facts go in an extension.** A fact is anything that
could be wrong about a specific project. A method is anything that stays true when the project
changes.

| Belongs in canonical (method) | Belongs in an extension (fact) |
| --- | --- |
| "a variant not defined for an element falls back to the base surface" | "the alert element defines these four variants" |
| "record mutations, do not poll for transient states" | "the busy attribute is spelled this way here" |
| "measure the box the user sees, not its wrapper" | "the box the user sees is this selector" |
| "grep the vendored source before using a class" | the list of classes that grep returned |
| "a synchronous server step hides the waiting state" | "this endpoint does its work synchronously" |

## Layering

```
canonical skill              method only, no names, ages slowly
  └── references/            how to measure, how to extend
extensions/<project>/        verified facts, pinned to a source and a date
  └── SKILL.md
```

The canonical skill points at the extension layer. It never inlines it.

## Writing an Extension

### 1. Derive the facts, do not recall them

Read the vendored source. Every fact records where it came from.

```bash
# find the vendored framework
find . -name "*.css" -path "*vendor*" -o -name "*.css" -path "*assets*" | grep -v node_modules

# what does this exact element actually define?
grep -o '\[role=alert\]{[^}]*}' <path>          # then read the variant list inside it
grep -oP '\.\w+(?=\s*\{)' <path> | sort -u       # class names
grep -oP 'data-[\w-]+' <path> | sort -u          # data attributes
grep -oP '\--[\w-]+' <path> | sort -u            # custom properties
```

### 2. Record provenance, not just content

```markdown
Verified against `web/assets/framework.css` @ <commit or version>, <date>.
Re-verify after any dependency bump: `make verify-facts`
```

A fact without provenance cannot be re-checked, so it decays silently.

### 3. Prefer the negative findings

The most valuable facts are the ones that stop a plausible mistake. A list of what *is*
available invites confident use; a list of what is *not* defined for a given element prevents
a wrong guess that no error message would catch.

Record these explicitly:

- Variants defined for element A but **not** element B, even though both accept the
  attribute.
- Attributes that exist but behave differently depending on the parent's state.
- Classes whose effect depends on a modifier that must be matched, or the row height moves.
- Anything that only works because a specific ancestor is present.

### 4. Keep the extension about facts

When you catch yourself writing "always do X" in an extension, it belongs in the canonical
skill. Extensions answer *what exists here*; the canonical skill answers *what to do*.

## The Correction Loop

The most valuable content in an extension is what a mistake taught you. When a run gets
something wrong, add a WRONG/CORRECT pair to the extension immediately, in the same commit as
the fix.

```markdown
| WRONG | CORRECT | Why |
| --- | --- | --- |
| assumed the box colour was keyed on whose turn it was | it is keyed on the game phase, so it changed twice per round | read the template instead of inferring from the variable name |
| clicked the first card in hand | click the first card without `disabled`; the server rejects the rest | validity is enforced server-side |
```

A canonical skill accumulates these too, but **stripped of the project nouns**. The mistake
generalises; the class name does not. Both copies are worth having: the general one prevents
the reasoning error, the specific one prevents the exact wrong edit.

## When the Extension and Canonical Skill Disagree

The canonical skill's method wins on method; the extension wins on facts. If a fix in the
canonical skill assumes a framework behaviour, that assumption is a fact and belongs in the
extension, and the canonical skill should be reworded to not depend on it.

Concretely: if the canonical skill says "suppress the busy pseudo-element", and in your
project the busy attribute is spelled differently or does not exist, the canonical skill is
still right and your extension supplies the spelling. If instead the *approach* does not work
in your project, that is a finding about the approach — fix the canonical skill and say so in
its history.

## Review Cadence

| Trigger | Action |
| --- | --- |
| Dependency bump | re-derive every fact; delete anything no longer found by the grep |
| A fact was wrong in a run | add the WRONG/CORRECT pair; find the other facts from the same source and re-verify them too |
| A run needed a fact the extension lacks | add it, with provenance |
| The project drops the framework | delete the extension; the canonical skill still applies |

The failure mode to avoid is an extension that has never been re-verified. It reads exactly
like a fresh one.
