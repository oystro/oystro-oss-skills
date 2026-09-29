---
name: datastar
description: >
  Use when building SSE-driven UI with DataStar, or deciding whether to keep it. Covers the
  wrapper rule that keeps an SSE library out of application code, how to choose asset
  delivery, and the delivery-level traps that cause flicker and duplicated updates. This
  skill deliberately contains no attribute syntax, SDK signatures, or version numbers:
  DataStar's API changes between releases, so current API detail comes from the official
  documentation and the pinned version in your project.
license: MIT
metadata:
  author: Oystro
  version: "1.0.0"
---
<!-- *** Maintained by oystro/oystro-oss, DON'T modify this, will be overwritten during next upgrade *** -->
<!-- License: MIT — see the repository LICENSE. Adapt these instructions to YOUR project's pinned versions, stack, and conventions; verify against official docs. -->

<!-- EDITORIAL GUIDELINES
- Terse. Use tables and WRONG/CORRECT pairs over prose.
- NO attribute syntax tables, NO SDK signatures, NO CDN URLs, NO version numbers. They are
  the reason this skill was rewritten. Architecture and traps only.
- Read the current official documentation for anything version-specific.
-->

## Non-Negotiable Rules

- **Read the official docs for the pinned version.** Before writing an integration, confirm
  the current attribute syntax and SDK surface against the documentation and against the
  version your project actually pins. This skill will not tell you the syntax, because a
  stale answer here is worse than no answer.
- **Never let the library reach application code.** No handler, command, or domain package
  may import the SSE SDK. Put it behind one thin local package that speaks standard library
  types. This is the single most valuable rule in this file.
- **Version the state, or accept that you cannot reason about it.** Without a monotonic
  version the client cannot tell a fresh update from a replayed one, and a dropped update is
  invisible.
- **Decide the delivery model before writing handlers.** Inline-plus-broadcast and
  broadcast-only have different failure modes. Choose one deliberately.

## The Wrapper Rule

Wrap the SDK in a single local package. Application code depends on your package, not on the
vendor's, so replacing the library is a change to one directory.

```
pkg/stream/          <- the only place the SDK is imported
  stream.go          <- NewWriter, ReadSignals, PatchFragment, MergeSignals, NextVersion
api/                 <- imports pkg/stream only
cmd/                 <- imports pkg/stream only
```

What the wrapper must provide:

| Requirement | Why |
| --- | --- |
| Accepts/returns standard library types (`http.ResponseWriter`, `*http.Request`, `error`) | Application code stays free of vendor types. |
| One function per operation the app needs, not one per SDK method | The surface you expose is the surface you maintain. |
| Errors returned, not swallowed | A dropped update must be visible. |
| Owns the versioning decision | One place to add a monotonic version. |
| No business logic | It transports state; it does not decide it. |

If swapping the library would require edits outside `pkg/stream`, the boundary has already
leaked.

## Asset Delivery

| Situation | Use | Why |
| --- | --- | --- |
| Production, air-gapped, or single-binary | Vendored assets in the binary | No runtime network dependency; the binary is the deployment unit. |
| Prototyping, demos | CDN, pinned to an exact version | Fast iteration; accept the network dependency. |

Rules either way:

- **Pin exactly.** A floating CDN tag makes production behaviour depend on when the page
  loaded. If you use a CDN in development, the same pin must be what you test against.
- **Vendor what you ship.** A framework file fetched at runtime is a supply-chain and
  availability dependency you did not intend.
- **Serve your own copy of the framework CSS too.** The layout guarantees in the paired
  skill depend on knowing the exact framework build in use.

## Delivery Traps

These are the causes of flicker and duplicated updates. All were observed in a real project.

| Trap | What actually happens | Do instead |
| --- | --- | --- |
| **Duplicate delivery to the acting client** | The same state is applied twice — once in the action's own response, once by broadcast. The second application re-renders, which reads as a flicker. | Deliver once, or attach a version and let the client drop what it has already applied. |
| **Two-stage first paint** | The shell paints from the server, then real content arrives over the stream and everything below it moves. | Server-render the first real state. |
| **No gap detection** | A dropped update leaves the UI permanently wrong with nothing indicating it happened. | Monotonic version per state; client compares and can re-request. |
| **Synchronous work inside the request** | Intermediate states never exist on the client, so time the user spends waiting is invisible. No amount of client code can show a state the server never sent. | If the user waits, send the waiting state, then send the result. |
| **Patch scoped too narrowly** | Part of the page updates and the rest does not, which reads as a flicker because only some elements move. | Patch the smallest genuinely self-contained region, and measure that region. |
| **Timing flags change what is observable** | A test flag that shortens delays also removes states from the client, so conclusions drawn under it are wrong. | Observe transient states with delays raised, in a second instance. |
| **A state that only appears conditionally** | It looks like dead markup when your driver happens not to produce the condition. | Drive the condition. A state you never reached is a state you did not test. |
| **Streaming and buffering** | Responses that are not flushed stream nothing, so the client waits for the whole thing. | Confirm the response is actually flushed per event. |

## Choosing Whether to Keep the Library

Keep it if the ergonomics are worth the dependency and you have absorbed the delivery traps
above. Replace it if you need versioned state, gap detection, or single-patch delivery and
find yourself working around the library to get them — at that point the wrapper is the
thing you maintain and the library is only the part you cannot.

Whichever you choose, the wrapper boundary is what makes the decision reversible. That is the
argument for having it regardless.

## Related

- `../server-rendered-ui/SKILL.md` — measuring and fixing flicker, jumps and duplicated
  updates in an SSE-driven UI. Read alongside this skill.
- Current API detail: the official DataStar documentation and the version your project pins.
