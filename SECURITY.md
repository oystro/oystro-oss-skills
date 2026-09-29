# Security Policy

Treat every external skill as untrusted supply-chain input, including skills in
publisher-owned repositories.

- Review every file, not only `SKILL.md`.
- Pin an immutable revision and content digest.
- Verify the license before installation or redistribution.
- Show update diffs before writing project files.
- Never execute bundled scripts during discovery or installation.
- Keep project overrides separate from upstream content.
- Support quarantine and revocation.
- Do not treat `allowed-tools` as an enforceable security boundary.

Runtime policy remains authoritative for filesystem, shell, network, secrets,
and deployment access.

