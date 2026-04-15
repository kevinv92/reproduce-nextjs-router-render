import type { GetServerSideProps } from "next";
import Link from "next/link";
import { useStrictContext } from "@/lib/StrictContext";

// This page deliberately does NOT pass serverContextState from getServerSideProps.
// _app's StrictContextProvider receives serverState={undefined} and starts with
// the fallback { initialized: false, data: {} }.
//
// Locally this page renders without throwing — the provider IS in the tree.
// The flag state is uninitialized: flags aren't ready, data is empty.
// That is the wrong behaviour; it's just not as loud as a throw.
//
// On Vercel Edge (renderToReadableStream), the page can execute BEFORE _app
// mounts its provider. In that case useStrictContext() sees null → throws:
//   "useStrictContext must be used within a StrictContextProvider"
//
// /simulate-bug reproduces the throw locally (renders without any provider).
// /fixed shows the correct behaviour (withStrictContext HOC + getServerSideProps).
export const getServerSideProps: GetServerSideProps = async () => ({ props: {} });

export default function Home() {
  console.log({ ps: "Page", phase: "render" });

  const ctx = useStrictContext();

  const isUninitialized = !ctx.initialized;

  return (
    <main style={{ fontFamily: "monospace", padding: "2rem" }}>
      <h1>Broken Page — no HOC, no serverContextState</h1>

      <section
        style={{
          background: isUninitialized ? "#fef3c7" : "#dcfce7",
          border: `1px solid ${isUninitialized ? "#fcd34d" : "#86efac"}`,
          padding: "1rem",
          borderRadius: "4px",
          marginTop: "1rem",
        }}
      >
        {isUninitialized ? (
          <>
            <strong>Flags uninitialized</strong> — locally the provider is
            present (from <code>_app</code>) but holds the fallback state because
            no <code>serverContextState</code> was returned from{" "}
            <code>getServerSideProps</code>. On Vercel Edge this page would throw
            instead: <em>useStrictContext must be used within a StrictContextProvider</em>.
          </>
        ) : (
          <strong>Flags initialized (unexpected — check getServerSideProps)</strong>
        )}
      </section>

      <h2 style={{ marginTop: "1.5rem" }}>Context value received</h2>
      <pre
        style={{
          background: "#f4f4f4",
          padding: "1rem",
          borderRadius: "4px",
        }}
      >
        {JSON.stringify(ctx, null, 2)}
      </pre>

      <section style={{ marginTop: "1.5rem", fontSize: "0.875rem", color: "#666", lineHeight: "1.7" }}>
        <h2>Two failure modes of the broken pattern</h2>
        <ol>
          <li>
            <strong>Locally (Node.js renderer):</strong> <code>_app</code>{" "}
            always renders before the page, so the provider is present.
            But without <code>serverContextState</code> it falls back to{" "}
            <code>{"{ initialized: false, data: {} }"}</code> — flags are
            never ready.
          </li>
          <li>
            <strong>Vercel Edge (streaming renderer):</strong> the page can
            execute before <code>_app</code> mounts its provider.{" "}
            <code>useContext</code> returns <code>null</code>,{" "}
            <code>useStrictContext()</code> throws. Visit{" "}
            <Link href="/simulate-bug">/simulate-bug</Link> to see this reproduced
            locally.
          </li>
        </ol>
        <p>
          Visit <Link href="/fixed">/fixed</Link> to see the HOC pattern that fixes
          both failure modes.
        </p>
      </section>
    </main>
  );
}
