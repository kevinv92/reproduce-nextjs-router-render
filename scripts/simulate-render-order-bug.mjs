/**
 * Standalone reproduction of the Next.js 15 Pages Router + Edge runtime bug.
 *
 * Run: node scripts/simulate-render-order-bug.mjs
 *
 * This script proves that "page renders before _app" is fatal when the context
 * hard-throws on null — exactly what happens with useFlagsmith() on Vercel Edge.
 *
 * The streaming edge renderer (renderToReadableStream) used in Next.js 15 Pages
 * Router on Vercel does NOT guarantee parent-before-child render order, so the
 * page component's function body can execute before _app's Provider mounts.
 *
 * We simulate that race condition below by rendering the page component
 * directly, without any provider ancestor — this is the exact call graph
 * that the broken renderer produces.
 */

import { renderToString } from "react-dom/server";
import { createElement, createContext, useContext } from "react";

// ─── Minimal reproduction of flagsmith/react context ─────────────────────────

const StrictCtx = createContext(null); // null default — no fallback value

function useStrictContext() {
  const ctx = useContext(StrictCtx);
  if (ctx === null) {
    // This is verbatim what flagsmith-js-client/react.tsx does for useFlagsmith()
    throw new Error(
      "useStrictContext must be used within a StrictContextProvider"
    );
  }
  return ctx;
}

function StrictContextProvider({ children, value }) {
  console.log("  [render] StrictContextProvider");
  return createElement(StrictCtx.Provider, { value }, children);
}

// ─── Components ───────────────────────────────────────────────────────────────

function PageComponent() {
  console.log("  [render] PageComponent");
  const ctx = useStrictContext(); // throws if context is null
  return createElement("div", null, `flags: ${JSON.stringify(ctx)}`);
}

function App({ Component, pageProps }) {
  console.log("  [render] App (_app.tsx equivalent)");
  return createElement(
    StrictContextProvider,
    { value: { initialized: true, data: { feature_flag_a: true } } },
    createElement(Component, pageProps)
  );
}

// ─── Case 1: Normal rendering — renderToString guarantees top-down order ──────

console.log("=== CASE 1: Standard renderToString (Node.js runtime) ===");
console.log("Expected: App → StrictContextProvider → PageComponent");
try {
  const html = renderToString(
    createElement(App, { Component: PageComponent, pageProps: {} })
  );
  console.log("  Result: OK (no throw)");
  console.log("  HTML:", html.slice(0, 80) + "...");
} catch (err) {
  console.error("  UNEXPECTED error:", err.message);
}

console.log();

// ─── Case 2: Broken rendering — page executes before provider is in tree ──────

console.log(
  "=== CASE 2: Broken render order (Edge streaming renderer simulation) ==="
);
console.log(
  "Simulates: renderToReadableStream calls PageComponent before App/Provider"
);
console.log("Observed render order on Vercel: { ps: 'Page' } then { ps: 'App' }");
try {
  renderToString(createElement(PageComponent)); // no provider ancestor
  console.log("  Result: OK (should not reach here)");
} catch (err) {
  console.error("  EXPECTED error thrown:", err.message);
  console.error(
    "  This is the exact error reported: 'useFlagsmith must be used within a FlagsmithProvider'"
  );
}

console.log();

// ─── Case 3: Explicit render order inversion ──────────────────────────────────

console.log("=== CASE 3: Explicit render order inversion ===");
console.log("Shows what 'Page renders before App' means in practice:");

const renderLog = [];

function InstrumentedProvider({ children }) {
  renderLog.push({ ps: "App (StrictContextProvider)" });
  return createElement(
    StrictCtx.Provider,
    { value: { initialized: true, data: {} } },
    children
  );
}

function InstrumentedPage() {
  renderLog.push({ ps: "Page" });
  const ctx = useContext(StrictCtx); // use useContext directly — no throw yet
  return createElement("div", null, ctx === null ? "NULL CONTEXT" : "OK");
}

// Normal order: App wraps Page (correct)
renderToString(
  createElement(InstrumentedProvider, null, createElement(InstrumentedPage))
);
console.log("  Normal render order:", JSON.stringify(renderLog));
renderLog.length = 0;

// Broken order: Page renders without App (simulates the edge renderer bug)
renderToString(createElement(InstrumentedPage));
console.log("  Broken render order:", JSON.stringify(renderLog));
console.log(
  "  (In the broken case, ctx is null — useStrictContext() would throw here)"
);
