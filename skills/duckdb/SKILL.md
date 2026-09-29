---
name: duckdb
description: >
  Design, implement, and review DuckDB and DuckLake data access in Python,
  including storage-role selection, parameterized SQL, Polars interchange,
  transactions, concurrency, DuckLake constraints, snapshots, time travel,
  maintenance, and idempotent writes. Use for projects that embed DuckDB,
  attach DuckLake catalogs, query Parquet, or replace pandas-style transforms
  with SQL or Polars.
license: MIT
metadata:
  author: Oystro
  version: "1.0.0"
---
<!-- *** Maintained by oystro/oystro-oss, DON'T modify this, will be overwritten during next upgrade *** -->
<!-- License: MIT — see the repository LICENSE. Adapt these instructions to YOUR project's pinned versions, stack, and conventions; verify against official docs. -->


# DuckDB and DuckLake

## Establish Storage Roles First

Do not assume every DuckDB project uses the same persistence model.

| Component | Typical role |
|-----------|--------------|
| DuckDB in-memory connection | Embedded query and transformation engine; state ends with the connection unless external data is written. |
| DuckDB file connection | Embedded persistent analytical database. |
| DuckLake | Lakehouse tables stored as Parquet with transactional catalog metadata and snapshots. |
| SQLite or another catalog database | May hold DuckLake metadata or unrelated application state; do not treat it as application data without project evidence. |

Read project architecture and configuration before choosing among these roles. Preserve an existing project decision unless the task explicitly changes it.

## Connect Explicitly

Create connection objects instead of relying on DuckDB's shared module-level connection.

```python
import duckdb

# In-memory engine.
con = duckdb.connect()

# Persistent DuckDB database, when the project chooses DuckDB persistence.
persistent = duckdb.connect("data/analytics.duckdb")

# DuckLake catalog.
lake = duckdb.connect()
lake.execute("ATTACH 'ducklake:metadata.duckdb' AS lake")
```

Close connections explicitly or use context managers.

## Parameterize Values, Validate Identifiers

Use single quotes for SQL string literals and double quotes for identifiers. Prefer `?` placeholders for dynamic values.

```python
rows = con.execute(
    "SELECT * FROM sector WHERE sector_code = ?",
    ["BANK"],
).fetchall()
```

Placeholders cannot bind table names, column names, sort directions, or other identifiers. Resolve identifiers from a code-owned allowlist before interpolation.

```python
ALLOWED_TABLES = {"daily_price", "sector_score"}

def latest_date(con, table: str, sector_code: str):
    if table not in ALLOWED_TABLES:
        raise ValueError(f"unsupported table: {table}")
    return con.execute(
        f"SELECT max(trade_date) FROM {table} WHERE sector_code = ?",
        [sector_code],
    ).fetchone()[0]
```

Never interpolate user-controlled values directly into SQL.

## Use DataFrames Deliberately

DuckDB can query Python DataFrames and Arrow-compatible objects directly. Use the project's selected DataFrame library rather than introducing another one.

For Polars projects:

```python
import polars as pl

input_frame = pl.DataFrame({"sector_id": [1, 2], "score": [86.2, 74.8]})
con.execute("INSERT INTO sector_score SELECT * FROM input_frame")

result = con.execute(
    "SELECT sector_id, score FROM sector_score ORDER BY score DESC"
).pl()
```

Check the installed DuckDB API before choosing `.pl()`, `.fetch_arrow_table()`, or another result conversion method.

## Treat Connections as Concurrency Boundaries

- Do not run concurrent operations on the shared module-level connection.
- Do not assume cursors created from one connection can execute concurrently.
- Give each worker thread its own connection when true parallel query execution is required.
- Serialize operations when an async wrapper shares one connection.
- Use separate read-only connections when the storage mode supports concurrent readers.
- Expect write conflicts and define bounded retry behavior where concurrent writes are allowed.

DuckDB calls are synchronous. In async applications, isolate blocking calls in worker threads and make connection ownership explicit.

```python
import asyncio
import duckdb

class AsyncDuckDB:
    def __init__(self) -> None:
        self._connection = duckdb.connect()
        self._lock = asyncio.Lock()

    async def execute(self, sql: str, params: list | None = None):
        async with self._lock:
            return await asyncio.to_thread(
                self._connection.execute,
                sql,
                params or [],
            )
```

Do not claim reads are lock-free when they share this connection.

## Use Transactions for Multi-Step Writes

Wrap dependent writes in one transaction. Roll back explicitly on failure.

```python
def replace_logical_row(con, stock_id: int, trade_date: str, close: float) -> None:
    con.execute("BEGIN")
    try:
        con.execute(
            "DELETE FROM daily_price WHERE stock_id = ? AND trade_date = ?",
            [stock_id, trade_date],
        )
        con.execute(
            "INSERT INTO daily_price (stock_id, trade_date, close) VALUES (?, ?, ?)",
            [stock_id, trade_date, close],
        )
        con.execute("COMMIT")
    except Exception:
        con.execute("ROLLBACK")
        raise
```

Use this delete-then-insert pattern only when the project defines the logical key and DuckLake cannot enforce uniqueness. Prefer a supported native operation when its semantics match the requirement.

## Respect DuckLake Constraint Limits

DuckLake currently supports `NOT NULL` but not `PRIMARY KEY`, `FOREIGN KEY`, `UNIQUE`, or `CHECK` constraints on user tables. Enforce unsupported invariants in a tested application boundary and document the logical key beside the schema.

Do not remove constraints from ordinary DuckDB tables merely because DuckLake has this limitation. Confirm which storage engine owns the table.

## Use Snapshots and Time Travel Correctly

DuckLake commits changes as snapshots. Query snapshot metadata through the attached catalog:

```sql
SELECT * FROM lake.snapshots();
SELECT * FROM lake.current_snapshot();
```

Query historical table state with DuckLake's `AT` syntax:

```sql
SELECT * FROM lake.daily_price AT (VERSION => 42);

SELECT *
FROM lake.daily_price
AT (TIMESTAMP => TIMESTAMP '2026-03-31 09:15:00');
```

Do not use `FOR SYSTEM_TIME AS OF` unless the installed engine and storage extension explicitly document that syntax.

Treat snapshot retention as a project policy. Time travel remains available only while the required snapshots and files are retained.

## Maintain DuckLake Explicitly

DuckLake does not remove historical data during normal operation. Reclaiming storage is a deliberate sequence:

1. Inspect snapshots and retention requirements.
2. Dry-run snapshot expiration.
3. Expire only approved snapshots.
4. Run the documented old-file cleanup operation.
5. Record destructive maintenance evidence.

Do not substitute a generic `VACUUM` instruction for DuckLake's documented snapshot expiration and file cleanup procedures.

## Review Checklist

- Confirm whether persistence belongs to DuckDB, DuckLake, or another store.
- Confirm dynamic values use parameters.
- Confirm interpolated identifiers come from an allowlist.
- Confirm connection ownership under threads and async execution.
- Confirm multi-step writes have transaction and rollback behavior.
- Confirm DuckLake logical constraints are enforced outside unsupported DDL.
- Confirm time-travel syntax matches the installed DuckLake version.
- Confirm snapshot expiration is intentional and recoverable.
- Confirm project-specific paths, table names, and queue policy remain in project documentation, not this shared skill.

## Authoritative References

- DuckDB Python API: https://duckdb.org/docs/stable/clients/python/overview
- DuckDB multiple Python threads: https://duckdb.org/docs/current/guides/python/multiple_threads
- DuckLake constraints: https://ducklake.select/docs/stable/duckdb/advanced_features/constraints
- DuckLake snapshots: https://ducklake.select/docs/stable/duckdb/usage/snapshots
- DuckLake time travel: https://ducklake.select/docs/stable/duckdb/usage/time_travel
- DuckLake snapshot expiration: https://ducklake.select/docs/stable/duckdb/maintenance/expire_snapshots
