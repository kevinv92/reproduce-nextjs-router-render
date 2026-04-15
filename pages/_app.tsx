import type { AppProps } from "next/app";
import { StrictContextProvider, useStrictContext } from "@/lib/StrictContext";
import { SafeContextProvider, useSafeContext } from "@/lib/SafeContext";

// ─── Shared layout component ──────────────────────────────────────────────────
//
// Consumes BOTH contexts to show they coexist without interfering.
// Navbar is inside both providers in the JSX below, so it always has
// access to both — the render-order bug can never affect components that
// _app renders directly (only the page Component is at risk).
function Navbar() {
  const strict = useStrictContext(); // Flagsmith-style — needs HOC on pages
  const safe = useSafeContext();     // default-value style — safe everywhere

  return (
    <nav
      style={{
        background: strict.initialized ? "#1e293b" : "#374151",
        color: "#f8fafc",
        padding: "0.75rem 2rem",
        display: "flex",
        gap: "1.5rem",
        alignItems: "center",
        fontFamily: "monospace",
        fontSize: "0.875rem",
      }}
    >
      <strong>demo</strong>
      <a href="/" style={{ color: "#94a3b8" }}>/ (broken)</a>
      <a href="/simulate-bug" style={{ color: "#94a3b8" }}>/simulate-bug</a>
      <a href="/fixed" style={{ color: "#86efac" }}>/fixed (HOC)</a>
      <span style={{ marginLeft: "auto", color: "#64748b" }}>
        <code style={{ color: strict.initialized ? "#86efac" : "#f87171" }}>
          flags:{strict.initialized ? "ready" : "uninit"}
        </code>
        {"  "}
        <code style={{ color: "#94a3b8" }}>
          theme:{safe.theme}
        </code>
      </span>
    </nav>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────
//
// Two independent contexts, two different risk profiles:
//
//   SafeContextProvider  — no render-order risk. createContext(defaultValue)
//     means useContext always returns a valid value even with no provider in
//     the tree. No HOC needed on pages. Used for theme, locale, UI prefs.
//
//   StrictContextProvider — HAS render-order risk. createContext(null) means
//     useContext returns null if the page renders before _app. Pages using
//     useStrictContext() must be wrapped with withStrictContext HOC.
//     Used for Flagsmith flags, auth tokens, identity-scoped data.
//
// Full tree for a HOC-wrapped page (/fixed):
//
//   App (_app)
//     SafeContextProvider    ← default value, safe everywhere
//       StrictContextProvider ← seeded from pageProps.serverContextState
//         Navbar              ← reads both; always safe (child of _app)
//         WrappedPage (HOC export of /fixed)
//           StrictContextProvider (HOC) ← same serverContextState, inner wins
//             FixedPage
//               useSafeContext()   → _app's SafeContextProvider ✓
//               useStrictContext() → HOC's StrictContextProvider ✓
//
// SafeContext has no HOC — one provider in _app is enough because a missing
// provider falls back to the default value rather than throwing.
export default function App({ Component, pageProps }: AppProps) {
  console.log({ ps: "App", phase: "render" });

  return (
    <SafeContextProvider serverValue={pageProps.safeContextValue}>
      <StrictContextProvider serverState={pageProps.serverContextState}>
        <Navbar />
        <Component {...pageProps} />
      </StrictContextProvider>
    </SafeContextProvider>
  );
}
