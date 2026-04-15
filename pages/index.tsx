import { useStrictContext } from "@/lib/StrictContext";

// This is the page that consumes the strict context.
// Under renderToString: _app renders first → provider is in tree → works.
// Under renderToReadableStream (Edge runtime): page can render before _app
// → context is null → useStrictContext() throws.
export default function Home() {
  // Log render order — if this appears before { ps: "App" } in the server
  // console, the render order is inverted.
  console.log({ ps: "Page", phase: "render" });

  // This throws: "useStrictContext must be used within a StrictContextProvider"
  // when context is null (page rendered before provider mounted).
  const ctx = useStrictContext();

  return (
    <main style={{ fontFamily: "monospace", padding: "2rem" }}>
      <h1>Render Order Reproduction</h1>
      <p>
        If you see this, the context was available (no throw). Check the{" "}
        <strong>server console</strong> for render order logs.
      </p>
      <pre
        style={{
          background: "#f4f4f4",
          padding: "1rem",
          borderRadius: "4px",
          marginTop: "1rem",
        }}
      >
        {JSON.stringify(ctx, null, 2)}
      </pre>
      <section style={{ marginTop: "2rem", fontSize: "0.875rem", color: "#666" }}>
        <h2>What this reproduces</h2>
        <ul>
          <li>
            <strong>useStrictContext()</strong> mimics{" "}
            <code>useFlagsmith()</code> — hard-throws on null context
          </li>
          <li>
            <strong>StrictContextProvider</strong> is in <code>_app.tsx</code>{" "}
            (like <code>FlagsmithProvider</code>)
          </li>
          <li>
            Expected: <code>App</code> renders first → provider mounts →
            page renders inside it
          </li>
          <li>
            Broken: with Edge streaming renderer, <code>Page</code> logs before{" "}
            <code>App</code> → null context → throw
          </li>
        </ul>
      </section>
    </main>
  );
}
