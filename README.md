# Next.js 15 Pages Router — Strict Context Render-Order Bug

> **Note:** This project was generated with [Claude Code](https://claude.com/claude-code) (AI pair programming). The bug, findings, and fix are real and based on verified Next.js issues — but all code and documentation were written by an AI assistant. Review accordingly before using in production.

Minimal reproduction and fix for the error:

```
useFlagsmith must be used within a FlagsmithProvider
```

…thrown in a page component despite `FlagsmithProvider` being correctly placed in `_app.tsx`. The same class of bug affects **any** context built with `createContext(null)` and a consumer that throws (or crashes) when the context is null.

---

## The Bug

Next.js 15 Pages Router uses `react-dom-server.edge.production.js` — the Edge streaming renderer — instead of the legacy synchronous `renderToString`. The streaming renderer **does not guarantee parent-before-child render order**. Under certain conditions (Vercel Edge deployment, specific Next.js 15 minor versions) the page component's function body executes **before** `_app` mounts its providers.

Evidence captured during debugging:

```js
{ ps: 'Page' }   // ← page rendered first
{ ps: 'App' }    // ← _app rendered after
```

This is impossible under `renderToString` — it is a property of the streaming renderer.

When the page runs before `_app`:

1. `useContext(FlagsmithCtx)` returns `null` (no provider in the tree yet)
2. `useFlagsmith()` hard-throws: _"must be used within a FlagsmithProvider"_
3. `useFlags()` crashes with a generic `TypeError: Cannot read properties of null`
4. `useFlagsmithLoading()` silently returns `undefined` — wrong data, no error

Stack traces from the bug point to `react-dom-server.edge.production.js:4189`, confirming the Edge renderer is the culprit even for Pages Router routes.

---

## Repo Structure

```
lib/
  StrictContext.tsx      # Mimics useFlagsmith() — createContext(null) + hard throw
  SafeContext.tsx        # Safe pattern — createContext(defaultValue), never throws
  withStrictContext.tsx  # HOC fix + getServerContextState() server helper

pages/
  _app.tsx               # Both providers; Navbar consumes both
  index.tsx              # Broken page — throws at request time (no HOC)
  edge.tsx               # Explicit experimental-edge runtime
  simulate-bug.tsx       # Server-side reproduction via getServerSideProps
  fixed.tsx              # Fixed page — withStrictContext HOC + side-by-side comparison

scripts/
  simulate-render-order-bug.mjs  # Standalone proof, no server needed
```

---

## Quick Start

```bash
npm install

# See the error reproduced and explained without a server
npm run simulate

# Run the dev server
npm run dev
```

| Route | What it shows |
|---|---|
| `/` | **Broken** — no HOC, no `serverContextState`. Locally: renders with `initialized: false` (wrong data). On Vercel Edge: throws |
| `/simulate-bug` | **Throw reproduced locally** — `getServerSideProps` renders a hook consumer without any provider, catches and displays the error |
| `/fixed` | **Fixed** — HOC pattern, both contexts initialized correctly, side-by-side comparison |
| `/edge` | `experimental-edge` runtime — same broken pattern as `/`; throws on Vercel Edge |

---

## Root Cause in Detail

### 1. The Edge renderer is used for Pages Router in Next.js 15

Build output and stack traces prove it:

```
react-dom-server.edge.production.js:4189
TypeError: Cannot read properties of null (reading 'useContext')
```

This file is the streaming renderer used for Edge Functions. Next.js 15 routes Pages Router through it even on Node.js targets in certain configurations (confirmed in [vercel/next.js#74858](https://github.com/vercel/next.js/discussions/74858) and [vercel/next.js#82366](https://github.com/vercel/next.js/issues/82366)).

### 2. `renderToReadableStream` does not guarantee render order

`renderToString` renders the full component tree synchronously top-down — `_app` always before any page. `renderToReadableStream` (Web Streams, used by the Edge renderer) can schedule components differently, especially when Suspense or async boundaries are involved. The `{ ps: 'Page' }` before `{ ps: 'App' }` log is direct evidence.

### 3. `createContext(null)` with a throwing consumer is the trigger

The bug exists in the renderer. But it only manifests as an error when the context consumer throws (or crashes) on null. Libraries that provide a real default are immune:

| Pattern | Vulnerable? |
|---|---|
| `createContext(null)` + hard throw on null | **Yes** — `useFlagsmith()`, `useStrictContext()` |
| `createContext(null)` + non-null assertion `ctx!` | **Yes** — generic `TypeError` |
| `createContext(null)` + optional chain `ctx?.value` | **Silently broken** — returns `undefined` |
| `createContext(defaultValue)` with a real default | **No** — `next-themes`, `zustand`, `react-query` |

---

## Context Architecture in This Repo

Two providers, two different risk profiles, coexisting without conflict:

```
App (_app)
  SafeContextProvider        ← createContext(defaultValue) — safe everywhere, no HOC
    StrictContextProvider    ← seeded from pageProps.serverContextState
      Navbar                 ← reads both; always safe (rendered by _app, never before it)
      WrappedPage (HOC export of /fixed)
        StrictContextProvider (HOC) ← same serverContextState, inner wins for page
          FixedPage
            useSafeContext()    → _app's SafeContextProvider ✓
            useStrictContext()  → HOC's StrictContextProvider ✓
```

**Why two `StrictContextProvider` instances is not a conflict:** both are seeded from the same `serverContextState` returned by `getServerSideProps`. Neither updates client-side. Values are identical — Navbar and FixedPage see the same flag state.

**Why `Navbar` is safe with only `_app`'s provider:** `Navbar` is inside `_app`'s JSX. React always executes parent before child, so `Navbar` always has the provider above it. The render-order bug only affects `Component` (the page), which Next.js can schedule independently.

---

## The Fix — Per-Page Provider HOC

### `lib/withStrictContext.tsx`

```ts
// Server helper — call in getServerSideProps
export async function getServerContextState(userId?: string): Promise<StrictContextValue>

// HOC — wraps page in its own provider seeded from serverContextState
export function withStrictContext<P>(PageComponent: React.ComponentType<P>)
```

### Usage (2 lines per page)

```tsx
// pages/my-page.tsx
import { withStrictContext, getServerContextState } from '@/lib/withStrictContext'

function MyPage() {
  const ctx = useStrictContext() // always works
  return <div>...</div>
}

export const getServerSideProps: GetServerSideProps = async () => ({
  props: { serverContextState: await getServerContextState() },
})

export default withStrictContext(MyPage)
```

### Why this is render-order safe

`getServerSideProps` runs **before any React rendering**. By the time the component tree is touched, `serverContextState` is already in `pageProps`. The HOC's provider is part of the page's own subtree — it is always above the page component regardless of how `_app` is scheduled.

### Flagsmith equivalent (`lib/withPageFlags.tsx` in your real app)

```ts
export async function getPageFlags(userId?: string) {
  const flagsmith = createFlagsmithInstance()
  await flagsmith.init({
    environmentID: process.env.NEXT_PUBLIC_FLAGSMITH_KEY!,
    ...(userId ? { identity: userId } : {}),
  })
  return flagsmith.getState()
}

export function withPageFlags<P>(PageComponent: React.ComponentType<P>) {
  return function WrappedPage({ flagsmithState, ...props }: P & { flagsmithState: IState }) {
    const ref = useRef(createFlagsmithInstance())
    return (
      <FlagsmithProvider flagsmith={ref.current} serverState={flagsmithState}>
        <PageComponent {...(props as P)} />
      </FlagsmithProvider>
    )
  }
}
```

---

## Other Resolutions Investigated

### Upgrade Next.js minor
Some users in [#74858](https://github.com/vercel/next.js/discussions/74858) resolved the issue by upgrading within 15.x. **Not reliable** — [#82366](https://github.com/vercel/next.js/issues/82366) shows the same class of bug in 15.4.5, and [#84994](https://github.com/vercel/next.js/issues/84994) shows it in Next.js 16 canary.

### `force-dynamic` / `getServerSideProps` (no HOC)
Adding `export const dynamic = 'force-dynamic'` (App Router) or an empty `getServerSideProps` (Pages Router) prevents the build-time prerender throw. It does **not** fix the runtime render-order issue — the page still shows uninitialized state locally and can throw on Vercel Edge.

### Remove `_error.tsx`
Narrow fix for a specific variant where the error originates in the error page itself during prerendering ([#82366](https://github.com/vercel/next.js/issues/82366)).

### `createContext(defaultValue)` instead of `createContext(null)`
The cleanest fix for **your own contexts**. If a meaningful default exists, use it — the bug becomes harmless. Only contexts that genuinely cannot have a default (identity-scoped flags, auth tokens) require the HOC.

### Migrate to App Router
Next.js's long-term direction. Streaming + Suspense boundaries give explicit control over data loading order, and React Server Components eliminate the need for most context providers entirely. Not a practical near-term fix for large Pages Router codebases.

---

## Backing Issues

| Issue | Router | Status |
|---|---|---|
| [#74858](https://github.com/vercel/next.js/discussions/74858) — build failure on 15.1.4 | Pages | Open |
| [#82366](https://github.com/vercel/next.js/issues/82366) — useContext null in 15.4.5 prerender of /404 | Pages | Closed (confirmed bug) |
| [#43577](https://github.com/vercel/next.js/discussions/43577) — useContext null (longstanding, 157 comments) | Pages | Open |
| [#84994](https://github.com/vercel/next.js/issues/84994) — useContext null in Next.js 16 canary | App | Open |
| [#49355](https://github.com/vercel/next.js/issues/49355) — Framer Motion useContext null on Vercel | App | Closed |
| [#69682](https://github.com/vercel/next.js/issues/69682) — Context provider fails on first render | App | Open |

---

## Stack

- **Next.js** 15.3.9 (Pages Router)
- **React** 19.1.0
- **TypeScript** 5
- **Flagsmith** — not installed; `StrictContext` is a faithful stand-in for the `flagsmith/react` context contract
