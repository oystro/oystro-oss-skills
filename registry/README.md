# Upstream Source Registry

`sources.json` indexes repositories and services worth searching when locally
maintained skills do not cover a task. It indexes sources rather than copying
every external skill.

Registry lookup must never install automatically:

```text
search -> inspect -> review all files -> scan -> verify license
-> pin revision and digest -> preview -> authorize -> install -> evaluate
```

Trust values describe provenance, not safety:

- `publisher`: maintained in the apparent publisher organization.
- `candidate`: useful discovery source requiring further review.

