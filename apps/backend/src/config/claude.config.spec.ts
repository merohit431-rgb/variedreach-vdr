// Tests the production-activation gate directly against the config
// factory's own computed values, since this logic is evaluated once at
// module-load time (module-level consts, not per-call) -- jest.resetModules
// + a fresh require() per test is what actually re-runs that computation
// under a different process.env, rather than mocking ConfigService (which
// would only prove the mock, not this file's own logic).
describe('claude.config', () => {
  const ORIGINAL_ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    jest.resetModules();
  });

  function loadConfig(env: Record<string, string | undefined>) {
    process.env = { ...ORIGINAL_ENV, ...env };
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('./claude.config');
    return (mod.default as () => Record<string, unknown>)();
  }

  it('defaults to disabled when nothing is set', () => {
    const config = loadConfig({ CLAUDE_API_ENABLED: undefined, APP_ENVIRONMENT: undefined, CLAUDE_PRODUCTION_ACTIVATION_APPROVED: undefined });

    expect(config.apiEnabled).toBe(false);
    expect(config.productionActivationApproved).toBe(false);
  });

  it('on staging, CLAUDE_API_ENABLED=true alone is sufficient -- the existing pilot mechanism, unchanged', () => {
    const config = loadConfig({ CLAUDE_API_ENABLED: 'true', APP_ENVIRONMENT: 'staging', CLAUDE_PRODUCTION_ACTIVATION_APPROVED: undefined });

    expect(config.apiEnabled).toBe(true);
  });

  it('outside staging, CLAUDE_API_ENABLED=true WITHOUT production activation approval fails closed, not open', () => {
    const config = loadConfig({ CLAUDE_API_ENABLED: 'true', APP_ENVIRONMENT: undefined, CLAUDE_PRODUCTION_ACTIVATION_APPROVED: undefined });

    expect(config.apiEnabled).toBe(false);
  });

  it('outside staging, CLAUDE_API_ENABLED=true WITH production activation approval enables the feature', () => {
    const config = loadConfig({ CLAUDE_API_ENABLED: 'true', APP_ENVIRONMENT: undefined, CLAUDE_PRODUCTION_ACTIVATION_APPROVED: 'true' });

    expect(config.apiEnabled).toBe(true);
    expect(config.productionActivationApproved).toBe(true);
  });

  it('production activation approval alone, without CLAUDE_API_ENABLED, still does not enable the feature', () => {
    const config = loadConfig({ CLAUDE_API_ENABLED: undefined, APP_ENVIRONMENT: undefined, CLAUDE_PRODUCTION_ACTIVATION_APPROVED: 'true' });

    expect(config.apiEnabled).toBe(false);
  });

  it('ADVERSARIAL: a truthy-looking but non-exact value never approves production activation', () => {
    const config = loadConfig({ CLAUDE_API_ENABLED: 'true', APP_ENVIRONMENT: undefined, CLAUDE_PRODUCTION_ACTIVATION_APPROVED: '1' });

    expect(config.apiEnabled).toBe(false);
    expect(config.productionActivationApproved).toBe(false);
  });

  it('a non-staging APP_ENVIRONMENT value (e.g. "production") is treated the same as unset -- still requires explicit activation approval', () => {
    const config = loadConfig({ CLAUDE_API_ENABLED: 'true', APP_ENVIRONMENT: 'production', CLAUDE_PRODUCTION_ACTIVATION_APPROVED: undefined });

    expect(config.apiEnabled).toBe(false);
  });
});
