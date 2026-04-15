/**
 * Mimics how flagsmith/react implements its context:
 * - createContext(null) with no default value
 * - useStrictContext() hard-throws if context is null
 *
 * This is the exact pattern that breaks when page renders
 * before _app in Next.js 15 Pages Router + Edge runtime.
 *
 * Compare with flagsmith-js-client react.tsx:
 *   useFlagsmith()   → hard throws on null  (this file mimics this)
 *   useFlags()       → non-null assertion   (crashes with generic TypeError)
 *   useFlagsmithLoading() → optional chain  (silently returns undefined)
 */
import React, { createContext, useContext, useRef, useState } from "react";

export interface StrictContextValue {
  initialized: boolean;
  data: Record<string, boolean>;
}

// Initialized to null — no fallback. If a consumer runs before
// the provider mounts, useContext returns null.
const StrictCtx = createContext<StrictContextValue | null>(null);

// Hard-throws on null — exactly like useFlagsmith()
export function useStrictContext(): StrictContextValue {
  const ctx = useContext(StrictCtx);
  if (ctx === null) {
    throw new Error(
      "useStrictContext must be used within a StrictContextProvider"
    );
  }
  return ctx;
}

// Mimics how flagsmith/react initializes asynchronously
export function StrictContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  console.log({ ps: "Provider (inside _app)", phase: "render" });

  const [state, setState] = useState<StrictContextValue>({
    initialized: false,
    data: {},
  });

  // Simulate async init (like flagsmith.init())
  React.useEffect(() => {
    setTimeout(() => {
      setState({ initialized: true, data: { feature_flag_a: true } });
    }, 50);
  }, []);

  return <StrictCtx.Provider value={state}>{children}</StrictCtx.Provider>;
}
