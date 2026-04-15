import type { AppProps } from "next/app";
import { StrictContextProvider, useStrictContext } from "@/lib/StrictContext";

// ─── Shared layout component ──────────────────────────────────────────────────
//
// Simulates a real Navbar that gate-keeps UI behind a feature flag.
// It lives in _app, so it renders on every page — including pages
// that are not wrapped with the withStrictContext HOC.
//
// Safety: Navbar is inside _app's StrictContextProvider in the JSX below.
// React always renders parent before child, so Navbar always has the provider
// above it — even in the Edge streaming renderer. The render-order bug only
// affects the PAGE component (Component), which Next.js can schedule before
// _app. Components rendered BY _app (like Navbar) are never affected.
function Navbar() {
  const ctx = useStrictContext();

  return (
    <nav
      style={{
        background: ctx.initialized ? "#1e293b" : "#374151",
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
        flags:{" "}
        <code style={{ color: ctx.initialized ? "#86efac" : "#f87171" }}>
          {ctx.initialized ? "ready" : "uninitialized"}
        </code>
        {ctx.data.feature_flag_a && (
          <code style={{ marginLeft: "0.5rem", color: "#86efac" }}>
            feature_flag_a=true
          </code>
        )}
      </span>
    </nav>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────
//
// Provider architecture — two providers, same data, no conflict:
//
//   App (_app)
//     StrictContextProvider ← seeded from pageProps.serverContextState
//       Navbar              ← reads _app's provider (always safe)
//       Component           ← for HOC pages this is WrappedPage, which adds
//           StrictContextProvider (HOC) ← seeded from same serverContextState
//             PageComponent ← reads HOC's provider (render-order safe)
//
// Why two providers is correct here:
//   1. _app's provider serves Navbar and any other layout-level consumers.
//      It always renders after App, so it can never encounter a null context.
//   2. The HOC's provider serves the page component itself. Even if the Edge
//      streaming renderer calls the page before _app, the HOC's provider is
//      part of the page's own subtree — it is always above the page component.
//   3. Both providers are seeded from the same serverContextState (from
//      getServerSideProps). Neither is updated client-side. Values are
//      identical — no inconsistency between Navbar and page components.
//
// For pages WITHOUT the HOC (/index, /edge):
//   pageProps.serverContextState is undefined → _app's provider starts with
//   { initialized: false, data: {} }. Those pages throw on useStrictContext()
//   inside the page body — intentional, they are the bug reproduction.
export default function App({ Component, pageProps }: AppProps) {
  console.log({ ps: "App", phase: "render" });

  return (
    <StrictContextProvider serverState={pageProps.serverContextState}>
      <Navbar />
      <Component {...pageProps} />
    </StrictContextProvider>
  );
}
