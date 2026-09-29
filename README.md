# Oystro OSS Skills

Runner-neutral skills and a curated upstream skill-source registry consumed
selectively by `oystro-oss` and the Oystro engine/integrations.

## Contents

- `skills/`: skills maintained and evaluated by this project.
- `registry/sources.json`: upstream publisher repositories and discovery services.

Maintained skills follow <https://agentskills.io/specification>.

Skills are selected and installed conditionally based on detected technology stack and task requirements. Consuming projects install only what they need and must never install the full registry or treat it as a bulk bundle.

Maintained skills in `skills/` are maintainer-owned and overwritten on upgrade. Project-specific corrections and overrides live exclusively within the consuming project's local copy (`.oystro-oss/skills/<name>/SKILL.md`).

Current, version-specific API documentation does not belong in this repository.
Use Context Hub or the official provider documentation when current API knowledge
is required.

Listing an upstream source does not approve, install, or execute its skills.

Runtime-specific discovery, installation, authorization, and project-owned modification preservation belong to each consuming harness or extension.

## Complementary skills

This repository covers **backend, protocol, and architecture guardrails**; it is deliberately not
exhaustive. For areas we do not cover — front-end/UI design, documents, and platform-specific
workflows — use the upstream publisher repositories listed in `registry/sources.json`, for example:

- Anthropic — <https://github.com/anthropics/skills> (creative & design, documents, enterprise)
- Vercel — <https://github.com/vercel-labs/agent-skills> (web / UI)
- OpenAI, Google Gemini, Microsoft Azure, Hugging Face — see the registry

Listing a source is discovery metadata, **not** endorsement or approval to install or execute it.

## Adapt to your project

Skills here are **procedural starting points**, not drop-in scripts. The consuming agent MUST
adapt them to the project's own context — pinned versions, stack, and conventions — and verify
against the official documentation. Never copy a skill verbatim into a project. Project-specific
corrections and overrides live only in the consuming project's local copy
(`.oystro-oss/skills/<name>/SKILL.md`); do not edit the maintained skills.

## Security & Pre-Commit Setup

To prevent accidental secret leaks, configure the repository git hooks:
```bash
git config core.hooksPath githooks
```
This activates `githooks/pre-commit` to deterministically block sensitive filenames and run `gitleaks protect --staged`.

## License

Copyright (c) 2026 Oystro Technologies.

All skills in this repository are licensed under the **MIT License** — see [`LICENSE`](LICENSE)
and each skill's `license:` frontmatter. The license is **not** duplicated per skill folder.
Imported or adapted third-party material keeps its own license and is recorded in
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

See [`DISCLAIMER.md`](DISCLAIMER.md) for the warranty and liability disclaimer.
