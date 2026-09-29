---
name: sql
description: >
  Always activate when writing SQL queries, migrations, or schema definitions
  in this project. Use the dialect and patterns specified here.
  Overrides pretrained SQL habits with project-specific rules.
license: MIT
metadata:
  author: Oystro
  version: "1.0.0"
---
<!-- *** Maintained by oystro/oystro-oss, DON'T modify this, will be overwritten during next upgrade *** -->
<!-- License: MIT — see the repository LICENSE. Adapt these instructions to YOUR project's pinned versions, stack, and conventions; verify against official docs. -->


<!-- EDITORIAL: Only dialect-specific rules and common AI mistakes. -->

## Dialect

**DuckDB** (configured in `technology.yaml`). 
Note: If your project uses another SQL dialect (e.g. PostgreSQL, SQLite, MySQL), adapt these rules to match that dialect. When writing SQL for DuckDB, do not use PostgreSQL-specific syntax.

## Non-Negotiable Rules

- SQL files live in `sql/` — never inline SQL in application code strings
- Migrations are numbered: `sql/migrations/001_init.sql`, `002_add_index.sql`
- All migrations are idempotent: use `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`
- Table names: `snake_case`, plural nouns (`batch_runs`, not `batchRun`)
- Column names: `snake_case`
- Primary keys: `id INTEGER PRIMARY KEY` or `id UUID DEFAULT gen_random_uuid()`
- **Test migrations locally** — run `duckdb < database.db < sql/migrations/001_init.sql` before committing

## Modern Toolchain

```bash
# Test a migration against a local DuckDB file
duckdb mydata.db < sql/migrations/001_init.sql

# Quick query against a DuckDB file
duckdb mydata.db -c "SELECT count(*) FROM my_table"

# Export query results
duckdb mydata.db -c "SELECT * FROM my_table" -csv > output.csv

# Interactive profiling
duckdb mydata.db
> SUMMARIZE SELECT * FROM my_table;
> DESCRIBE my_table;
```

**Agent rule:** When creating or modifying migrations, always verify syntax by running the migration against a test DuckDB file.

## DuckDB-Specific Syntax (AI models often use Postgres syntax instead)

```sql
-- CORRECT: DuckDB UPSERT syntax
INSERT INTO target SELECT * FROM source
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    updated_at = NOW();

-- WRONG: PostgreSQL-style ON CONFLICT with SET referencing table name
INSERT INTO target ... ON CONFLICT DO UPDATE SET target.name = ...;

-- CORRECT: DuckDB window functions
SELECT *, ROW_NUMBER() OVER (PARTITION BY group_id ORDER BY ts) AS rn
FROM events;

-- CORRECT: DuckDB COPY (fast bulk load)
COPY table_name FROM 'file.parquet';
COPY table_name FROM 'file.csv' (HEADER, DELIMITER ',');

-- CORRECT: DuckDB SUMMARIZE (quick profiling)
SUMMARIZE SELECT * FROM table_name;

-- CORRECT: DuckDB list/struct types
SELECT {'a': 1, 'b': 2} AS my_struct;
SELECT [1, 2, 3] AS my_list;
```

## SCD Type 2 Pattern (typical data warehousing pattern)

```sql
-- Mark old record as expired
UPDATE target
SET valid_to = NOW(), is_current = FALSE
WHERE natural_key = $1 AND is_current = TRUE;

-- Insert new version
INSERT INTO target (natural_key, ..., valid_from, valid_to, is_current)
VALUES ($1, ..., NOW(), '9999-12-31', TRUE);
```

## MERGE/UPSERT Pattern

```sql
INSERT INTO target (id, name, updated_at)
SELECT id, name, NOW() FROM source
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    updated_at = EXCLUDED.updated_at
WHERE target.name IS DISTINCT FROM EXCLUDED.name;
```

## Pipeline Audit Pattern (generic)

```sql
-- Record pipeline execution result (adapt table name to your project)
INSERT INTO <audit_table> (pipeline_name, rows_processed, started_at, completed_at, status)
VALUES ($1, $2, $3, NOW(), 'success');

-- Process locking to prevent concurrent runs (DuckDB advisory table pattern)
INSERT INTO <lock_table> (lock_name, acquired_at)
VALUES ($pipeline_name, NOW())
ON CONFLICT (lock_name) DO NOTHING
RETURNING lock_name;
-- If no row returned: lock held by another process, abort
```

> Note: Table names (`<audit_table>`, `<lock_table>`) are project-specific.
> Define them in your CONSTITUTION.md under Naming Conventions.


## Common AI Mistakes to Avoid

| Mistake | Correct (DuckDB) |
|---------|-----------------|
| `SERIAL` / `BIGSERIAL` | `INTEGER` + `NEXTVAL(seq)` or `INTEGER PRIMARY KEY` (auto-increments) |
| `NOW()::date` | `CURRENT_DATE` |
| `ILIKE` | `LOWER(col) LIKE LOWER(pattern)` |
| PostgreSQL `||` for JSON | DuckDB `json_object()` or `->>`  |
| `CREATE SEQUENCE IF NOT EXISTS` needed for auto_increment | DuckDB `INTEGER PRIMARY KEY` auto-increments |
| Inline SQL in Go: `fmt.Sprintf("SELECT * FROM %s", name)` | Load from `.sql` file, use parameterised `$1` |
