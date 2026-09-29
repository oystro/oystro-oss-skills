---
name: git
description: >
  Always activate for all git operations in this project — branching, committing,
  creating PRs. Enforces the oystro branching model and commit conventions.
  Use when creating branches, writing commit messages, or creating pull requests.
license: MIT
metadata:
  author: Oystro
  version: "1.0.0"
---
<!-- *** Maintained by oystro/oystro-oss, DON'T modify this, will be overwritten during next upgrade *** -->
<!-- License: MIT — see the repository LICENSE. Adapt these instructions to YOUR project's pinned versions, stack, and conventions; verify against official docs. -->


## Worktree-First Workflow (Default for Parallel Agents)

Parallel agents working across different terminal windows MUST use **isolated Git worktrees** instead of switching branches in the root working directory. This guarantees zero filesystem collisions, independent test executions, and unpolluted working trees.

### 1. Worktree Creation (Start of Task/Feature/Change)

```bash
# Ensure root is up to date
git fetch origin

# Create an isolated worktree for a feature or change
git worktree add .worktrees/<slug> -b feature/<FID>-<slug> origin/main
# or for a change request:
# git worktree add .worktrees/<slug> -b change/CHG-NNN-<slug> origin/main

# Navigate into the isolated worktree
cd .worktrees/<slug>
```

- Each agent works **only inside its assigned worktree directory**.
- Root directory remains clean on `main`.

### 2. Worktree Lifecycle & Teardown (Post-Release/Merge)

```bash
# Return to root repository
cd ../..

# Remove the worktree directory once feature or change is released or merged
git worktree remove .worktrees/<slug>

# Prune stale tracking references
git worktree prune
```

---

## Branch & Worktree Naming Conventions

Aligned with the `oystro-oss` protocol contract:

| Track | Worktree / Branch Pattern | Purpose | Protocol Command |
|---|---|---|---|
| Feature | `feature/<FID>-<slug>` | Planned feature implementation | `/oystro:define` |
| Change Request / Defect | `change/CHG-NNN-<slug>` | Bounded change request or bug fix | `/oystro:change` |
| Hotfix | `hotfix/<id>-<slug>` | Critical release fix directly against main | Emergency only |

## Commit Message Convention

```
<type>(<id>): <description>

Types:
  feat     — feature implementation (task-level)
  test     — test code
  fix      — bug or defect fix
  spec     — harness artefacts (spec, design, tasks, acceptance)
  verify   — verification report
  chore    — STATUS.md, branch cleanup, dependency bumps
  hotfix   — P0 critical fix
  docs     — documentation only

Examples:
  feat(F001): implement user authentication service - task 1.1
  test(F001): unit tests for user token validation - task 1.2
  fix(CHG-002): prevent connection pool deadlock under concurrent load
  spec(F002): proposal and design for notification engine
  verify(F001): all 4 acceptance criteria passing - ready for review
  chore: STATUS.md — F001 done, 3/5 tasks complete
  hotfix(HOT-001): correct boundary check in memory buffer allocator
```

## PR Rules

- **Feature → Main**: title `feat(<FID>): <title> [VERIFIED]` · label `feature,verified`
- **Change → Main**: title `fix(CHG-NNN): <title> [VERIFIED]` · label `change,verified`
- **Hotfix → Main**: title `hotfix(HOT-NNN): <title> [P0]` · label `hotfix,p0`

## Post-Merge Cleanup (always)

```bash
git checkout <base-branch>
git pull origin <base-branch>
git branch -d <merged-branch>
git push origin --delete <merged-branch>
```

## Common Mistakes to Avoid

| Mistake | Correct |
|---------|---------|
| Committing directly to `main` | Always PR (or local merge after review) |
| Bypassing worktree isolation | Always isolate work in `.worktrees/<slug>` |
| Forgetting to delete merged branches | Always delete after merge |
| `git commit -m "fix"` | Full commit message with type and ID |
| `git push --force` on shared branches | Never force push to main or shared branches |
| Merge commit messages | Use PR title — squash or rebase merge |

## .gitignore (required in every repo)

```gitignore
# Secrets — never commit
*.env
.env
.env.*
config.yaml
config.yml
*.key
*.pem
secrets/

# Build artifacts
bin/
dist/
coverage.out
*.test
*.prof

# OS
.DS_Store
Thumbs.db

# Agent Worktrees
.worktrees/

# IDE
.idea/
.vscode/
*.swp
```

**Agent rule:** Before every commit, check `git diff --cached` for secrets, credentials, API keys, or config files. If found, abort the commit and warn the user.
