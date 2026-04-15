import { useStrictContext } from "@/lib/StrictContext";

// Opts this route into the experimental Edge runtime.
// On Vercel this triggers renderToReadableStream (Web Streams), which does
// NOT guarantee that _app renders before the page component. If the page
// executes first, useStrictContext() sees null context → throws:
//   react-dom-server.edge.production.js:4189
//   Error: useStrictContext must be used within a StrictContextProvider
//
// Locally the Edge runtime flag changes how the route is bundled/served but
// Next.js dev server still runs it through Node.js. _app's StrictContextProvider
// IS in the tree, so useStrictContext() succeeds — but returns the fallback
// { initialized: false, data: {} } because this page has no getServerSideProps
// returning serverContextState. The flags are wrong, just not loudly broken.
//
// To see the throw reproduced locally without deploying to Vercel:
//   → visit /simulate-bug
export const config = {
  runtime: "experimental-edge",
};

export default function EdgePage() {
  console.log({ ps: "EdgePage", phase: "render", runtime: "edge" });

  const ctx = useStrictContext();

  return (
    <main style={{ fontFamily: "monospace", padding: "2rem" }}>
      <h1>Edge Runtime Page</h1>
      <p>
        This page uses <code>runtime: &apos;experimental-edge&apos;</code>. It
        has no HOC and no <code>getServerSideProps</code> returning{" "}
        <code>serverContextState</code>.
      </p>

      <section
        style={{
          background: ctx.initialized ? "#dcfce7" : "#fef3c7",
          border: `1px solid ${ctx.initialized ? "#86efac" : "#fcd34d"}`,
          padding: "1rem",
          borderRadius: "4px",
          marginTop: "1rem",
        }}
      >
        <strong>Locally:</strong> renders with uninitialized flag state (
        <code>initialized: false</code>) — provider present from <code>_app</code>{" "}
        but no <code>serverContextState</code> was supplied.
        <br />
        <strong>On Vercel Edge:</strong> throws before this text appears —
        page executes before <code>_app</code> mounts its provider.
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
    </main>
  );
}
