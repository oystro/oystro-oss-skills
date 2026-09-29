# Repository rulesets

Importable rulesets for this repository. GitHub organization-level rulesets require a paid plan,
so these are applied per repository.

Apply after the repository is created in the `oystro` org:

```bash
gh api -X POST /repos/oystro/oystro-oss/rulesets --input .github/rulesets/main.json
gh api -X POST /repos/oystro/oystro-oss/rulesets --input .github/rulesets/tags.json
```

- `main.json` — protects the default branch: pull request with 1 approval, stale-review
  dismissal, required status checks, linear history, no force-push, no deletion.
- `tags.json` — protects release tags (`v*`) from deletion or rewrite.
