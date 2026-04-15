/**
 * Demonstrates the HOC fix working correctly under the Edge streaming renderer.
 *
 * Two things make this safe regardless of render order:
 *
 *  1. getServerSideProps runs before any React rendering. By the time the
 *     component tree is touched, serverContextState is already in pageProps.
 *
 *  2. withStrictContext wraps this page in its own StrictContextProvider
 *     seeded from serverContextState. The provider is in the tree before
 *     the page component body executes — regardless of whether _app's
 *     provider has mounted yet.
 *
 * This pattern is safe to deploy to Vercel Edge. Even if the streaming
 * renderer calls this page before _app, the HOC-added provider is always
 * present because it is part of this page's component subtree, not _app's.
 */
import type { GetServerSideProps } from "next";
import { useStrictContext } from "@/lib/StrictContext";
import {
  withStrictContext,
  getServerContextState,
} from "@/lib/withStrictContext";

// ─── Page component ───────────────────────────────────────────────────────────

function FixedPage() {
  // Safe: withStrictContext guarantees a provider is in the tree above this.
  // context is pre-populated from getServerSideProps — never null, never
  // in "initializing" state on first render.
  const ctx = useStrictContext();

  return (
    <main style={{ fontFamily: "monospace", padding: "2rem" }}>
      <h1>Fixed Page (HOC pattern)</h1>

      <section
        style={{
          background: "#dcfce7",
          border: "1px solid #86efac",
          padding: "1rem",
          borderRadius: "4px",
          marginTop: "1rem",
        }}
      >
        <strong>useStrictContext() succeeded</strong> — context was available on
        first render, pre-populated from <code>getServerSideProps</code>.
      </section>

      <h2 style={{ marginTop: "1.5rem" }}>Context value</h2>
      <pre
        style={{
          background: "#f4f4f4",
          padding: "1rem",
          borderRadius: "4px",
        }}
      >
        {JSON.stringify(ctx, null, 2)}
      </pre>

      <h2 style={{ marginTop: "1.5rem" }}>Why this works</h2>
      <ol style={{ lineHeight: "1.8" }}>
        <li>
          <code>getServerSideProps</code> calls <code>getServerContextState()</code>{" "}
          — runs entirely outside React, before any rendering.
        </li>
        <li>
          <code>withStrictContext(FixedPage)</code> wraps this component in its
          own <code>StrictContextProvider</code>, seeded from{" "}
          <code>serverContextState</code> (from pageProps).
        </li>
        <li>
          The provider is part of <em>this page&apos;s</em> subtree, not{" "}
          <code>_app</code>. Render order between <code>_app</code> and this
          page is irrelevant — the provider is always above this component.
        </li>
        <li>
          <code>initialized: true</code> on first render — no flash of
          uninitialized state, no hydration mismatch.
        </li>
      </ol>

      <section
        style={{
          marginTop: "2rem",
          padding: "1rem",
          background: "#fef9c3",
          borderRadius: "4px",
          fontSize: "0.85rem",
        }}
      >
        <strong>Compare with <code>/simulate-bug</code>:</strong> that page
        renders a hook consumer without any provider ancestor — the exact
        failure mode this HOC pattern prevents.
      </section>
    </main>
  );
}

// ─── Data fetching ────────────────────────────────────────────────────────────

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  // ctx.req.headers could carry a session cookie; pass userId to
  // getServerContextState for identity-scoped flags.
  const userId = undefined; // replace with real session lookup

  const serverContextState = await getServerContextState(userId);
  return { props: { serverContextState } };
};

// ─── Export wrapped ───────────────────────────────────────────────────────────

export default withStrictContext(FixedPage);
