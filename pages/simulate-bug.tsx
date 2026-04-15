/**
 * This page reproduces the error server-side during getServerSideProps.
 *
 * It renders the page component (PageWithoutProvider) using React's
 * renderToStaticMarkup WITHOUT wrapping it in StrictContextProvider.
 * This is the same call graph that the Edge streaming renderer produces
 * when render order is inverted (page executes before _app).
 *
 * Result: the exact error "useStrictContext must be used within a
 * StrictContextProvider" is thrown and caught, then displayed on the page.
 *
 * The /edge route (runtime: 'experimental-edge') is needed to deploy
 * this to Vercel's edge infrastructure where the broken render order
 * occurs naturally without any simulation.
 */
import type { GetServerSideProps } from "next";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useStrictContext } from "@/lib/StrictContext";

// Minimal component that uses the strict hook — identical to what a real page does.
// Outside of a provider tree, calling this throws.
function PageWithoutProvider() {
  const ctx = useStrictContext();
  return <div>{JSON.stringify(ctx)}</div>;
}

interface Props {
  errorMessage: string | null;
  errorStack: string | null;
  renderOrder: string[];
}

export const getServerSideProps: GetServerSideProps<Props> = async () => {
  const renderOrder: string[] = [];
  let errorMessage: string | null = null;
  let errorStack: string | null = null;

  try {
    renderOrder.push("getServerSideProps starts");
    renderOrder.push("Calling renderToStaticMarkup(PageWithoutProvider) — no provider ancestor");

    // This reproduces the broken edge renderer call graph:
    //   renderToReadableStream calls the page component function body
    //   before _app has had a chance to mount its Provider
    renderToStaticMarkup(React.createElement(PageWithoutProvider));

    renderOrder.push("renderToStaticMarkup completed (no error — should not happen)");
  } catch (err: unknown) {
    renderOrder.push("Error thrown by useStrictContext()");
    if (err instanceof Error) {
      errorMessage = err.message;
      errorStack = err.stack ?? null;
    }
  }

  return { props: { errorMessage, errorStack, renderOrder } };
};

export default function SimulateBugPage({
  errorMessage,
  errorStack,
  renderOrder,
}: Props) {
  return (
    <main style={{ fontFamily: "monospace", padding: "2rem" }}>
      <h1>Simulate Bug — Server-Side Reproduction</h1>
      <p>
        <code>getServerSideProps</code> renders <code>PageWithoutProvider</code>{" "}
        (a component using <code>useStrictContext</code>) without any provider
        ancestor. This simulates the inverted render order from the Edge
        streaming renderer.
      </p>

      <h2 style={{ marginTop: "1.5rem" }}>Render sequence</h2>
      <ol style={{ background: "#f4f4f4", padding: "1rem 2rem", borderRadius: "4px" }}>
        {renderOrder.map((step, i) => (
          <li key={i} style={{ margin: "0.25rem 0" }}>
            {step}
          </li>
        ))}
      </ol>

      <h2 style={{ marginTop: "1.5rem" }}>
        {errorMessage ? "Error (expected)" : "No error (unexpected)"}
      </h2>
      {errorMessage ? (
        <div
          style={{
            background: "#fee2e2",
            border: "1px solid #fca5a5",
            padding: "1rem",
            borderRadius: "4px",
          }}
        >
          <p>
            <strong>Message:</strong>
          </p>
          <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{errorMessage}</pre>
          <p style={{ marginTop: "1rem" }}>
            <strong>Stack:</strong>
          </p>
          <pre
            style={{
              margin: 0,
              fontSize: "0.75rem",
              whiteSpace: "pre-wrap",
              color: "#991b1b",
            }}
          >
            {errorStack}
          </pre>
        </div>
      ) : (
        <p style={{ color: "green" }}>No error thrown (context was available)</p>
      )}

      <section style={{ marginTop: "2rem", fontSize: "0.85rem", color: "#555" }}>
        <h2>Why this happens on Vercel / Edge runtime</h2>
        <p>
          Next.js 15 Pages Router on Vercel uses{" "}
          <code>renderToReadableStream</code> (Web Streams, edge renderer) instead
          of <code>renderToString</code> (Node.js). The streaming renderer does
          not guarantee parent-before-child render order. When the page component
          executes before <code>_app</code>&apos;s <code>StrictContextProvider</code>{" "}
          mounts, <code>useContext</code> returns <code>null</code> and the strict
          hook throws.
        </p>
        <p>
          Evidence from the Notion doc: server console logs showed{" "}
          <code>{`{ ps: "Page" }`}</code> appearing <em>before</em>{" "}
          <code>{`{ ps: "App" }`}</code>.
        </p>
      </section>
    </main>
  );
}
