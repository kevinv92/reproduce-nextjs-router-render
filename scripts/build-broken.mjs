/**
 * build:broken — proves the bug is reproducible with `next build` locally.
 *
 * What it does:
 *   1. Temporarily writes a STATIC version of pages/index.tsx (no getServerSideProps)
 *   2. Temporarily strips _app.tsx of its StrictContextProvider (simulates missing provider)
 *   3. Runs `next build`
 *   4. Restores both files (even if build fails)
 *
 * Expected result:
 *   Build FAILS with:
 *     Error: useStrictContext must be used within a StrictContextProvider
 *     at react-dom-server.edge.production.js:4282
 *
 * Why this matters:
 *   Next.js 15 uses react-dom-server.edge.production.js (the streaming Edge
 *   renderer) even for static page prerendering during `next build`. It does
 *   NOT require edge runtime config. Any static page that uses a null-initialised
 *   context consumer (createContext(null) + throw) will fail at build time.
 *
 * The fixed page (/fixed) passes because:
 *   - It has getServerSideProps (opts it out of static prerendering)
 *   - It uses the withStrictContext HOC (its own provider, seeded before rendering)
 */

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const indexPath = join(root, "pages", "index.tsx");
const appPath = join(root, "pages", "_app.tsx");

// Save originals
const originalIndex = readFileSync(indexPath, "utf8");
const originalApp = readFileSync(appPath, "utf8");

// Broken index.tsx — static (no getServerSideProps), uses strict context
const brokenIndex = `import { useStrictContext } from "@/lib/StrictContext";

// NO getServerSideProps — this is a STATIC page.
// next build will prerender it using react-dom-server.edge.production.js.
// Without a provider in the tree, useStrictContext() returns null → throws.
export default function Home() {
  const ctx = useStrictContext(); // throws during build-time prerender
  return <main><pre>{JSON.stringify(ctx)}</pre></main>;
}
`;

// Broken _app.tsx — no StrictContextProvider (simulates the missing-provider scenario)
const brokenApp = `import type { AppProps } from "next/app";
// No provider — the static index.tsx page has nothing above it when prerendered.
export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}
`;

console.log("=".repeat(60));
console.log("build:broken — writing broken files...");
console.log("  pages/index.tsx  → static, no getServerSideProps");
console.log("  pages/_app.tsx   → no StrictContextProvider");
console.log("=".repeat(60));

writeFileSync(indexPath, brokenIndex);
writeFileSync(appPath, brokenApp);

let exitCode = 0;

try {
  execSync("npx next build", { cwd: root, stdio: "inherit" });
  console.log("\n[UNEXPECTED] Build succeeded — the reproduction failed.");
  exitCode = 1;
} catch {
  console.log("\n" + "=".repeat(60));
  console.log("BUILD FAILED as expected.");
  console.log("Look for: react-dom-server.edge.production.js in the stack.");
  console.log("=".repeat(60));
} finally {
  console.log("\nRestoring original files...");
  writeFileSync(indexPath, originalIndex);
  writeFileSync(appPath, originalApp);
  console.log("Restored. Run `npm run build` to confirm the fixed state passes.");
}

process.exit(exitCode);
