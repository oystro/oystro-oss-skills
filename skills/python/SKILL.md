---
name: python
description: >
  Always activate when writing Python code in this project. Overrides pretrained
  Python habits with project-specific conventions.
  Use when creating modules, writing tests with pytest, defining types, or packaging.
license: MIT
metadata:
  author: Oystro
  version: "1.0.0"
---
<!-- *** Maintained by oystro/oystro-oss, DON'T modify this, will be overwritten during next upgrade *** -->
<!-- License: MIT — see the repository LICENSE. Adapt these instructions to YOUR project's pinned versions, stack, and conventions; verify against official docs. -->


<!-- EDITORIAL: Only project-specific rules and common AI mistakes. Not a Python tutorial. -->

## Non-Negotiable Rules

- Use `uv` for all package management — never `pip install` directly
- Type hints on all public functions — `ty --strict` must pass
- Tests in `tests/` with pytest — never `unittest`
- `pyproject.toml` is the only config file — no `setup.py`, no `setup.cfg`
- Use `src/` layout: source code lives in `src/<package>/`
- **Prefer std lib** — do not add a third-party dependency when the standard library covers the need

## Project Layout

```
src/<package>/    ← source code
tests/            ← pytest tests (mirrors src/ structure)
pyproject.toml    ← all config (build, lint, test, typecheck)
uv.lock           ← pinned lockfile, always committed
```

## Modern Toolchain

```toml
# pyproject.toml
[project]
requires-python = ">=3.12"

[tool.ty]          # ty — fast type checker
strict = true

[tool.ruff]
target-version = "py312"
line-length = 100

[tool.ruff.lint]
select = ["E", "F", "I", "N", "UP", "B", "A", "SIM"]

[tool.pytest.ini_options]
testpaths = ["tests"]
addopts = "-v --tb=short"
```

```bash
uv run ruff check .              # lint
uv run ruff format .             # format
uv run ty check .                # typecheck
uv run pytest                    # test
```

## Type Hints

- Use `str | None` instead of `Union[str, None]`
- Use `Protocol` over ABC for structural typing
- Use `dataclass` or `pydantic.BaseModel` for data structures — never plain dicts for structured data

```python
# CORRECT
def process(items: list[str], limit: int = 10) -> dict[str, int]:
    ...
```

## Test Conventions

- Coverage target: >80% (`uv run pytest --cov`)
- Use `tmp_path` fixture for temp files — never hardcode paths
- Use `monkeypatch` fixture for environment/mocking — not `unittest.mock`

```python
import pytest

@pytest.mark.parametrize("input,expected", [
    ("hello", "HELLO"),
    ("", ""),
])
def test_upper(input: str, expected: str) -> None:
    assert upper(input) == expected

@pytest.fixture
def db(tmp_path):
    db = Database(tmp_path / "test.db")
    yield db
    db.close()
```

## Configuration & Secrets

```python
# CORRECT — secrets from ~/.config/<app>/ (or Windows APPDATA / USERPROFILE fallbacks), env vars for non-secrets
from pathlib import Path
import os
import yaml
from dataclasses import dataclass

@dataclass
class Config:
    port: int
    log_level: str
    database_url: str
    api_key: str

def load_config() -> Config:
    # 1. Load secrets from standard config directory (handling Windows fallback)
    config_path = Path(os.environ.get("APPDATA", Path.home() / ".config")) / "myapp" / "config.yaml"
    if not config_path.exists() and "USERPROFILE" in os.environ:
        config_path = Path(os.environ["USERPROFILE"]) / ".config" / "myapp" / "config.yaml"

    secrets: dict = {}
    if config_path.exists():
        secrets = yaml.safe_load(config_path.read_text()) or {}

    # 2. Override non-secrets from env vars
    return Config(
        port=int(os.environ.get("PORT", secrets.get("port", 3000))),
        log_level=os.environ.get("LOG_LEVEL", secrets.get("log_level", "info")),
        database_url=secrets.get("database_url", ""),
        api_key=secrets.get("api_key", ""),
    )
```

**Directory structure:**
- Unix: `~/.config/<app-name>/config.yaml`
- Windows: `%APPDATA%\<app-name>\config.yaml` (fallback: `%USERPROFILE%\.config\<app-name>\config.yaml`)

## Structured Logging

Use standard library `logging` with structured extra dict — never `print()` for operational logs.

```python
import logging
logger = logging.getLogger(__name__)

# CORRECT — structured
logger.info("server started", extra={"addr": addr, "port": port})
logger.error("request failed", extra={"err": str(err), "path": request.path})
logger.exception("database query failed") # captures traceback automatically

# WRONG
print(f"server started on {addr}:{port}")
```

## Std Lib First

| Need | Std Lib Package | Do NOT use |
|------|----------------|------------|
| HTTP client | `urllib.request` | requests (for simple GETs) |
| JSON | `json` | orjson |
| CLI | `argparse` | click |
| Logging | `logging` | loguru |
| Path handling | `pathlib.Path` | os.path |
| Date/time | `datetime` | arrow, pendulum |
| Dataclasses | `dataclasses` | attrs |

## Common AI Mistakes to Avoid

| Mistake | Correct |
|---------|---------|
| `pip install X` | `uv add X` |
| `requirements.txt` | `pyproject.toml` + `uv.lock` |
| `from typing import List, Dict` | `list[str]`, `dict[str, int]` (3.9+) |
| Mutable default args `def f(x=[])` | `def f(x: list \| None = None)` |
| `os.path.join(...)` | `pathlib.Path(...)` |
| `print()` for logging | `logging.getLogger(__name__)` |
| Bare `except:` | `except SpecificError:` |
| Adding `requests` for simple HTTP | `urllib.request` |
| Adding `click` for simple CLI | `argparse` |
