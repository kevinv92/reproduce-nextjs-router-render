import { useStrictContext } from "@/lib/StrictContext";

// Explicitly opt into Edge runtime.
// This forces Next.js to use renderToReadableStream (Web Streams / Edge renderer)
// instead of renderToString (Node.js renderer).
//
// This is the exact condition that breaks render order:
// the streaming renderer does NOT guarantee parent-before-child order,
// so this page component can execute before _app's StrictContextProvider mounts.
//
// Stack trace you'd see on Vercel:
//   react-dom-server.edge.production.js:4189
//   Error: useStrictContext must be used within a StrictContextProvider
export const config = {
  runtime: "experimental-edge",
};

export default function EdgePage() {
  console.log({ ps: "EdgePage", phase: "render", runtime: "edge" });

  // With Edge runtime: this throws because page renders before _app provider
  // With Node runtime: this works because renderToString guarantees order
  const ctx = useStrictContext();

  return (
    <main style={{ fontFamily: "monospace", padding: "2rem" }}>
      <h1>Edge Runtime Page</h1>
      <p>
        This page uses <code>runtime: &apos;experimental-edge&apos;</code>.
      </p>
      <p>
        The Edge renderer (<code>renderToReadableStream</code>) does NOT
        guarantee parent-before-child render order, so{" "}
        <code>useStrictContext()</code> can see a null context.
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
    </main>
  );
}
