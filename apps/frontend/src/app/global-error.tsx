'use client';

// Catches an error in the ROOT layout itself, which error.tsx alone cannot
// do (per Next.js's own App Router convention) -- must render its own
// <html>/<body> since it replaces the entire root layout in that case.
// Deliberately minimal and dependency-free: if the root layout is broken,
// this page cannot assume any of this app's own providers/styles are safe
// to render either.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: '48px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 600 }}>Something went wrong</h1>
        <p style={{ color: '#666', maxWidth: '420px', margin: '12px auto' }}>
          An unexpected error occurred while loading the application. Please try again.
        </p>
        <button
          onClick={() => reset()}
          style={{ padding: '8px 18px', borderRadius: '6px', border: '1px solid #ccc', cursor: 'pointer' }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
