---
name: go
description: >
  Always activate when writing Go code in this project. Overrides pretrained
  Go habits with project-specific rules derived from CONSTITUTION.md.
  Use when creating files, writing functions, tests, goroutines, or SQL queries in Go.
license: MIT
metadata:
  author: Oystro
  version: "1.0.0"
---
<!-- *** Maintained by oystro/oystro-oss, DON'T modify this, will be overwritten during next upgrade *** -->
<!-- License: MIT — see the repository LICENSE. Adapt these instructions to YOUR project's pinned versions, stack, and conventions; verify against official docs. -->


<!-- EDITORIAL GUIDELINES
This file is loaded into an agent's context window as a correction layer for
pretrained Go knowledge. Every line costs context. When editing:
- Be terse. Use tables and inline code over prose where possible.
- Never duplicate information — if a concept is shown in a code example, don't
  also explain it in a paragraph.
- Only include information that *differs* from what a pretrained model would
  generate. Don't document things models already get right.
- Prefer one consolidated code block over multiple small ones.
- Keep WRONG/CORRECT pairs short — just enough to pattern-match the fix.
-->

## Non-Negotiable Rules

- Return errors — never `panic()` in library code (`cmd/` is the only exception)
- No global mutable state — inject all dependencies via constructors
- SQL always in `.sql` files under `sql/` — never `fmt.Sprintf` into a query string
- Use `context.Context` as the first argument of every function that does I/O
- All goroutines must have a cancellation path via `ctx.Done()` or `errgroup`
- **Prefer std lib** — do not add a third-party dependency when standard library provides the functionality. Justify every `go get`.

## Project Layout

```
cmd/          ← main packages only — thin wrappers, no business logic
pkg/          ← importable library code
internal/     ← private packages, never import from outside this module
sql/          ← versioned .sql files (migrations: NNN_description.sql)
testdata/     ← fixtures and golden files
web/          ← templates, CSS, JS — embedded, never read from disk at runtime
Makefile      ← build, test, lint, vet targets
```

## Static Assets — `go:embed`

Any project serving HTML, CSS, JS, or templates embeds them. Do not read files
from disk at runtime, and do not fetch assets from a CDN.

```go
//go:embed web
var webFS embed.FS
```

| Rule | Why |
| --- | --- |
| Embed assets; never serve from disk | The binary is the deployment unit. Disk paths break air-gapped deploys and container immutability. |
| Never fetch a framework from a CDN | You cannot verify what you did not pin, and a floating tag makes behaviour depend on when the page loaded. |
| **Embedded assets are greppable at build time** | This is the part that is easy to miss: because the CSS ships inside the binary, `grep` over the source tree resolves every framework class, custom property, and variant the UI actually uses. |

That last row is a verification capability, not just a packaging one. Any claim
about a framework's API — which class exists, which variants an element defines,
what the cascade layer order is — becomes a one-line `grep` instead of a
guess. Record the answers with the file you read them from; see
`../server-rendered-ui/references/extension-pattern.md`.

Served with a content hash or a version query so a deploy cannot be masked by a
cached copy. A stylesheet change with no cache-bust is a bug report that
reproduces for one user and not for you.

## Makefile

Every Go project MUST have a Makefile at the repo root. Use `make` as the single entry point for all build operations.

```makefile
BINARY   := myapp
MODULE   := $(shell go list -m)
VERSION  := $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
LDFLAGS  := -s -w -X main.version=$(VERSION)

.PHONY: all build test ui vet lint fmt clean tidy check

all: check build

build:
	CGO_ENABLED=0 go build -ldflags "$(LDFLAGS)" -o bin/$(BINARY) ./cmd/$(BINARY)

# `ui` only exists if the project drives a real browser. It is in `check`, so it
# runs on every commit — see the rule below.
check: vet lint test ui

vet:
	go vet ./...

lint:
	golangci-lint run ./...

test:
	go test -race -count=1 ./...

ui: build
	node test/ui-regressions.mjs

fmt:
	gofumpt -l -w .
	goimports -w .

tidy:
	go mod tidy
	go mod verify

clean:
	rm -rf bin/ dist/ coverage.out
```

**Agent rule:** Always use `make check` before committing.

**Every check must be in the default target.** A test that is not reachable from
`all` or `check` is a test that stops running within a month, and nobody notices
because the suite is still green. This bites hardest on checks that live outside
the language's own runner — browser-driven UI regressions, migration smoke tests,
load tests. They are the checks most likely to be quietly orphaned, and usually
the most valuable. If it caught a real bug once, it belongs in `check`.

## CGO and Cross-Compilation

Use **Zig** as the C/C++ compiler if CGO is required (e.g., SQLite, system calls). If CGO is not needed, always use `CGO_ENABLED=0`.

```makefile
ZIG_CC   := zig cc
ZIG_CXX  := zig c++

build-linux:
	CGO_ENABLED=1 CC=$(ZIG_CC) CXX=$(ZIG_CXX) GOOS=linux GOARCH=amd64 go build -ldflags "$(LDFLAGS)" -o bin/$(BINARY)-linux-amd64 ./cmd/$(BINARY)

build-darwin:
	CGO_ENABLED=1 CC=$(ZIG_CC) CXX=$(ZIG_CXX) GOOS=darwin GOARCH=arm64 go build -ldflags "$(LDFLAGS)" -o bin/$(BINARY)-darwin-arm64 ./cmd/$(BINARY)

build-cgo:
	CGO_ENABLED=1 CC=$(ZIG_CC) CXX=$(ZIG_CXX) go build -ldflags "$(LDFLAGS)" -o bin/$(BINARY) ./cmd/$(BINARY)
```

## Test Conventions

- Always run tests with the race detector: `go test -race -count=1 ./...`
- Table-driven tests — always use `t.Run()`
- Test file: same package as code (`package foo`, not `package foo_test`) unless testing public API
- Coverage target: >80% for `pkg/`, >60% for `cmd/`
- Use `t.Helper()` in test helpers and `t.Cleanup()` for test teardown
- **Revert each fix and confirm its test fails, one fix at a time.** A test that
  passes against the code it was written for reports safety that is not there.
  Reverting the whole set proves nothing: two fixes can mask each other, so the
  suite passes with both broken. Revert one, confirm red, restore, repeat.
- **A test that never failed is not a test.** If you cannot make it fail, you do
  not know what it asserts — usually the selector is too loose or the assertion
  is on a wrapper rather than the thing that moved.

## Error Handling

| Pattern | Verdict |
|---------|---------|
| `return fmt.Errorf("context: %w", err)` | CORRECT |
| `return err` | WRONG — loses context |
| `log.Fatal(err)` in library | WRONG — only in `cmd/` |
| `panic(err)` | WRONG — never in library |
| `_ = err` | WRONG — silently ignoring |

```go
// CORRECT
if err != nil {
    return fmt.Errorf("opening pool: %w", err)
}
```

## Structured Logging

Use `log/slog` (Go 1.21+ std lib) — never `fmt.Print` or `log.Println` for operational logs.

```go
// Logger setup in main
slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo})))

// CORRECT
slog.Info("server started", "addr", addr, "port", port)
slog.Error("request failed", "err", err, "path", r.URL.Path)

// WRONG
log.Printf("server started on %s:%d", addr, port)
fmt.Println("error:", err)
```

## Concurrency

All goroutines must have a cancellation path and wait mechanism.

```go
// CORRECT
g, ctx := errgroup.WithContext(ctx)
g.Go(func() error {
    return doWork(ctx)
})
if err := g.Wait(); err != nil {
    return err
}

// WRONG
go doWork()
```

## Configuration & Secrets

```go
// CORRECT — config from ~/.config/<app>/, env vars for non-secrets
func loadConfig() (*Config, error) {
    // 1. Load secrets from config.yaml
    var cfgPath string
    if appData := os.Getenv("APPDATA"); appData != "" {
        cfgPath = filepath.Join(appData, "myapp", "config.yaml")
    } else {
        home, _ := os.UserHomeDir()
        cfgPath = filepath.Join(home, ".config", "myapp", "config.yaml")
    }
    if _, err := os.Stat(cfgPath); os.IsNotExist(err) && os.Getenv("USERPROFILE") != "" {
        cfgPath = filepath.Join(os.Getenv("USERPROFILE"), ".config", "myapp", "config.yaml")
    }

    cfg, err := loadYAML(cfgPath)
    if err != nil && !os.IsNotExist(err) {
        return nil, fmt.Errorf("loading config: %w", err)
    }

    // 2. Override non-secret values from env vars
    if v := os.Getenv("PORT"); v != "" {
        cfg.Port, _ = strconv.Atoi(v)
    }
    if cfg.Port == 0 {
        cfg.Port = 8080
    }
    cfg.LogLevel = getEnv("LOG_LEVEL", "info")

    // 3. Validate required secrets are present
    if cfg.DatabaseURL == "" {
        return nil, fmt.Errorf("database_url required — set in config.yaml")
    }
    return cfg, nil
}
```

**Directory structure:**
- Unix: `~/.config/<app-name>/config.yaml`
- Windows: `%APPDATA%\<app-name>\config.yaml` (fallback: `%USERPROFILE%\.config\<app-name>\config.yaml`)

## Health Checks & Graceful Shutdown

Every service must support `/healthz` (liveness), `/readyz` (readiness checking DB/deps), and SIGINT/SIGTERM graceful shutdown.

```go
// Health endpoints
http.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
    w.WriteHeader(http.StatusOK)
    fmt.Fprintln(w, "ok")
})
http.HandleFunc("/readyz", func(w http.ResponseWriter, r *http.Request) {
    if err := db.PingContext(r.Context()); err != nil {
        w.WriteHeader(http.StatusServiceUnavailable)
        return
    }
    w.WriteHeader(http.StatusOK)
})

// Graceful shutdown
ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
defer cancel()

srv := &http.Server{Addr: addr, Handler: mux}
go func() {
    if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
        slog.Error("server failed", "err", err)
    }
}()

<-ctx.Done()
shutdownCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()
srv.Shutdown(shutdownCtx)
```

## SSE (Server-Sent Events) Flusher

Any middleware wrapping `http.ResponseWriter` must implement `http.Flusher` for SSE.

```go
type statusRecorder struct {
    http.ResponseWriter
    status int
}

func (r *statusRecorder) Flush() {
    if flusher, ok := r.ResponseWriter.(http.Flusher); ok {
        flusher.Flush()
    }
}
```

A wrapper that forgets `Flush` compiles, passes every test, and streams
nothing — the client waits for the whole response and the symptom is a slow
page, not an error. Assert that bytes arrive before the handler returns.

For flicker, duplicate delivery, gap detection, and how to measure any of it,
read `../server-rendered-ui/SKILL.md`. The Go mechanics are here; the delivery
semantics are there.

## API Error Format

Every HTTP handler must return errors in a consistent JSON format.

```go
type APIError struct {
    Code    string `json:"code"`
    Message string `json:"message"`
}

func writeError(w http.ResponseWriter, status int, code string, msg string) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(status)
    json.NewEncoder(w).Encode(APIError{Code: code, Message: msg})
}
```

## Database Runtime Patterns

```go
// Pool limits
db.SetMaxOpenConns(25)
db.SetMaxIdleConns(5)
db.SetConnMaxLifetime(5 * time.Minute)

// Transaction with rollback
tx, err := db.BeginTx(ctx, nil)
if err != nil {
    return err
}
defer tx.Rollback() // no-op if committed
// ... query operations ...
return tx.Commit()
```

| Need | Std Lib Package | Do NOT use |
|------|----------------|------------|
| HTTP server/client | `net/http` | gin, echo (unless routing is complex) |
| JSON | `encoding/json` | json-iterator |
| Testing | `testing` | ginkgo, gocheck |
| Logging | `log/slog` | zap, zerolog |
| CLI flags | `flag` or `os.Args` | cobra |

## Go Generics

- **Consume, Don't Define:** Use standard library generics (`slices`, `maps`). 
- Do not define custom generic types/interfaces in business logic. Use interfaces for behavior.

| Pattern | Verdict |
|---------|---------|
| `slices.Sort(mySlice)` | CORRECT |
| `type Stack[T any] struct` | OK — simple container |
| `type Service[T, R any] interface` | WRONG — over-engineering |

## Common AI Mistakes to Avoid

| Mistake | Correct |
|---------|---------|
| `interface{}` | `any` (Go 1.18+) |
| `init()` functions | explicit constructor functions |
| `log.Fatal()` in library | return error |
| Inline SQL strings | load from `sql/` file |
| `sync.Mutex` on hot path | `sync.RWMutex` for read-heavy paths |
| Goroutine without cancel | always pass `ctx context.Context` |
| `defer` in tight loop | move defer outside loop |
| Adding `go get` without checking std lib | use standard library first |
| CGO_ENABLED=1 when not needed | always `CGO_ENABLED=0` |
| Running tests without `-race` | `go test -race ./...` is mandatory |
| Skipping `go vet` | run `go vet ./...` before committing |
