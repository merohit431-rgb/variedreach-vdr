'use client';

import { useEffect } from 'react';

// Phase 4 finding P4-17: no error boundary existed anywhere in this app --
// confirmed by a file-tree search finding zero error.tsx/global-error.tsx/
// custom ErrorBoundary. Every API call is already safely try/caught
// elsewhere; this catches a genuine render-time exception instead of
// leaving the user on a blank screen with no recovery path.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('Unhandled render error:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-app-bg px-6 text-center">
      <h1 className="text-xl font-semibold text-app-text">Something went wrong</h1>
      <p className="max-w-md text-sm text-app-t3">
        An unexpected error occurred. Your data is safe -- try reloading the page, or go back to the dashboard.
      </p>
      <div className="flex gap-3">
        <button
          onClick={() => reset()}
          className="rounded-md bg-app-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Try again
        </button>
        <a
          href="/dashboard"
          className="rounded-md border border-app-border px-4 py-2 text-sm font-medium text-app-text hover:bg-app-s2"
        >
          Go to dashboard
        </a>
      </div>
    </div>
  );
}
