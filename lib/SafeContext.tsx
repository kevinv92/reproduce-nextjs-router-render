/**
 * Demonstrates the SAFE context pattern — immune to the render-order bug.
 *
 * The difference from StrictContext:
 *   StrictContext  → createContext(null)  + hard throw on null
 *   SafeContext    → createContext(default) with a real default value
 *
 * When the Edge streaming renderer calls the page before _app, useContext
 * returns the DEFAULT VALUE instead of null. No throw, no crash — the
 * component renders with the default and updates after the provider mounts.
 *
 * This is how most well-written contexts work (react-query, next-themes,
 * zustand context, etc.). Flagsmith's useFlagsmith() is unusual in that
 * it explicitly throws rather than returning a default.
 *
 * Rule of thumb:
 *   - If the context CAN have a meaningful default → use one, skip the HOC
 *   - If the context MUST have server data (identity, flags, auth tokens)
 *     → it genuinely can't have a meaningful default → use the HOC pattern
 */
import React, { createContext, useContext, useState } from "react";

export interface SafeContextValue {
  theme: "light" | "dark";
  locale: string;
  featureReady: boolean;
}

// A real default — useContext returns this when no provider is in the tree.
// The render-order bug becomes harmless: worst case the component renders
// with defaults, then re-renders with real values once the provider mounts.
const DEFAULT: SafeContextValue = {
  theme: "light",
  locale: "en",
  featureReady: false,
};

const SafeCtx = createContext<SafeContextValue>(DEFAULT);

// No null check needed — context is never null.
export function useSafeContext(): SafeContextValue {
  return useContext(SafeCtx);
}

export function SafeContextProvider({
  children,
  serverValue,
}: {
  children: React.ReactNode;
  serverValue?: Partial<SafeContextValue>;
}) {
  const [value] = useState<SafeContextValue>({ ...DEFAULT, ...serverValue });
  return <SafeCtx.Provider value={value}>{children}</SafeCtx.Provider>;
}
