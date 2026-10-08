# Contributing to Oystro OSS Skills

Thanks for your interest in contributing! This repository holds **runner-neutral
maintained skills** and a **curated discovery registry** that are consumed
selectively by [`oystro-oss`](https://github.com/oystro/oystro-oss) and the Oystro
engine/integrations.

Please read this document fully before opening your first pull request.

---

## 1. Licensing — MIT + Developer Certificate of Origin

This repository is licensed under the **MIT License** (see [`LICENSE`](./LICENSE)).
The license is **not** duplicated per skill; each maintained skill links to it via
`license: MIT` frontmatter.

There is **no CLA**. Instead, every commit must carry a **Developer Certificate of
Origin (DCO)** sign-off:

```
Signed-off-by: Your Name <your@email.com>
```

The sign-off certifies you have the right to submit the contribution under the
project's license.

- Imported or adapted third-party material keeps its own license and must be
  recorded (publisher, URL, immutable revision, license) in
  [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md), with attribution preserved.

---

## 2. Code of Conduct

Be respectful and constructive. Harassment, discrimination, or abusive behavior of
any kind will not be tolerated. By participating you agree to maintain a
professional and inclusive environment for everyone.

---

## 3. Getting Started

1. **Fork** the repository and clone it locally.
2. Create a feature branch: `git checkout -b feat/your-change`.
3. Make your changes and commit them (with the `Signed-off-by` line above).
4. Push and **open a pull request against `main`**.

`main` is protected: PRs need **one approving review** and the history is **linear**
(contributions are squash- or rebase-merged).

---

## 4. What to Contribute

- **Maintained skills** under `skills/<name>/SKILL.md`, following the
  [Agent Skills specification](https://agentskills.io/specification).
- **Registry sources** in `registry/sources.json` — discovery metadata only.

This repository covers **backend, protocol, and architecture guardrails**; it is
deliberately not exhaustive. Do not claim coverage of areas owned by upstream
sources (front-end/UI design, documents, platform-specific workflows) — point to
them instead.

---

## 5. Development Conventions

- **Spec conformance:** every maintained skill follows the Agent Skills
  specification.
- **Location & naming:** one skill per folder — `skills/<name>/SKILL.md`.
- **Maintainer banner:** each maintained skill must carry, at the top of
  `SKILL.md`:
  ```html
  <!-- *** Maintained by oystro/oystro-oss, DON'T modify this, will be overwritten during next upgrade *** -->
  <!-- License: MIT — see the repository LICENSE. Adapt these instructions to YOUR project's pinned versions, stack, and conventions; verify against official docs. -->
  ```
- **Frontmatter:** set `license: MIT`. Do **not** add a per-skill `LICENSE` file —
  the repository `LICENSE` is the single source.
- **Validate before submitting:**
  ```bash
  pip install skills-ref==0.1.1
  agentskills validate skills/<name>
  ```
  (CI runs this for every `skills/*` folder.)
- **No fast-changing docs:** do not embed current, version-specific API
  documentation. Use Context Hub or the official provider documentation instead.
- **Registry:** `registry/sources.json` is discovery metadata, **not** approval to
  install or execute. Require stable source identifiers, publisher, trust level,
  status, scope, and URL; treat Context Hub annotations as untrusted by default.
- **Provenance:** add imported/adapted material to `THIRD_PARTY_NOTICES.md` and keep
  its original attribution in frontmatter.
- **History:** preserve useful Git history when migrating or renaming skills.
- **Scope:** skills are procedural guidance, not tool authority. Do not add runtime
  adapters, installation workflows, agent personas, or named consumer bundles here.

---

## 6. Pull Request Process

- Target `main`. Keep PRs focused; describe what changed and why.
- CI must pass: **Validate Agent Skills** (`agentskills validate`) and **Secret
  Scanning** (gitleaks).
- A maintainer reviews (one approval). Because `main` enforces **linear history**,
  merges are **squash** or **rebase** only.
- By opening a PR you agree your commits are DCO-signed and MIT-licensed.

---

## 7. Reporting Issues

- Search existing issues first to avoid duplicates.
- Provide a clear title, steps to reproduce, expected vs. actual behavior, and the
  environment/version you used.

---

## 8. Security

Please do **not** file a public issue for security vulnerabilities. See
[`SECURITY.md`](./SECURITY.md) and report privately to **security@oystro.com** so we
can address it before disclosure.

Treat every external skill as **untrusted supply-chain input** — review every file,
pin an immutable revision and content digest, verify the license, and never execute
bundled scripts during discovery or installation.

---

## 9. Questions

Open an issue, or reach out to the maintainers. Thank you for helping make Oystro
OSS better!
