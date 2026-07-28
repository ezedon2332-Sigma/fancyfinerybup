"use client";

import { useEffect } from "react";

/**
 * Last-resort boundary, for errors thrown in the root layout itself — where
 * `error.tsx` cannot help because the layout that would render it is the thing
 * that failed.
 *
 * It must supply its own <html> and <body>: at this point React has discarded
 * the tree, so nothing from the layout is available. That also means no fonts,
 * no Tailwind — hence the inline styles. Keeping it dependency-free is the
 * point: this file has to work when everything else has not.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global error]", error.digest ?? "", error.message);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#000",
          color: "#ededed",
          fontFamily: "Georgia, 'Times New Roman', serif",
          padding: "2rem",
        }}
      >
        <div style={{ maxWidth: "26rem", textAlign: "center" }}>
          <p
            style={{
              margin: 0,
              fontSize: "10px",
              letterSpacing: "0.3em",
              textTransform: "uppercase",
              color: "#eab308",
            }}
          >
            Fancy Finery
          </p>
          <h1
            style={{
              margin: "1.5rem 0 0",
              fontSize: "1.6rem",
              fontWeight: 400,
              color: "#fff",
            }}
          >
            The site is briefly unavailable
          </h1>
          <p
            style={{
              margin: "1.25rem 0 0",
              fontSize: "0.9rem",
              lineHeight: 1.8,
              color: "#bdbdbd",
              fontFamily: "Arial, Helvetica, sans-serif",
            }}
          >
            Please try again in a moment. No order or payment has been affected.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "2rem",
              padding: "0.9rem 2.5rem",
              border: 0,
              cursor: "pointer",
              background: "#eab308",
              color: "#0a0a0a",
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.24em",
              textTransform: "uppercase",
              fontFamily: "Arial, Helvetica, sans-serif",
            }}
          >
            Reload
          </button>
          {error.digest && (
            <p
              style={{
                marginTop: "2rem",
                fontSize: "10px",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "#6b6b6b",
                fontFamily: "Arial, Helvetica, sans-serif",
              }}
            >
              Reference {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
