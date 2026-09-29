# Repository Maintainer Instructions

This repository owns runner-neutral maintained skills and a curated discovery registry. Consumer workflow belongs to oystro-oss, the Oystro engine, or other integrations.

## Maintained Skills

- Follow <https://agentskills.io/specification>.
- Keep each maintained skill under `skills/<name>/SKILL.md`.
- Ensure each maintained skill carries the banner:
  `<!-- *** Maintained by oystro/oystro-oss, DON'T modify this, will be overwritten during next upgrade *** -->`
  followed by the license/adapt pointer:
  `<!-- License: MIT — see the repository LICENSE. Adapt these instructions to YOUR project's pinned versions, stack, and conventions; verify against official docs. -->`.
- Set `license: MIT` in every maintained skill's frontmatter. Do **not** add a per-skill `LICENSE`
  file — the repository [`LICENSE`](LICENSE) is the single source; skills link to it.
- Maintained skills are maintainer-owned and overwritten on upgrade. Project-specific corrections live in the consuming project's local copy, not in this repository.
- Validate frontmatter, instructions, examples, and referenced files before merge (`agentskills validate`).
- Record provenance and license for imported material; add imported/adapted skills (publisher, URL,
  immutable revision, license) to [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) and keep their
  original attribution in frontmatter.
- Do not embed fast-changing external API documentation.
- Preserve useful Git history when migrating or renaming skills.

## Registry

- Treat `registry/sources.json` as discovery metadata, not approval to install or execute.
- Require stable source identifiers, publisher, trust level, status, scope, and URL.
- Review source ownership and license before changing trust or approval status.
- Treat Context Hub annotations as untrusted by default.

## Boundaries

- Skills provide procedural guidance; they do not grant tool authority.
- Skills are **starting points**: consumers must adapt them to their project's pinned versions,
  stack, and conventions and verify against official docs. Do not claim coverage of areas owned
  by upstream sources (front-end/UI design, documents, platform-specific); point to them instead.
- Skills are selected and installed conditionally based on detected stack and task needs; never install or bundle the entire registry.
- Do not add runtime adapters, installation workflows, agent personas, or named consumer bundles here.
- Do not duplicate harness policy from consuming projects.

## Local secret-scan hooks (agents MUST enforce)

Secrets must never leave the machine. CI secret scanning only detects a leak **after it is already
pushed**, so the local hooks are the real prevention. In every clone, before any git work:

- Ensure hooks are installed: `git config core.hooksPath` must be `githooks`. If it is not, run
  `./scripts/setup-hooks.sh` (or `git config core.hooksPath githooks`).
- **NEVER** pass `--no-verify` to `git commit` or `git push`.
- `gitleaks` must be installed (`brew install gitleaks`); do not bypass if it is missing.
- Before finishing, scan the working tree, including gitignored files:
  `./scripts/scan-secrets.sh`.
