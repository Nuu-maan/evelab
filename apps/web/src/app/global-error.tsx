"use client";

import "./globals.css";

/** Replaces the root layout when it fails, so it brings its own html and body and no app components. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <main style={{ display: "grid", placeItems: "center", minHeight: "100vh", padding: 24, textAlign: "center" }}>
          <div style={{ display: "grid", gap: 12, justifyItems: "center" }}>
            <h1 style={{ fontSize: 24, fontWeight: 500 }}>evelab could not load</h1>
            <p style={{ color: "var(--foreground-secondary)", maxWidth: "48ch" }}>
              Your project files are unchanged. Reload to try again.
            </p>
            {error.digest && <code style={{ fontFamily: "monospace", fontSize: 13 }}>{error.digest}</code>}
            <button
              type="button"
              onClick={reset}
              style={{
                height: 40,
                padding: "0 16px",
                borderRadius: 6,
                border: "none",
                background: "var(--primary)",
                color: "var(--primary-foreground)",
                cursor: "pointer",
              }}
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
