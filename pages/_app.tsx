import type { AppProps } from "next/app";
import { StrictContextProvider } from "@/lib/StrictContext";

export default function App({ Component, pageProps }: AppProps) {
  // In standard renderToString, this logs BEFORE the page.
  // With the Edge streaming renderer (renderToReadableStream),
  // the page component can render BEFORE _app — this log appears AFTER.
  console.log({ ps: "App", phase: "render" });

  return (
    <StrictContextProvider>
      <Component {...pageProps} />
    </StrictContextProvider>
  );
}
