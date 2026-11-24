// embedded-postgres ships only a bare `"exports": "./dist/index.js"` field
// (no `main`/`types`), which this project's `moduleResolution: "node"`
// (classic) tsconfig cannot follow to its real .d.ts -- an ambient shim for
// the handful of methods ai-budget-reservation.integration.spec.ts actually
// calls, rather than changing a project-wide tsconfig setting for the sake
// of one dev-only integration test.
declare module 'embedded-postgres' {
  interface PostgresOptions {
    databaseDir?: string;
    port?: number;
    user?: string;
    password?: string;
    persistent?: boolean;
    onLog?: (message: string) => void;
    onError?: (messageOrError: string | Error | unknown) => void;
  }

  class EmbeddedPostgres {
    constructor(options?: PostgresOptions);
    initialise(): Promise<void>;
    start(): Promise<void>;
    stop(): Promise<void>;
  }

  export default EmbeddedPostgres;
}
