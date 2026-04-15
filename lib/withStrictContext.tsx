/**
 * HOC-based fix for the Next.js 15 Pages Router + Edge runtime render-order bug.
 *
 * Problem recap:
 *   - _app.tsx wraps every page in StrictContextProvider
 *   - Edge streaming renderer (renderToReadableStream) can call the page
 *     component before _app's provider mounts → useContext returns null → throw
 *
 * Fix (mirrors the Flagsmith withPageFlags pattern from the Notion doc):
 *   1. getServerContextState() — call in getServerSideProps; resolves the state
 *      BEFORE React touches the component tree (no render-order risk)
 *   2. withStrictContext(PageComponent) — HOC that wraps the page in its own
 *      StrictContextProvider, seeded from serverContextState. The provider is
 *      guaranteed to be in the tree before the page component renders.
 *
 * Why getServerSideProps is safe:
 *   getServerSideProps runs completely outside the React render pipeline.
 *   Its result is passed as props to the component tree — by the time React
 *   starts rendering, the state is already sitting in pageProps. This holds
 *   for both renderToString (Node) and renderToReadableStream (Edge).
 */

import { useRef } from "react";
import {
  StrictContextProvider,
  type StrictContextValue,
} from "@/lib/StrictContext";

// ─── Server-side helper ───────────────────────────────────────────────────────

/**
 * Resolves the context state on the server inside getServerSideProps.
 *
 * In a real Flagsmith app this is:
 *   const flagsmith = createFlagsmithInstance()
 *   await flagsmith.init({ environmentID: ..., identity: userId })
 *   return flagsmith.getState()
 *
 * Here we simulate a network call with a short delay.
 */
export async function getServerContextState(
  userId?: string
): Promise<StrictContextValue> {
  // Simulate fetching feature flags from a remote service (~10 ms)
  await new Promise((r) => setTimeout(r, 10));

  return {
    initialized: true,
    data: {
      feature_flag_a: true,
      promo_banner: userId !== undefined, // enabled only for logged-in users
    },
  };
}

// ─── HOC ─────────────────────────────────────────────────────────────────────

/**
 * Wraps a page component in its own StrictContextProvider seeded from
 * serverContextState (the value returned by getServerContextState and passed
 * through getServerSideProps → pageProps).
 *
 * Usage:
 *   export default withStrictContext(MyPage)
 *
 *   export const getServerSideProps: GetServerSideProps = async () => ({
 *     props: { serverContextState: await getServerContextState() },
 *   })
 */
export function withStrictContext<P extends Record<string, unknown>>(
  PageComponent: React.ComponentType<P>
) {
  function WrappedPage({
    serverContextState,
    ...props
  }: P & { serverContextState: StrictContextValue }) {
    // useRef so createInstance isn't called on every render (mirrors
    // the flagsmith HOC using useRef(createFlagsmithInstance()))
    const stateRef = useRef(serverContextState);

    return (
      <StrictContextProvider serverState={stateRef.current}>
        <PageComponent {...(props as unknown as P)} />
      </StrictContextProvider>
    );
  }

  WrappedPage.displayName = `withStrictContext(${
    PageComponent.displayName ?? PageComponent.name ?? "Component"
  })`;

  return WrappedPage;
}
