import type { AppProps } from "next/app";

// No global StrictContextProvider here.
//
// Having the provider in _app was the original bug: the Edge streaming
// renderer (renderToReadableStream) does not guarantee that _app renders
// before the page component, so a page calling useStrictContext() could
// run before the provider mounts → useContext returns null → throw.
//
// Fix: each page that needs the context wraps itself via withStrictContext()
// (see lib/withStrictContext.tsx). The HOC's provider is part of the page's
// own subtree, so render order between _app and the page is irrelevant.
//
// Pages WITHOUT the HOC (/index, /edge) will throw — that is intentional;
// they are the reproduction of the bug. Visit /fixed to see the fix.
export default function App({ Component, pageProps }: AppProps) {
  console.log({ ps: "App", phase: "render" });
  return <Component {...pageProps} />;
}
