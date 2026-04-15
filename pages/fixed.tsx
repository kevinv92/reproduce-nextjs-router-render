import type { GetServerSideProps } from "next";
import { useStrictContext, type StrictContextValue } from "@/lib/StrictContext";
import { useSafeContext, type SafeContextValue } from "@/lib/SafeContext";

// Typed at the getServerSideProps boundary only. FixedPage itself reads
// from context (useStrictContext, useSafeContext) rather than from props.
// serverContextState is consumed by the HOC wrapper; safeContextValue is
// consumed by _app's SafeContextProvider via pageProps — neither is a prop
// of FixedPage itself.
interface PageProps {
  serverContextState: StrictContextValue;
  safeContextValue: SafeContextValue;
}
import {
  withStrictContext,
  getServerContextState,
} from "@/lib/withStrictContext";

function FixedPage() {
  // Needs the HOC — createContext(null), throws if no provider in tree.
  const strict = useStrictContext();

  // No HOC needed — createContext(defaultValue), never throws.
  // If _app renders after this page (Edge bug), this returns the default
  // value instead of throwing. Safe by design.
  const safe = useSafeContext();

  return (
    <main style={{ fontFamily: "monospace", padding: "2rem" }}>
      <h1>Fixed Page — two contexts side by side</h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "1rem" }}>

        {/* Safe context — no HOC needed */}
        <section
          style={{
            background: "#f0fdf4",
            border: "1px solid #86efac",
            padding: "1rem",
            borderRadius: "4px",
          }}
        >
          <strong>SafeContext</strong>{" "}
          <code style={{ fontSize: "0.75rem", color: "#666" }}>
            createContext(defaultValue)
          </code>
          <pre style={{ marginTop: "0.5rem", fontSize: "0.8rem" }}>
            {JSON.stringify(safe, null, 2)}
          </pre>
          <p style={{ fontSize: "0.8rem", color: "#166534", marginTop: "0.5rem" }}>
            No HOC required. If page renders before _app, useContext returns
            the default value — no throw, no crash.
          </p>
        </section>

        {/* Strict context — HOC required */}
        <section
          style={{
            background: "#fefce8",
            border: "1px solid #fde047",
            padding: "1rem",
            borderRadius: "4px",
          }}
        >
          <strong>StrictContext</strong>{" "}
          <code style={{ fontSize: "0.75rem", color: "#666" }}>
            createContext(null) + hard throw
          </code>
          <pre style={{ marginTop: "0.5rem", fontSize: "0.8rem" }}>
            {JSON.stringify(strict, null, 2)}
          </pre>
          <p style={{ fontSize: "0.8rem", color: "#854d0e", marginTop: "0.5rem" }}>
            Requires HOC. If page renders before _app without the HOC,
            useContext returns null → throws. HOC adds its own provider
            in the page subtree.
          </p>
        </section>
      </div>

      <section
        style={{
          marginTop: "1.5rem",
          padding: "1rem",
          background: "#f8fafc",
          borderRadius: "4px",
          fontSize: "0.85rem",
          lineHeight: "1.7",
        }}
      >
        <strong>Context risk summary</strong>
        <table style={{ borderCollapse: "collapse", marginTop: "0.5rem", width: "100%" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
              <th style={{ textAlign: "left", padding: "0.25rem 0.5rem" }}>Pattern</th>
              <th style={{ textAlign: "left", padding: "0.25rem 0.5rem" }}>Example</th>
              <th style={{ textAlign: "left", padding: "0.25rem 0.5rem" }}>Vulnerable?</th>
              <th style={{ textAlign: "left", padding: "0.25rem 0.5rem" }}>Fix</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: "0.25rem 0.5rem" }}><code>createContext(null)</code> + hard throw</td>
              <td style={{ padding: "0.25rem 0.5rem" }}>useFlagsmith(), useStrictContext()</td>
              <td style={{ padding: "0.25rem 0.5rem", color: "#dc2626" }}>Yes</td>
              <td style={{ padding: "0.25rem 0.5rem" }}>withStrictContext HOC</td>
            </tr>
            <tr>
              <td style={{ padding: "0.25rem 0.5rem" }}><code>createContext(null)</code> + <code>ctx!</code></td>
              <td style={{ padding: "0.25rem 0.5rem" }}>useFlags() in flagsmith</td>
              <td style={{ padding: "0.25rem 0.5rem", color: "#dc2626" }}>Yes — generic TypeError</td>
              <td style={{ padding: "0.25rem 0.5rem" }}>withStrictContext HOC</td>
            </tr>
            <tr>
              <td style={{ padding: "0.25rem 0.5rem" }}><code>createContext(null)</code> + <code>ctx?.</code></td>
              <td style={{ padding: "0.25rem 0.5rem" }}>useFlagsmithLoading()</td>
              <td style={{ padding: "0.25rem 0.5rem", color: "#d97706" }}>Silently broken (returns undefined)</td>
              <td style={{ padding: "0.25rem 0.5rem" }}>HOC or real default</td>
            </tr>
            <tr>
              <td style={{ padding: "0.25rem 0.5rem" }}><code>createContext(defaultValue)</code></td>
              <td style={{ padding: "0.25rem 0.5rem" }}>useSafeContext(), next-themes, zustand</td>
              <td style={{ padding: "0.25rem 0.5rem", color: "#16a34a" }}>No</td>
              <td style={{ padding: "0.25rem 0.5rem" }}>Nothing needed</td>
            </tr>
          </tbody>
        </table>
      </section>
    </main>
  );
}

export const getServerSideProps: GetServerSideProps<PageProps> = async () => {
  const serverContextState = await getServerContextState();

  // SafeContext doesn't need server data for correctness (default value
  // handles the no-provider case), but you can still seed it from the
  // server for user preferences, locale from Accept-Language header, etc.
  const safeContextValue = { theme: "dark" as const, locale: "en", featureReady: true };

  return { props: { serverContextState, safeContextValue } };
};

export default withStrictContext(FixedPage);
